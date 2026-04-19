import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ExperienceModule, ExperienceModuleContext } from "./ExperienceModule";
import { PlacementController } from "../placement/PlacementController";
import type { ModelOption } from "../models/modelCatalog";

export class PlacementModule implements ExperienceModule {
  readonly mode = "placement" as const;

  private root = new THREE.Group();
  private placement = new PlacementController();
  private loader = new GLTFLoader();
  private model?: THREE.Object3D;
  private context?: ExperienceModuleContext;
  private canPlace = false;
  private statusEl?: HTMLDivElement;
  private clickHandler?: () => void;
  private startArHandler?: () => void;
  private touchStartHandler?: (event: TouchEvent) => void;
  private touchMoveHandler?: (event: TouchEvent) => void;
  private touchEndHandler?: () => void;

  private isDragging = false;
  private lastTouchX = 0;
  private lastTouchY = 0;
  private pinchStartDistance = 0;
  private pinchStartAngle = 0;
  private pinchStartScale = 1;
  private pinchStartRotationY = 0;

  constructor(private selectedModel: ModelOption) {}

  async mount(parent: THREE.Object3D, context: ExperienceModuleContext): Promise<void> {
    this.context = context;
    parent.add(this.root);

    this.createStatusOverlay(context.element);
    this.setStatus(`Loading ${this.selectedModel.label}...`);

    this.placement.mount(context.scene, context.renderer);
    this.placement.setSelectHandler(() => {
      this.tryPlace();
    });

    this.loader.load(
      this.selectedModel.path,
      (gltf) => {
        this.model = gltf.scene;

        let meshCount = 0;
        this.model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            meshCount++;
            child.frustumCulled = false;

            const applyMaterial = (material: THREE.Material) => {
              material.side = THREE.DoubleSide;
              material.needsUpdate = true;
            };

            if (Array.isArray(child.material)) {
              child.material.forEach(applyMaterial);
            } else {
              applyMaterial(child.material);
            }
          }
        });

        if (meshCount === 0) {
          console.warn("Placed GLB has no meshes");
          this.setStatus("Model loaded, but it has no meshes.");
          return;
        }

        this.model.updateWorldMatrix(true, true);
        const originalBox = new THREE.Box3().setFromObject(this.model);
        const originalSize = originalBox.getSize(new THREE.Vector3());
        const originalMaxDim = Math.max(originalSize.x, originalSize.y, originalSize.z);

        if (!Number.isFinite(originalMaxDim) || originalMaxDim <= 0) {
          console.warn("Placed GLB has invalid bounds");
          this.setStatus("Model loaded, but bounds are invalid.");
          return;
        }

        const placementScale = this.selectedModel.placementScale ?? 1;
        const placementTargetSize = this.selectedModel.placementTargetSize ?? 0.5;
        const normalizedScale = (placementTargetSize / originalMaxDim) * placementScale;
        this.model.scale.setScalar(normalizedScale);
        this.model.updateWorldMatrix(true, true);

        const scaledBox = new THREE.Box3().setFromObject(this.model);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        const minY = scaledBox.min.y;
        const worldSize = scaledBox.getSize(new THREE.Vector3());

        this.model.position.sub(scaledCenter);
        this.model.position.y -= minY;

        const helper = new THREE.Box3Helper(new THREE.Box3().setFromObject(this.model), 0xffff00);
        helper.visible = true;
        this.model.add(helper);

        this.model.visible = false;
        this.root.add(this.model);

