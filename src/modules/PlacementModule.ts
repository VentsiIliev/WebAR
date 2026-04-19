import * as THREE from "three";
import type { ExperienceModule, ExperienceModuleContext } from "./ExperienceModule";
import { PlacementController } from "../placement/PlacementController";

export class PlacementModule implements ExperienceModule {
  readonly mode = "model" as const; // reuse model mode for now

  private root = new THREE.Group();
  private placement = new PlacementController();

  mount(parent: THREE.Object3D, context: ExperienceModuleContext): void {
    parent.add(this.root);

    this.placement.mount(parent as THREE.Scene);

    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x00ffcc })
    );

    this.root.add(cube);

    context.element.addEventListener("click", () => {
      if (!this.placement.isPlaced()) {
        this.placement.place(this.root);
      }
    });
  }

  unmount(parent: THREE.Object3D): void {
    this.placement.unmount(parent as THREE.Scene);
    parent.remove(this.root);
    this.root.clear();
  }

  update(deltaMs: number): void {
    // camera needed for proper update
  }

  onDoubleTap(): void {}

  getGestureTarget(): THREE.Object3D {
    return this.root;
  }
}
