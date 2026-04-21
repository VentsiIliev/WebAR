import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ExperienceModule, ExperienceModuleContext } from "./ExperienceModule";
import { PlacementController } from "../placement/PlacementController";
import type { ModelOption } from "../models/modelCatalog";

type PlaceableGroup = THREE.Group & {
  userData: {
    helper?: THREE.BoxHelper;
  };
};

export class PlacementModule implements ExperienceModule {
  readonly mode = "placement" as const;

  private root = new THREE.Group();
  private placement = new PlacementController();
  private loader = new GLTFLoader();
  private template?: THREE.Object3D;
  private context?: ExperienceModuleContext;
  private canPlace = false;
  private statusEl?: HTMLDivElement;
  private toolbarEl?: HTMLDivElement;
  private controlsPanelEl?: HTMLDivElement;
  private gestureHintEl?: HTMLDivElement;
  private startArHandler?: () => void;

  private placedObjects: PlaceableGroup[] = [];
  private selectedObject?: PlaceableGroup;
  private pendingObject?: PlaceableGroup;
  private controlsVisible = false;

  private gestureSurface?: HTMLElement;
  private activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchDistance: number | null = null;
  private lastTwistAngle: number | null = null;

  constructor(private selectedModel: ModelOption) {}

  async mount(parent: THREE.Object3D, context: ExperienceModuleContext): Promise<void> {
    this.context = context;
    parent.add(this.root);

    this.createStatusOverlay(context.element);
    this.setStatus("Loading table…");

    this.placement.mount(context.scene, context.renderer);

    this.placement.setSelectHandler(() => {
      if (this.pendingObject) {
        this.tryPlacePending();
        return;
      }

      if (!this.selectedObject) {
        this.setStatus("Tap Add to place a new table.");
        return;
      }

      this.selectNextObject(1);
    });

    this.loader.load(
      this.selectedModel.path,
      (gltf) => {
        const scene = gltf.scene;
        scene.updateWorldMatrix(true, true);

        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        const target = (this.selectedModel as ModelOption & { placementTargetSize?: number }).placementTargetSize ?? 1;
        const normalizedScale = target / maxDim;
        scene.scale.setScalar(normalizedScale);
        scene.updateWorldMatrix(true, true);

        const scaledBox = new THREE.Box3().setFromObject(scene);
        const center = scaledBox.getCenter(new THREE.Vector3());
        const minY = scaledBox.min.y;

        scene.position.sub(center);
        scene.position.y -= minY;

        scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.frustumCulled = false;
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => {
                m.side = THREE.DoubleSide;
                m.needsUpdate = true;
              });
            } else {
              child.material.side = THREE.DoubleSide;
              child.material.needsUpdate = true;
            }
          }
        });

        this.template = scene;
        this.setStatus("AR ready. Press Start AR, then tap the keyring to place the table.");
      },
      undefined,
      () => {
        this.setStatus("Failed to load table model.");
      }
    );

    this.startArHandler = async () => {
      this.setStatus("Starting AR… Point your phone at the floor or a table surface.");
      const result = await this.placement.startAR(this.context?.overlayRoot);
      if (!result.ok) {
        this.setStatus("AR failed to start. Try again.");
        return;
      }

      const overlay = this.context?.overlayRoot;
      if (overlay) {
        overlay.style.pointerEvents = "auto";
      }

      if (!this.toolbarEl) {
        this.createToolbar(overlay || document.body);
      }

      this.attachGestureSurface(overlay || this.context!.element);

      this.canPlace = false;
      this.setStatus("Move your phone slowly until the keyring appears, then tap the keyring.");
      setTimeout(() => {
        this.canPlace = true;
        this.preparePendingObject();
      }, 500);
    };

    context.element.addEventListener("start-ar", this.startArHandler);
  }

  unmount(parent: THREE.Object3D): void {
    if (this.context && this.startArHandler) {
      this.context.element.removeEventListener("start-ar", this.startArHandler);
      this.placement.unmount(this.context.scene);
    }

    this.detachGestureSurface();

    this.toolbarEl?.remove();
    this.statusEl?.remove();
    this.toolbarEl = undefined;
    this.controlsPanelEl = undefined;
    this.gestureHintEl = undefined;
    this.statusEl = undefined;

    [...this.placedObjects, this.pendingObject].forEach((obj) => {
      if (obj?.userData.helper) this.root.remove(obj.userData.helper);
    });

    this.placedObjects = [];
    this.selectedObject = undefined;
    this.pendingObject = undefined;

    parent.remove(this.root);
    this.root.clear();
  }

  update(): void {
    if (!this.context) return;
    this.placement.update(this.context.camera);

    for (const obj of this.placedObjects) {
      obj.userData.helper?.update();
    }
    this.pendingObject?.userData.helper?.update();
  }

  onDoubleTap(): void {}

  getGestureTarget(): THREE.Object3D {
    return this.root;
  }

  private attachGestureSurface(el: HTMLElement) {
    if (this.gestureSurface === el) return;
    this.detachGestureSurface();
    this.gestureSurface = el;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", this.onGesturePointerDown);
    el.addEventListener("pointermove", this.onGesturePointerMove);
    el.addEventListener("pointerup", this.onGesturePointerUp);
    el.addEventListener("pointercancel", this.onGesturePointerUp);
    el.addEventListener("pointerleave", this.onGesturePointerUp);
  }

  private detachGestureSurface() {
    if (!this.gestureSurface) return;
    const el = this.gestureSurface;
    el.removeEventListener("pointerdown", this.onGesturePointerDown);
    el.removeEventListener("pointermove", this.onGesturePointerMove);
    el.removeEventListener("pointerup", this.onGesturePointerUp);
    el.removeEventListener("pointercancel", this.onGesturePointerUp);
    el.removeEventListener("pointerleave", this.onGesturePointerUp);
    this.gestureSurface = undefined;
    this.activePointers.clear();
    this.lastPinchDistance = null;
    this.lastTwistAngle = null;
  }

  private onGesturePointerDown = (event: PointerEvent) => {
    if (!this.controlsVisible || !this.selectedObject || this.pendingObject) return;
    if ((event.target as HTMLElement)?.closest("button")) return;

    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 2) {
      const [a, b] = Array.from(this.activePointers.values());
      this.lastPinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      this.lastTwistAngle = Math.atan2(b.y - a.y, b.x - a.x);
    }

    this.gestureSurface?.setPointerCapture?.(event.pointerId);
  };

  private onGesturePointerMove = (event: PointerEvent) => {
    if (!this.controlsVisible || !this.selectedObject || this.pendingObject) return;
    if (!this.activePointers.has(event.pointerId) || !this.context) return;

    const previous = this.activePointers.get(event.pointerId)!;
    const current = { x: event.clientX, y: event.clientY };
    this.activePointers.set(event.pointerId, current);

    const pointers = Array.from(this.activePointers.values());

    if (pointers.length === 1) {
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      this.moveSelected(dx * 0.0008, -dy * 0.0008);
      return;
    }

    if (pointers.length === 2) {
      const [a, b] = pointers;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);

      if (this.lastPinchDistance !== null) {
        const scaleRatio = distance / Math.max(1, this.lastPinchDistance);
        const nextFactor = THREE.MathUtils.clamp(scaleRatio, 0.96, 1.04);
        this.scaleSelected(nextFactor, false);
      }

      if (this.lastTwistAngle !== null) {
        let deltaAngle = angle - this.lastTwistAngle;
        if (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
        if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
        this.rotateSelected(deltaAngle, false);
      }

      this.lastPinchDistance = distance;
      this.lastTwistAngle = angle;
    }
  };

  private onGesturePointerUp = (event: PointerEvent) => {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size < 2) {
      this.lastPinchDistance = null;
      this.lastTwistAngle = null;
    }
    this.gestureSurface?.releasePointerCapture?.(event.pointerId);
  };

  private preparePendingObject() {
    if (!this.template || this.pendingObject) return;

    const group = new THREE.Group() as PlaceableGroup;
    const clone = this.template.clone(true);
    group.add(clone);
    this.root.add(group);

    const helper = new THREE.BoxHelper(group, 0x7c5cff);
    helper.visible = false;
    this.root.add(helper);
    group.userData.helper = helper;

    this.pendingObject = group;
    this.setSelectedObject(group);
    this.setStatus("Keyring ready: tap the keyring to place the table.");
  }

  private tryPlacePending() {
    if (!this.canPlace || !this.pendingObject) {
      this.setStatus("Wait for the keyring, then tap it.");
      return;
    }

    const placed = this.placement.place(this.pendingObject);
    if (!placed) {
      this.setStatus("No valid keyring yet. Move your phone until it locks onto a surface.");
      return;
    }

    this.placedObjects.push(this.pendingObject);
    this.setSelectedObject(this.pendingObject);
    this.pendingObject = undefined;
    this.setStatus("Table placed. Open Controls, then swipe to move, pinch to scale, or twist to rotate.");
  }

  private addObject() {
    if (!this.canPlace) {
      this.setStatus("Start AR first.");
      return;
    }
    this.preparePendingObject();
  }

  private removeSelected() {
    if (!this.selectedObject) {
      this.setStatus("No selected table to remove.");
      return;
    }

    this.root.remove(this.selectedObject);
    if (this.selectedObject.userData.helper) {
      this.root.remove(this.selectedObject.userData.helper);
    }
    this.placedObjects = this.placedObjects.filter((o) => o !== this.selectedObject);
    if (this.pendingObject === this.selectedObject) {
      this.pendingObject = undefined;
    }
    this.setSelectedObject(this.placedObjects.at(-1));
    this.setStatus("Selected table removed.");
  }

  private resetScene() {
    this.placedObjects.forEach((o) => {
      this.root.remove(o);
      if (o.userData.helper) this.root.remove(o.userData.helper);
    });
    if (this.pendingObject) {
      this.root.remove(this.pendingObject);
      if (this.pendingObject.userData.helper) this.root.remove(this.pendingObject.userData.helper);
    }

    this.placedObjects = [];
    this.pendingObject = undefined;
    this.setSelectedObject(undefined);

    if (this.canPlace) {
      this.preparePendingObject();
      this.setStatus("Scene reset. Tap the keyring to place a new table.");
    } else {
      this.setStatus("Scene reset.");
    }
  }

  private setSelectedObject(object?: PlaceableGroup) {
    this.selectedObject = object;
    const all = [...this.placedObjects, this.pendingObject].filter(Boolean) as PlaceableGroup[];
    all.forEach((obj) => {
      if (obj.userData.helper) obj.userData.helper.visible = obj === object;
    });
  }

  private selectNextObject(direction: 1 | -1) {
    if (this.placedObjects.length === 0) {
      this.setStatus("No placed tables to select.");
      return;
    }
    const currentIndex = this.selectedObject ? this.placedObjects.indexOf(this.selectedObject) : -1;
    const nextIndex = currentIndex < 0
      ? 0
      : (currentIndex + direction + this.placedObjects.length) % this.placedObjects.length;
    this.setSelectedObject(this.placedObjects[nextIndex]);
    this.setStatus(`Selected table ${nextIndex + 1} of ${this.placedObjects.length}.`);
  }

  private moveSelected(dx: number, dz: number) {
    if (!this.selectedObject || !this.context) {
      this.setStatus("No selected table to move.");
      return;
    }
    const camera = this.context.camera;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    this.selectedObject.position.addScaledVector(right, dx);
    this.selectedObject.position.addScaledVector(forward, dz);
  }

  private rotateSelected(deltaRadians: number, announce = true) {
    if (!this.selectedObject) {
      this.setStatus("No selected table to rotate.");
      return;
    }
    this.selectedObject.rotation.y += deltaRadians;
    if (announce) {
      this.setStatus("Rotated selected table.");
    }
  }

  private scaleSelected(factor: number, announce = true) {
    if (!this.selectedObject) {
      this.setStatus("No selected table to scale.");
      return;
    }
    const nextScale = THREE.MathUtils.clamp(this.selectedObject.scale.x * factor, 0.25, 4);
    this.selectedObject.scale.setScalar(nextScale);
    if (announce) {
      this.setStatus(`Scale: ${nextScale.toFixed(2)}x`);
    }
  }

  private toggleControlsPanel() {
    this.controlsVisible = !this.controlsVisible;
    if (this.controlsPanelEl) {
      this.controlsPanelEl.style.display = this.controlsVisible ? "grid" : "none";
    }
    if (this.gestureHintEl) {
      this.gestureHintEl.style.display = this.controlsVisible ? "block" : "none";
    }
    this.setStatus(this.controlsVisible ? "Controls opened. Swipe to move, pinch to scale, twist to rotate." : "Controls hidden.");
  }

  private createStatusOverlay(el: HTMLElement) {
    this.statusEl = document.createElement("div");
    Object.assign(this.statusEl.style, {
      position: "absolute",
      left: "16px",
      right: "16px",
      bottom: "20px",
      zIndex: "1000",
      padding: "14px 16px",
      borderRadius: "16px",
      background: "rgba(14, 16, 30, 0.82)",
      backdropFilter: "blur(10px)",
      color: "white",
      fontSize: "15px",
      lineHeight: "1.4",
      fontWeight: "500",
      boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
      pointerEvents: "none",
    } as Partial<CSSStyleDeclaration>);
    el.appendChild(this.statusEl);
  }

  private createToolbar(el: HTMLElement) {
    this.toolbarEl = document.createElement("div");
    Object.assign(this.toolbarEl.style, {
      position: "fixed",
      left: "50%",
      bottom: "88px",
      transform: "translateX(-50%)",
      zIndex: "9999",
      display: "flex",
      gap: "10px",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
      padding: "10px",
      borderRadius: "18px",
      background: "rgba(14, 16, 30, 0.82)",
      backdropFilter: "blur(10px)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
      pointerEvents: "auto",
      maxWidth: "calc(100vw - 24px)",
    } as Partial<CSSStyleDeclaration>);

    const makeButton = (label: string, onClick: () => void, grow = false) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      Object.assign(btn.style, {
        minWidth: grow ? "90px" : "auto",
        padding: grow ? "12px 18px" : "10px 14px",
        borderRadius: "14px",
        border: "1px solid rgba(255,255,255,0.18)",
        background: grow ? "linear-gradient(135deg, #6a5cff, #00aaff)" : "rgba(255,255,255,0.06)",
        color: "white",
        fontSize: grow ? "14px" : "13px",
        fontWeight: "700",
        cursor: "pointer",
        pointerEvents: "auto",
      } as Partial<CSSStyleDeclaration>);
      btn.onclick = onClick;
      this.toolbarEl!.appendChild(btn);
      return btn;
    };

    const toggleBtn = makeButton("Show Controls", () => {
      this.toggleControlsPanel();
      toggleBtn.textContent = this.controlsVisible ? "Hide Controls" : "Show Controls";
    }, true);

    makeButton("Select", () => this.selectNextObject(1));
    makeButton("Add", () => this.addObject());
    makeButton("Remove", () => this.removeSelected());
    makeButton("Reset", () => this.resetScene());

    this.controlsPanelEl = document.createElement("div");
    Object.assign(this.controlsPanelEl.style, {
      width: "100%",
      display: "none",
      gridTemplateColumns: "1fr",
      gap: "8px",
      marginTop: "8px",
    } as Partial<CSSStyleDeclaration>);

    this.gestureHintEl = document.createElement("div");
    this.gestureHintEl.textContent = "Swipe to move • Pinch to scale • Twist to rotate";
    Object.assign(this.gestureHintEl.style, {
      display: "none",
      width: "100%",
      marginTop: "8px",
      textAlign: "center",
      color: "rgba(255,255,255,0.78)",
      fontSize: "12px",
      fontWeight: "600",
      letterSpacing: "0.01em",
    } as Partial<CSSStyleDeclaration>);

    this.toolbarEl.appendChild(this.controlsPanelEl);
    this.toolbarEl.appendChild(this.gestureHintEl);
    el.appendChild(this.toolbarEl);
  }

  private setStatus(msg: string) {
    if (this.statusEl) this.statusEl.textContent = msg;
  }
}
