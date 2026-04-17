import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ModelExplodeController } from "../interaction/ExplodeController";
import type { ExperienceModule, ExperienceModuleContext } from "./ExperienceModule";

export class GenericModelModule implements ExperienceModule {
  readonly mode = "model" as const;

  private root = new THREE.Group();
  private explode = new ModelExplodeController();
  private loader = new GLTFLoader();
  private isMounted = false;

  mount(parent: THREE.Object3D, _context: ExperienceModuleContext): void {
    this.isMounted = true;
    parent.add(this.root);

    this.loader.load(
      "/models/disk.glb",
      (gltf) => {
        if (!this.isMounted) return;

        const model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        model.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const safeScale = maxDim > 0 ? 0.5 / maxDim : 1;
        model.scale.setScalar(safeScale);

        this.root.add(model);
        this.explode.register(model, { distanceMultiplier: 0.3 });
      },
      undefined,
      (error) => {
        console.error("GLB load failed:", error);

        if (!this.isMounted) return;

        const fallback = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.3, 0.3),
          new THREE.MeshStandardMaterial({ color: 0xff0000 })
        );

        this.root.add(fallback);
        this.explode.register(fallback);
      }
    );
  }

  unmount(parent: THREE.Object3D): void {
    this.isMounted = false;
    parent.remove(this.root);
    this.root.clear();
  }

  update(deltaMs: number): void {
    this.explode.update(deltaMs);
  }

  onDoubleTap(): void {
    this.explode.toggle();
  }

  getGestureTarget(): THREE.Object3D {
    return this.root;
  }
}
