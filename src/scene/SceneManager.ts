import * as THREE from "three";
import { Anchor } from "./Anchor";
import type { Pose } from "../tracking/Tracker";

export class SceneManager {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
  private renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

  private anchor = new Anchor();

  constructor(container: HTMLElement) {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene.add(this.anchor.markerRoot);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    this.scene.add(light);

    this.camera.position.z = 2;
  }

  getAnchor() {
    return this.anchor;
  }

  updatePose(pose: Pose) {
    this.anchor.updatePose(pose);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    const loop = () => {
      this.render();
      requestAnimationFrame(loop);
    };
    loop();
  }
}
