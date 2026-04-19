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

  private mode: "move" | "rotate" | "scale" = "move";
  private scaleUp = true;

  constructor(private selectedModel: ModelOption) {}

  async mount(parent: THREE.Object3D, context: ExperienceModuleContext): Promise<void> {
    this.context = context;
    parent.add(this.root);

    this.createStatusOverlay(context.element);
    this.setStatus("Loading table…");

    this.placement.mount(context.scene, context.renderer);

    this.placement.setSelectHandler(() => {
      if (!this.placement.isPlaced()) {
        this.tryPlace();
        return;
      }

      if (this.mode === "move") {
        this.moveToReticle();
      } else if (this.mode === "rotate") {
        this.root.rotation.y += Math.PI / 12;
        this.setStatus("Rotate mode: tapped to turn the table 15°.");
      } else {
        const factor = this.scaleUp ? 1.15 : 1 / 1.15;
        this.root.scale.setScalar(THREE.MathUtils.clamp(this.root.scale.x * factor, 0.25, 4));
        this.scaleUp = !this.scaleUp;
        this.setStatus("Scale mode: tapped to resize the table.");
      }
    });

    this.loader.load(this.selectedModel.path, (gltf) => {
      this.model = gltf.scene;

      this.model.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(this.model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      const target = (this.selectedModel as ModelOption & { placementTargetSize?: number }).placementTargetSize ?? 1;
      this.model.scale.setScalar(target / maxDim);

      const center = box.getCenter(new THREE.Vector3());
      this.model.position.sub(center);

      this.model.visible = false;
      this.root.add(this.model);

      this.setStatus("AR ready. Press Start AR, move your phone until you see the keyring, then tap the keyring to place the table.");
    });

    this.startArHandler = async () => {
      this.setStatus("Starting AR… Point your phone at the floor or a table surface.");
      const result = await this.placement.startAR();
      if (!result.ok) {
        this.setStatus("AR failed to start. Try again.");
        return;
      }

      this.canPlace = false;
      this.setStatus("Move your phone slowly until the keyring appears, then tap the keyring to place the table.");
      setTimeout(() => {
        this.canPlace = true;
        this.setStatus("Keyring ready: tap the keyring to place the table.");
      }, 500);
    };

    context.element.addEventListener("start-ar", this.startArHandler);
  }

  update(): void {
    if (!this.context) return;
    this.placement.update(this.context.camera);
  }

  onDoubleTap(): void {
    if (!this.placement.isPlaced()) return;

    this.mode = this.mode === "move" ? "rotate" : this.mode === "rotate" ? "scale" : "move";
    this.setStatus(`Mode: ${this.mode.toUpperCase()}. Double tap to change mode again.`);
  }

  getGestureTarget(): THREE.Object3D {
    return this.root;
  }

  private tryPlace() {
    if (!this.canPlace || !this.model) {
      this.setStatus("Wait for the keyring, then tap the keyring to place the table.");
      return;
    }
    const placed = this.placement.place(this.root);
    if (placed) {
      this.model.visible = true;
      this.setStatus("Table placed. Tap to use the current mode. Double tap to switch mode.");
    } else {
      this.setStatus("No valid keyring yet. Move your phone until the keyring locks onto a surface, then tap it.");
    }
  }

  private moveToReticle() {
    const pos = new THREE.Vector3();
    const ok = this.placement.getReticlePose(pos);
    if (!ok) {
      this.setStatus("Move mode: find the keyring first, then tap to move the table there.");
      return;
    }
    this.root.position.copy(pos);
    this.setStatus("Move mode: table moved to the keyring.");
  }

  private createStatusOverlay(el: HTMLElement) {
    this.statusEl = document.createElement("div");
    this.statusEl.style.position = "absolute";
    this.statusEl.style.left = "16px";
    this.statusEl.style.right = "16px";
    this.statusEl.style.bottom = "20px";
    this.statusEl.style.zIndex = "1000";
    this.statusEl.style.padding = "14px 16px";
    this.statusEl.style.borderRadius = "16px";
    this.statusEl.style.background = "rgba(14, 16, 30, 0.82)";
    this.statusEl.style.backdropFilter = "blur(10px)";
    this.statusEl.style.color = "white";
    this.statusEl.style.fontSize = "15px";
    this.statusEl.style.lineHeight = "1.4";
    this.statusEl.style.fontWeight = "500";
    this.statusEl.style.boxShadow = "0 8px 24px rgba(0,0,0,0.28)";
    this.statusEl.style.pointerEvents = "none";
    el.appendChild(this.statusEl);
  }

  private setStatus(msg: string) {
    if (this.statusEl) this.statusEl.textContent = msg;
  }
}
