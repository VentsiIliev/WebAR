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
  private readonly modelPath: string;

  constructor(modelPath = "/models/cobot.glb") {
    this.modelPath = modelPath;
  }

  mount(parent: THREE.Object3D, _context: ExperienceModuleContext): void {
    this.isMounted = true;
    this.root.clear();
    this.root.visible = true;
    parent.add(this.root);

    // Always show something immediately
    this.placeholder = this.createPlaceholder();
    this.root.add(this.placeholder);
    this.explode.register(this.placeholder);
    console.log("GenericModelModule mounted, placeholder visible");

    this.loader.load(
      this.modelPath,
      (gltf) => {
        if (!this.isMounted) {
          console.log(`${this.modelPath} loaded but module unmounted, ignoring`);
          return;
        }

        console.log(`${this.modelPath} loaded successfully`);
        const model = gltf.scene;

        let meshCount = 0;
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            meshCount++;
            child.frustumCulled = false;
          }
        });

        console.log(`${this.modelPath} meshes found:`, meshCount);

        if (meshCount === 0) {
          console.warn("GLB has no meshes, keeping placeholder");
          return;
        }

        model.updateWorldMatrix(true, true);

        const originalBox = new THREE.Box3().setFromObject(model);
        const originalCenter = originalBox.getCenter(new THREE.Vector3());
        const originalSize = originalBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(originalSize.x, originalSize.y, originalSize.z);

        if (!Number.isFinite(maxDim) || maxDim <= 0) {
          console.warn("Invalid GLB bounds, keeping placeholder");
          return;
        }

        const scale = Math.min(2.2 / maxDim, 4);
        model.scale.setScalar(scale);
        model.updateWorldMatrix(true, true);

        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

        model.position.sub(scaledCenter);
        this.root.position.set(0, 0, 0);

        model.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;

          const applyMaterial = (material: THREE.Material) => {
            material.side = THREE.DoubleSide;
            material.needsUpdate = true;
          };

          if (Array.isArray(child.material)) {
            child.material.forEach(applyMaterial);
          } else {
            applyMaterial(child.material);
          }
        });

        if (this.placeholder) {
          this.root.remove(this.placeholder);
          this.placeholder = null;
          console.log("Placeholder removed, adding model");
        }

        this.root.add(model);
        this.explode.register(model);
        console.log(`${this.modelPath} added to scene`);
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
