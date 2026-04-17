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

    // Rubik cube style 3x3x3
    const group = new THREE.Group();

    const size = 0.12;
    const gap = 0.02;

    const colors = {
      white: 0xffffff,
      yellow: 0xffff00,
      red: 0xff0000,
      orange: 0xff7f00,
      blue: 0x0000ff,
      green: 0x00ff00,
      black: 0x111111
    };

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const materials = [
            new THREE.MeshStandardMaterial({ color: x === 1 ? colors.red : colors.black }),
            new THREE.MeshStandardMaterial({ color: x === -1 ? colors.orange : colors.black }),
            new THREE.MeshStandardMaterial({ color: y === 1 ? colors.white : colors.black }),
            new THREE.MeshStandardMaterial({ color: y === -1 ? colors.yellow : colors.black }),
            new THREE.MeshStandardMaterial({ color: z === 1 ? colors.green : colors.black }),
            new THREE.MeshStandardMaterial({ color: z === -1 ? colors.blue : colors.black }),
          ];

          const cube = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), materials);
          cube.position.set(x * (size + gap), y * (size + gap), z * (size + gap));
          group.add(cube);
        }
      }
    }

    this.anchor.userGroup.add(group);

    this.explode.register(group, { distanceMultiplier: 0.3 });
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
