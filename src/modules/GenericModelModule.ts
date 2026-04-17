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
  private placeholder: THREE.Object3D | null = null;

  mount(parent: THREE.Object3D, _context: ExperienceModuleContext): void {
    this.isMounted = true;
    this.root.clear();
    parent.add(this.root);

    // Always show something immediately
    this.placeholder = this.createPlaceholder();
    this.root.add(this.placeholder);
    this.explode.register(this.placeholder);

    this.loader.load(
      "/models/disk.glb",
      (gltf) => {
        if (!this.isMounted) return;

        const model = gltf.scene;

        let meshCount = 0;
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            meshCount++;
            child.frustumCulled = false;
          }
        });

        if (meshCount === 0) {
          console.warn("GLB has no meshes, keeping placeholder");
          return;
        }

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        if (!Number.isFinite(maxDim) || maxDim <= 0) {
          console.warn("Invalid GLB bounds, keeping placeholder");
          return;
        }

        model.position.sub(center);
        model.scale.setScalar(0.6 / maxDim);

        if (this.placeholder) {
          this.root.remove(this.placeholder);
          this.placeholder = null;
        }

        this.root.add(model);
        this.explode.register(model);
      },
      undefined,
      (error) => {
        console.error("GLB load failed:", error);
      }
    );
  }

  unmount(parent: THREE.Object3D): void {
    this.isMounted = false;
    this.placeholder = null;
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

  private createPlaceholder(): THREE.Object3D {
    const group = new THREE.Group();

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.08, 32),
      new THREE.MeshStandardMaterial({ color: 0x3399ff })
    );
    group.add(base);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: 0xffaa33 })
    );
    hub.rotation.x = Math.PI / 2;
    group.add(hub);

    return group;
  }
}
