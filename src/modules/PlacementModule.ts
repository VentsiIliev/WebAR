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

  constructor(private selectedModel: ModelOption) {}

  async mount(parent: THREE.Object3D, context: ExperienceModuleContext): Promise<void> {
    this.context = context;

    parent.add(this.root);

    await this.placement.mount(context.scene, context.renderer);

    this.loader.load(this.selectedModel.path, (gltf) => {
      this.model = gltf.scene;

      const scale = this.selectedModel.placementScale ?? 1;
      this.model.scale.setScalar(scale);

      this.model.visible = false;
      this.root.add(this.model);
    });

    context.element.addEventListener("click", () => {
      if (!this.placement.isPlaced() && this.model) {
        this.placement.place(this.root);
        this.model.visible = true;
      }
    });
  }

  unmount(parent: THREE.Object3D): void {
    if (this.context) {
      this.placement.unmount(this.context.scene);
    }

    parent.remove(this.root);
    this.root.clear();
  }

  update(): void {
    this.placement.update();
  }

  onDoubleTap(): void {}

  getGestureTarget(): THREE.Object3D {
    return this.root;
  }
}
