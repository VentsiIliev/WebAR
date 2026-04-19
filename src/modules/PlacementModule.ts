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
    this.setStatus(`Loading ${this.selectedModel.label}...`);

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
        this.setStatus("Rotate +15°");
      } else {
        const factor = this.scaleUp ? 1.15 : 1 / 1.15;
        this.root.scale.setScalar(THREE.MathUtils.clamp(this.root.scale.x * factor, 0.25, 4));
        this.scaleUp = !this.scaleUp;
        this.setStatus("Scale step");
      }
    });

    this.loader.load(this.selectedModel.path, (gltf) => {
      this.model = gltf.scene;

      this.model.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(this.model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      const target = this.selectedModel.placementTargetSize ?? 1;
      this.model.scale.setScalar(target / maxDim);

      const center = box.getCenter(new THREE.Vector3());
      this.model.position.sub(center);

      this.model.visible = false;
      this.root.add(this.model);

      this.setStatus("Tap to place. Double tap to change mode.");
    });

    this.startArHandler = async () => {
      const result = await this.placement.startAR();
      if (!result.ok) return;

      this.canPlace = false;
      setTimeout(() => (this.canPlace = true), 500);
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
    this.setStatus(`Mode: ${this.mode}`);
  }

  getGestureTarget(): THREE.Object3D {
    return this.root;
  }

  private tryPlace() {
    if (!this.canPlace || !this.model) return;
    const placed = this.placement.place(this.root);
    if (placed) this.model.visible = true;
  }

  private moveToReticle() {
    const pos = new THREE.Vector3();
    const ok = this.placement.getReticlePose(pos);
    if (!ok) return;
    this.root.position.copy(pos);
    this.setStatus("Moved");
  }

  private createStatusOverlay(el: HTMLElement) {
    this.statusEl = document.createElement("div");
    this.statusEl.style.position = "absolute";
    this.statusEl.style.bottom = "20px";
    this.statusEl.style.left = "20px";
    this.statusEl.style.color = "white";
    el.appendChild(this.statusEl);
  }

  private setStatus(msg: string) {
    if (this.statusEl) this.statusEl.textContent = msg;
  }
}