        this.setStatus(
          `Model loaded: ${this.selectedModel.label} (${worldSize.x.toFixed(2)} × ${worldSize.y.toFixed(2)} × ${worldSize.z.toFixed(2)}m). Press Start AR, then tap reticle.`
        );
      },
      undefined,
      (error) => {
        console.error("GLB load failed:", error);
        this.setStatus(`Model failed to load: ${this.selectedModel.label}`);
      }
    );

    this.startArHandler = async () => {
      this.setStatus("Starting AR...");
      const result = await this.placement.startAR();
      if (!result.ok) {
        alert(result.reason || "AR failed to start");
        this.setStatus(`AR failed: ${result.reason || "unknown error"}`);
        return;
      }

      this.setStatus("AR started. Move phone until reticle appears, then tap once.");
      this.canPlace = false;
      window.setTimeout(() => {
        this.canPlace = true;
        this.setStatus("Tap reticle to place model.");
      }, 500);
    };

    context.element.addEventListener("start-ar", this.startArHandler);

    this.clickHandler = () => {
      this.tryPlace();
    };
    context.element.addEventListener("click", this.clickHandler);

    this.touchStartHandler = (event: TouchEvent) => {
      if (!this.placement.isPlaced()) return;
      if (event.touches.length === 1) {
        this.isDragging = true;
        this.lastTouchX = event.touches[0].clientX;
        this.lastTouchY = event.touches[0].clientY;
      } else if (event.touches.length === 2) {
        this.isDragging = false;
        this.pinchStartDistance = this.getTouchDistance(event.touches[0], event.touches[1]);
        this.pinchStartAngle = this.getTouchAngle(event.touches[0], event.touches[1]);
        this.pinchStartScale = this.root.scale.x || 1;
        this.pinchStartRotationY = this.root.rotation.y;
      }
    };

    this.touchMoveHandler = (event: TouchEvent) => {
      if (!this.placement.isPlaced()) return;

      if (event.touches.length === 1 && this.isDragging && this.context) {
        event.preventDefault();
        const touch = event.touches[0];
        const dx = touch.clientX - this.lastTouchX;
        const dy = touch.clientY - this.lastTouchY;
        this.lastTouchX = touch.clientX;
        this.lastTouchY = touch.clientY;

        const camera = this.context.camera;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
        const moveScale = 0.002;

        this.root.position.addScaledVector(right, dx * moveScale);
        this.root.position.addScaledVector(forward, -dy * moveScale);
      } else if (event.touches.length === 2) {
        event.preventDefault();
        const distance = this.getTouchDistance(event.touches[0], event.touches[1]);
        const angle = this.getTouchAngle(event.touches[0], event.touches[1]);

        if (this.pinchStartDistance > 0) {
          const scaleFactor = distance / this.pinchStartDistance;
          const clampedScale = THREE.MathUtils.clamp(this.pinchStartScale * scaleFactor, 0.25, 4);
          this.root.scale.setScalar(clampedScale);
        }

        const angleDelta = angle - this.pinchStartAngle;
        this.root.rotation.y = this.pinchStartRotationY + angleDelta;
      }
    };

    this.touchEndHandler = () => {
      this.isDragging = false;
      this.pinchStartDistance = 0;
    };

    context.element.addEventListener("touchstart", this.touchStartHandler, { passive: false });
    context.element.addEventListener("touchmove", this.touchMoveHandler, { passive: false });
    context.element.addEventListener("touchend", this.touchEndHandler);
    context.element.addEventListener("touchcancel", this.touchEndHandler);
  }

  unmount(parent: THREE.Object3D): void {
    if (this.context) {
      this.placement.unmount(this.context.scene);
      if (this.clickHandler) {
        this.context.element.removeEventListener("click", this.clickHandler);
      }
      if (this.startArHandler) {
        this.context.element.removeEventListener("start-ar", this.startArHandler);
      }
      if (this.touchStartHandler) {
        this.context.element.removeEventListener("touchstart", this.touchStartHandler);
      }
      if (this.touchMoveHandler) {
        this.context.element.removeEventListener("touchmove", this.touchMoveHandler);
      }
      if (this.touchEndHandler) {
        this.context.element.removeEventListener("touchend", this.touchEndHandler);
        this.context.element.removeEventListener("touchcancel", this.touchEndHandler);
      }
    }

    this.statusEl?.remove();
    this.statusEl = undefined;

    parent.remove(this.root);
    this.root.clear();
  }

  update(delta: number): void {
    if (this.context) {
      this.placement.update(this.context.camera);
    }
  }

  onDoubleTap(): void {}

  getGestureTarget(): THREE.Object3D {
    return this.root;
  }

  private tryPlace() {
    if (!this.canPlace) {
      this.setStatus("Wait for AR to stabilize before tapping.");
      return;
    }
    if (!this.model) {
      this.setStatus("Model is not loaded yet.");
      return;
    }
    if (this.placement.isPlaced()) {
      this.setStatus("Model already placed. Drag to move, pinch to scale/rotate.");
      return;
    }

    const placed = this.placement.place(this.root);
    if (placed) {
      this.model.visible = true;
      this.setStatus("Model placed. Drag to move, pinch to scale/rotate.");
    } else {
      this.setStatus("Reticle not ready. Move phone until it locks onto a surface.");
    }
  }

  private getTouchDistance(a: Touch, b: Touch): number {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  private getTouchAngle(a: Touch, b: Touch): number {
    return Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX);
  }

  private createStatusOverlay(element: HTMLElement) {
    this.statusEl?.remove();

    this.statusEl = document.createElement("div");
    this.statusEl.style.position = "absolute";
    this.statusEl.style.left = "20px";
    this.statusEl.style.right = "20px";
    this.statusEl.style.bottom = "20px";
    this.statusEl.style.zIndex = "1000";
    this.statusEl.style.padding = "10px 12px";
    this.statusEl.style.borderRadius = "8px";
    this.statusEl.style.background = "rgba(20,20,20,0.85)";
    this.statusEl.style.color = "white";
    this.statusEl.style.fontSize = "14px";
    this.statusEl.style.fontFamily = "sans-serif";
    this.statusEl.style.pointerEvents = "none";

    element.appendChild(this.statusEl);
  }

  private setStatus(message: string) {
    if (this.statusEl) {
      this.statusEl.textContent = message;
    }
    console.log("[PlacementModule]", message);
  }
}
