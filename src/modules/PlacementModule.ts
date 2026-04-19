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

  constructor(private selectedModel: ModelOption) {}

  async mount(parent: THREE.Object3D, context: ExperienceModuleContext): Promise<void> {
    this.context = context;
    parent.add(this.root);

    this.placement.mount(context.scene, context.renderer);

    this.loader.load(this.selectedModel.path, (gltf) => {
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
        return;
      }

      this.model.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(this.model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(maxDim) || maxDim <= 0) {
        console.warn("Placed GLB has invalid bounds");
        return;
      }

      const scale = this.selectedModel.placementScale ?? 1;
      this.model.scale.setScalar(scale);
      this.model.updateWorldMatrix(true, true);

      const scaledBox = new THREE.Box3().setFromObject(this.model);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      const minY = scaledBox.min.y;

      // Center horizontally and rest model on detected surface instead of cutting through it.
      this.model.position.sub(scaledCenter);
      this.model.position.y -= minY;

      this.model.visible = false;
      this.root.add(this.model);
    });

    context.element.addEventListener("start-ar", async () => {
      const result = await this.placement.startAR();
      if (!result.ok) {
        alert(result.reason || "AR failed to start");
        return;
      }

      this.canPlace = false;
      window.setTimeout(() => {
        this.canPlace = true;
      }, 500);
    });

    context.element.addEventListener("click", () => {
      if (!this.canPlace) return;
      if (!this.placement.isPlaced() && this.model) {
        const placed = this.placement.place(this.root);
        if (placed) {
          this.model.visible = true;
        }
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

  update(delta: number): void {
    if (this.context) {
      this.placement.update(this.context.camera);
    }
  }

  onDoubleTap(): void {}

  getGestureTarget(): THREE.Object3D {
    return this.root;
  }
}
