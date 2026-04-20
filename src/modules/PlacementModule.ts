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
  private template?: THREE.Object3D;
  private context?: ExperienceModuleContext;
  private canPlace = false;
  private statusEl?: HTMLDivElement;
  private toolbarEl?: HTMLDivElement;
  private startArHandler?: () => void;

  private mode: "move" | "rotate" | "scale" = "move";
  private scaleUp = true;

  private placedObjects: THREE.Group[] = [];
  private selectedObject?: THREE.Group;
  private pendingObject?: THREE.Group;

  constructor(private selectedModel: ModelOption) {}

  async mount(parent: THREE.Object3D, context: ExperienceModuleContext): Promise<void> {
    this.context = context;
    parent.add(this.root);

    this.createStatusOverlay(context.element);
    this.createToolbar(document.body);
    this.setMode("move");
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

      if (this.mode === "move") {
        this.moveSelectedToReticle();
      } else if (this.mode === "rotate") {
        this.selectedObject.rotation.y += Math.PI / 12;
        this.setStatus("Rotate: turned selected table 15°.");
      } else {
        const factor = this.scaleUp ? 1.15 : 1 / 1.15;
        const nextScale = THREE.MathUtils.clamp(this.selectedObject.scale.x * factor, 0.25, 4);
        this.selectedObject.scale.setScalar(nextScale);
        this.scaleUp = !this.scaleUp;
        this.setStatus(`Scale: ${nextScale.toFixed(2)}x`);
      }
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
      const result = await this.placement.startAR();
      if (!result.ok) {
        this.setStatus("AR failed to start. Try again.");
        return;
      }

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

    this.toolbarEl?.remove();
    this.statusEl?.remove();
    this.toolbarEl = undefined;
    this.statusEl = undefined;

    this.placedObjects = [];
    this.selectedObject = undefined;
    this.pendingObject = undefined;

    parent.remove(this.root);
    this.root.clear();
  }

  update(): void {
    if (!this.context) return;
    this.placement.update(this.context.camera);
  }

  onDoubleTap(): void {}

  getGestureTarget(): THREE.Object3D {
    return this.root;
  }

  private preparePendingObject() {
    if (!this.template || this.pendingObject) return;

    const group = new THREE.Group();
    const clone = this.template.clone(true);
    group.add(clone);
    this.root.add(group);
    this.pendingObject = group;
    this.selectedObject = group;
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
    this.selectedObject = this.pendingObject;
    this.pendingObject = undefined;
    this.setStatus("Table placed. Use toolbar: Move, Rotate, Scale, Add, Remove, Reset.");
  }

  private moveSelectedToReticle() {
    if (!this.selectedObject) {
      this.setStatus("No selected table to move.");
      return;
    }

    const pos = new THREE.Vector3();
    const ok = this.placement.getReticlePose(pos);
    if (!ok) {
      this.setStatus("Move: find the keyring first.");
      return;
    }

    this.selectedObject.position.copy(pos);
    this.setStatus("Move: selected table moved to the keyring.");
  }

  private setMode(mode: "move" | "rotate" | "scale") {
    this.mode = mode;
    this.updateToolbarState();
    this.setStatus(`Mode: ${mode.toUpperCase()}. Tap the screen to use this mode.`);
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
    this.placedObjects = this.placedObjects.filter((o) => o !== this.selectedObject);
    if (this.pendingObject === this.selectedObject) {
      this.pendingObject = undefined;
    }
    this.selectedObject = this.placedObjects.at(-1);
    this.setStatus("Selected table removed.");
  }

  private resetScene() {
    this.placedObjects.forEach((o) => this.root.remove(o));
    if (this.pendingObject) {
      this.root.remove(this.pendingObject);
    }

    this.placedObjects = [];
    this.pendingObject = undefined;
    this.selectedObject = undefined;

    if (this.canPlace) {
      this.preparePendingObject();
      this.setStatus("Scene reset. Tap the keyring to place a new table.");
    } else {
      this.setStatus("Scene reset.");
    }
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
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "9999",
      display: "flex",
      gap: "8px",
      flexWrap: "wrap",
      justifyContent: "center",
      padding: "10px",
      borderRadius: "18px",
      background: "rgba(14, 16, 30, 0.82)",
      backdropFilter: "blur(10px)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
    } as Partial<CSSStyleDeclaration>);

    const makeButton = (label: string, onClick: () => void, role?: string) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      if (role) btn.dataset.role = role;
      Object.assign(btn.style, {
        padding: "10px 14px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.06)",
        color: "white",
        fontSize: "13px",
        fontWeight: "600",
        cursor: "pointer",
      } as Partial<CSSStyleDeclaration>);
      btn.onclick = onClick;
      this.toolbarEl!.appendChild(btn);
    };

    makeButton("Move", () => this.setMode("move"), "move");
    makeButton("Rotate", () => this.setMode("rotate"), "rotate");
    makeButton("Scale", () => this.setMode("scale"), "scale");
    makeButton("Add", () => this.addObject());
    makeButton("Remove", () => this.removeSelected());
    makeButton("Reset", () => this.resetScene());

    el.appendChild(this.toolbarEl);
    this.updateToolbarState();
  }

  private updateToolbarState() {
    if (!this.toolbarEl) return;
    this.toolbarEl.querySelectorAll("button[data-role]").forEach((node) => {
      const btn = node as HTMLButtonElement;
      const active = btn.dataset.role === this.mode;
      btn.style.background = active ? "linear-gradient(135deg, #6a5cff, #00aaff)" : "rgba(255,255,255,0.06)";
      btn.style.borderColor = active ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.18)";
    });
  }

  private setStatus(msg: string) {
    if (this.statusEl) this.statusEl.textContent = msg;
  }
}
