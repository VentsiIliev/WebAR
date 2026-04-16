import * as THREE from "three";
import type { Pose } from "../tracking/Tracker";

export class Anchor {
  public readonly markerRoot = new THREE.Group();
  public readonly userGroup = new THREE.Group();

  constructor() {
    this.markerRoot.add(this.userGroup);
  }

  updatePose(pose: Pose): void {
    if (!pose.visible) {
      this.markerRoot.visible = false;
      return;
    }

    this.markerRoot.visible = true;
    this.markerRoot.position.set(...pose.position);
    this.markerRoot.rotation.set(...pose.rotation);
  }
}
