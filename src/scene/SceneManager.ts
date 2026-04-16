import * as THREE from "three";
import { Anchor } from "./Anchor";
import type { Pose } from "../tracking/Tracker";
import { ModelExplodeController } from "../interaction/ExplodeController";

export class SceneManager {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
  private renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

  private anchor = new Anchor();
  private explode = new ModelExplodeController();

  private lastTime = performance.now();

  constructor(container: HTMLElement) {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene.add(this.anchor.markerRoot);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    this.scene.add(light);

    this.camera.position.z = 2;

    // Create demo multi-part "machine"
    const group = new THREE.Group();

    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

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
      group.add(mesh);
    }

    this.anchor.userGroup.add(group);

    // Register explode controller
    this.explode.register(group);
  }

  getAnchor() {
    return this.anchor;
  }

  toggleExplode() {
    this.explode.toggle();
  }

  updatePose(pose: Pose) {
    this.anchor.updatePose(pose);
  }

  render() {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;

    this.explode.update(delta);

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
