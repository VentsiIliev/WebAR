import * as THREE from "three";
import { createReticle } from "./Reticle";

export class PlacementController {
  private reticle = createReticle();
  private placed = false;

  mount(scene: THREE.Scene) {
    scene.add(this.reticle);
  }

  unmount(scene: THREE.Scene) {
    scene.remove(this.reticle);
  }

  update(camera: THREE.Camera) {
    if (this.placed) return;

    // Stage 1: place reticle 1 meter in front of camera
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const position = camera.position.clone().add(forward.multiplyScalar(1));

    this.reticle.visible = true;
    this.reticle.position.copy(position);
    this.reticle.quaternion.copy(camera.quaternion);
  }

  place(target: THREE.Object3D) {
    if (!this.reticle.visible) return;

    target.position.copy(this.reticle.position);
    target.quaternion.copy(this.reticle.quaternion);

    this.placed = true;
    this.reticle.visible = false;
  }

  isPlaced(): boolean {
    return this.placed;
  }
}
