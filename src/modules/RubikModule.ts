import * as THREE from "three";
import { ModelExplodeController } from "../interaction/ExplodeController";
import type { ExperienceModule, ExperienceModuleContext } from "./ExperienceModule";

export class RubikModule implements ExperienceModule {
  readonly mode = "rubik" as const;

  private root = new THREE.Group();
  private explode = new ModelExplodeController();

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  private context!: ExperienceModuleContext;
  private isTurning = false;

  mount(parent: THREE.Object3D, context: ExperienceModuleContext): void {
    this.context = context;

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
          cube.position.set(x, y, z);
          this.root.add(cube);
        }
      }
    }

    parent.add(this.root);
    this.explode.register(this.root, { distanceMultiplier: 0.3 });

    context.element.addEventListener("pointerup", this.onPointerUp);
  }

  unmount(parent: THREE.Object3D): void {
    this.context.element.removeEventListener("pointerup", this.onPointerUp);
    parent.remove(this.root);
    this.root.clear();
  }

  update(deltaMs: number): void {
    this.explode.update(deltaMs);
  }

  onDoubleTap(): void {
    // disabled for rubik
  }

  getGestureTarget(): THREE.Object3D {
    return this.root;
  }

  private onPointerUp = (event: PointerEvent) => {
    if (this.isTurning) return;

    const rect = this.context.element.getBoundingClientRect();

    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.context.camera);

    const intersects = this.raycaster.intersectObjects(this.root.children);

    if (intersects.length === 0) return;

    const hit = intersects[0];
    const cube = hit.object as THREE.Mesh;
    const normal = hit.face?.normal;

    if (!normal) return;

    const pos = cube.position.clone();

    if (Math.abs(normal.x) > 0.9) {
      this.rotateLayer("x", pos.x, normal.x > 0 ? 1 : -1);
    } else if (Math.abs(normal.y) > 0.9) {
      this.rotateLayer("y", pos.y, normal.y > 0 ? 1 : -1);
    } else if (Math.abs(normal.z) > 0.9) {
      this.rotateLayer("z", pos.z, normal.z > 0 ? 1 : -1);
    }
  };

  private rotateLayer(axis: "x" | "y" | "z", index: number, dir: number) {
    this.isTurning = true;

    const group = new THREE.Group();
    this.root.add(group);

    const selected: THREE.Object3D[] = [];

    this.root.children.forEach((cube) => {
      const p = cube.position;
      if (Math.round(p[axis]) === Math.round(index)) {
        selected.push(cube);
      }
    });

    selected.forEach((cube) => group.attach(cube));

    const target = dir * Math.PI / 2;
    let progress = 0;

    const animate = () => {
      progress += 0.1;
      group.rotation[axis] = progress * target;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        selected.forEach((cube) => {
          this.root.attach(cube);
          cube.position.round();
          cube.rotation.set(0,0,0);
        });

        this.root.remove(group);
        this.isTurning = false;
      }
    };

    animate();
  }
}
