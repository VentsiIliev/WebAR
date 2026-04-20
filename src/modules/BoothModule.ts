import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ExperienceModule, ExperienceModuleContext } from "./ExperienceModule";
import { BOOTH_CONFIG } from "../booth/boothConfig";

export class BoothModule implements ExperienceModule {
  readonly mode = "booth" as const;

  private root = new THREE.Group();
  private loader = new GLTFLoader();
  private context?: ExperienceModuleContext;
  private isMounted = false;

  mount(parent: THREE.Object3D, context: ExperienceModuleContext): void {
    this.context = context;
    this.isMounted = true;

    parent.add(this.root);
    this.root.clear();

    this.loadBooth();
  }

  private loadBooth() {
    this.loader.load(
      BOOTH_CONFIG.path,
      (gltf) => {
        if (!this.isMounted) return;

        const booth = gltf.scene;

        // normalize + scale
        const box = new THREE.Box3().setFromObject(booth);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        booth.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = BOOTH_CONFIG.scale ?? 1;

        if (maxDim > 0) {
          booth.scale.setScalar(scale / maxDim);
        }

        this.root.add(booth);

        this.setupCamera();
      },
      undefined,
      (err) => {
        console.error("Booth load failed", err);
      }
    );
  }

  private setupCamera() {
    if (!this.context) return;

    const cam = this.context.camera as THREE.PerspectiveCamera;

    cam.position.set(0, 1.6, 3);
    cam.lookAt(0, 1, 0);
  }

  unmount(parent: THREE.Object3D): void {
    this.isMounted = false;
    parent.remove(this.root);
    this.root.clear();
  }

  update(): void {}

  onDoubleTap(): void {}

  getGestureTarget(): THREE.Object3D {
    return this.root;
  }
}
