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
        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        if (!Number.isFinite(maxDim) || maxDim <= 0) {
          console.warn("Placed GLB has invalid bounds");
          this.setStatus("Model loaded, but bounds are invalid.");
          return;
        }

        const scale = this.selectedModel.placementScale ?? 1;
        this.model.scale.setScalar(scale);
        this.model.updateWorldMatrix(true, true);

        const scaledBox = new THREE.Box3().setFromObject(this.model);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        const minY = scaledBox.min.y;

        this.model.position.sub(scaledCenter);
        this.model.position.y -= minY;

        this.model.visible = false;
        this.root.add(this.model);

        this.setStatus(`Model loaded: ${this.selectedModel.label}. Press Start AR, then tap reticle.`);
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
      this.setStatus("Model already placed.");
      return;
    }

    const placed = this.placement.place(this.root);
    if (placed) {
      const debugCube = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.1),
        new THREE.MeshStandardMaterial({ color: 0xff00ff })
      );
      debugCube.position.set(0, 0.05, 0);
      this.root.add(debugCube);

      this.model.visible = true;
      this.setStatus("Model placed. Magenta debug cube added.");
    } else {
      this.setStatus("Reticle not ready. Move phone until it locks onto a surface.");
    }
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
