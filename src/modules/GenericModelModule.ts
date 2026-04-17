import * as THREE from "three";
import { ModelExplodeController } from "../interaction/ExplodeController";
import type { ExperienceModule, ExperienceModuleContext } from "./ExperienceModule";

export class GenericModelModule implements ExperienceModule {
  readonly mode = "model" as const;

  private root = new THREE.Group();
  private explode = new ModelExplodeController();

  mount(parent: THREE.Object3D, _context: ExperienceModuleContext): void {
    const material = new THREE.MeshStandardMaterial({ color: 0x00ffcc });

    const parts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.2, 0, 0),
      new THREE.Vector3(-0.2, 0, 0),
      new THREE.Vector3(0, 0.2, 0),
      new THREE.Vector3(0, -0.2, 0),
    ];

    for (const pos of parts) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), material);
      mesh.position.copy(pos);
      this.root.add(mesh);
    }

    parent.add(this.root);
    this.explode.register(this.root);
  }

  unmount(parent: THREE.Object3D): void {
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
