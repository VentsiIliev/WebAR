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
  private manipulating = false;
  private selectStartTime = 0;

  private startYaw = 0;
  private startRotationY = 0;
  private startDistance = 0;
  private startScale = 1;

  constructor(private selectedModel: ModelOption) {}

  async mount(parent: THREE.Object3D, context: ExperienceModuleContext): Promise<void> {
    this.context = context;
    parent.add(this.root);

    this.createStatusOverlay(context.element);
    this.setStatus(`Loading ${this.selectedModel.label}...`);

    this.placement.mount(context.scene, context.renderer);

    this.placement.setSelectHandler(() => {
      const duration = performance.now() - this.selectStartTime;

      if (!this.placement.isPlaced()) {
        this.tryPlace();
      } else if (duration < 200) {
        this.cycleMode();
      }
    });

    this.placement.setSelectStartHandler(() => {
      this.selectStartTime = performance.now();

      if (!this.placement.isPlaced() || !this.context) return;

      this.manipulating = true;

      const camera = this.context.camera;
      const pos = new THREE.Vector3();
      this.placement.getReticlePose(pos);

      if (this.mode === "rotate") {
        this.startYaw = this.getYaw(camera.quaternion);
        this.startRotationY = this.root.rotation.y;
      } else if (this.mode === "scale") {
        this.startDistance = camera.position.distanceTo(pos);
        this.startScale = this.root.scale.x;
      }
    });

    this.placement.setSelectEndHandler(() => {
      this.manipulating = false;
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

      this.setStatus("Tap to place. After: tap to switch mode, hold to manipulate.");
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

    if (!this.manipulating || !this.placement.isPlaced()) return;

    const pos = new THREE.Vector3();
    if (!this.placement.getReticlePose(pos)) return;

    if (this.mode === "move") {
      this.root.position.copy(pos);
    } else if (this.mode === "rotate") {
      const yaw = this.getYaw(this.context.camera.quaternion);
      this.root.rotation.y = this.startRotationY + (yaw - this.startYaw);
    } else if (this.mode === "scale") {
      const dist = this.context.camera.position.distanceTo(pos);
      const factor = dist / this.startDistance;
      this.root.scale.setScalar(THREE.MathUtils.clamp(this.startScale * factor, 0.2, 5));
    }
  }

  private tryPlace() {
    if (!this.canPlace || !this.model) return;
    const placed = this.placement.place(this.root);
    if (placed) this.model.visible = true;
  }

  private cycleMode() {
    this.mode = this.mode === "move" ? "rotate" : this.mode === "rotate" ? "scale" : "move";
    this.setStatus(`Mode: ${this.mode}`);
  }

  private getYaw(q: THREE.Quaternion): number {
    const e = new THREE.Euler().setFromQuaternion(q, "YXZ");
    return e.y;
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
