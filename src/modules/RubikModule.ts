import * as THREE from "three";
import { ModelExplodeController } from "../interaction/ExplodeController";
import type { ExperienceModule } from "./ExperienceModule";

export class RubikModule implements ExperienceModule {
  readonly mode = "rubik" as const;

  private root = new THREE.Group();
  private explode = new ModelExplodeController();

  mount(parent: THREE.Object3D): void {
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
          this.root.add(cube);
        }
      }
    }

    parent.add(this.root);
    this.explode.register(this.root, { distanceMultiplier: 0.3 });
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
