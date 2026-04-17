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
  private isExplodeTransitioning = false;
  private readonly explodeDurationMs = 400;
  private isShuffled = true;

  private readonly initialTransforms = new Map<string, {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
  }>();

  mount(parent: THREE.Object3D, context: ExperienceModuleContext): void {
    this.context = context;

    const size = 0.12;
    const gap = 0.02;
    const spacing = size + gap;

    const colors = {
      white: 0xffffff,
      yellow: 0xffff00,
      red: 0xff0000,
      orange: 0xff7f00,
      blue: 0x0000ff,
      green: 0x00ff00,
      black: 0x111111,
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
          cube.position.set(x * spacing, y * spacing, z * spacing);
          cube.userData.grid = new THREE.Vector3(x, y, z);
          this.root.add(cube);
        }
      }
    }

    parent.add(this.root);

    this.captureInitialTransforms();
    this.shuffleInstant(12);
    this.refreshExplodeRegistration();

    context.element.addEventListener("pointerup", this.onPointerUp);
  }

  unmount(parent: THREE.Object3D): void {
    this.context.element.removeEventListener("pointerup", this.onPointerUp);
    parent.remove(this.root);
    this.root.clear();
    this.initialTransforms.clear();
  }

  update(deltaMs: number): void {
    this.explode.update(deltaMs);
  }

  onDoubleTap(): void {
    if (this.isTurning || this.isExplodeTransitioning) return;

    if (!this.explode.isExploded()) {
      this.isExplodeTransitioning = true;
      this.explode.explode();
      window.setTimeout(() => {
        this.isExplodeTransitioning = false;
      }, this.explodeDurationMs);
      return;
    }

    this.isExplodeTransitioning = true;
    this.explode.collapse();

    window.setTimeout(() => {
      if (this.isShuffled) {
        this.solveInstant();
        this.isShuffled = false;
      } else {
        this.shuffleInstant(12);
        this.isShuffled = true;
      }

      this.refreshExplodeRegistration();
      this.isExplodeTransitioning = false;
    }, this.explodeDurationMs + 10);
  }

  getGestureTarget(): THREE.Object3D {
    return this.root;
  }

  private onPointerUp = (event: PointerEvent) => {
    if (this.isTurning || this.isExplodeTransitioning || this.explode.isExploded()) return;

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

    const grid = cube.userData.grid as THREE.Vector3;

    if (Math.abs(normal.x) > 0.9) {
      this.rotateLayerAnimated("x", grid.x, normal.x > 0 ? 1 : -1);
    } else if (Math.abs(normal.y) > 0.9) {
      this.rotateLayerAnimated("y", grid.y, normal.y > 0 ? 1 : -1);
    } else if (Math.abs(normal.z) > 0.9) {
      this.rotateLayerAnimated("z", grid.z, normal.z > 0 ? 1 : -1);
    }
  };

  private rotateLayerAnimated(axis: "x" | "y" | "z", index: number, dir: number) {
    this.isTurning = true;

    const group = new THREE.Group();
    this.root.add(group);

    const selected = this.getLayer(axis, index);
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
        });

        this.root.remove(group);
        this.snapLayerState(selected, axis, dir);
        this.refreshExplodeRegistration();
        this.isTurning = false;
      }
    };

    animate();
  }

  private rotateLayerInstant(axis: "x" | "y" | "z", index: number, dir: number) {
    const group = new THREE.Group();
    this.root.add(group);

    const selected = this.getLayer(axis, index);
    selected.forEach((cube) => group.attach(cube));

    group.rotation[axis] = dir * Math.PI / 2;

    selected.forEach((cube) => {
      this.root.attach(cube);
    });

    this.root.remove(group);
    this.snapLayerState(selected, axis, dir);
  }

  private getLayer(axis: "x" | "y" | "z", index: number): THREE.Object3D[] {
    return this.root.children.filter((cube) => {
      const grid = cube.userData.grid as THREE.Vector3;
      return Math.round(grid[axis]) === Math.round(index);
    });
  }

  private snapLayerState(selected: THREE.Object3D[], axis: "x" | "y" | "z", dir: number) {
    const rotation = new THREE.Matrix4();
    rotation.makeRotationAxis(
      axis === "x"
        ? new THREE.Vector3(1, 0, 0)
        : axis === "y"
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1),
      dir * Math.PI / 2
    );

    for (const cube of selected) {
      const grid = (cube.userData.grid as THREE.Vector3).clone();
      grid.applyMatrix4(rotation);
      grid.set(Math.round(grid.x), Math.round(grid.y), Math.round(grid.z));
      cube.userData.grid = grid;
      cube.position.copy(this.gridToWorld(grid));
    }
  }

  private gridToWorld(grid: THREE.Vector3): THREE.Vector3 {
    const size = 0.12;
    const gap = 0.02;
    const spacing = size + gap;
    return new THREE.Vector3(grid.x * spacing, grid.y * spacing, grid.z * spacing);
  }

  private captureInitialTransforms() {
    this.initialTransforms.clear();
    this.root.children.forEach((cube) => {
      this.initialTransforms.set(cube.uuid, {
        position: cube.position.clone(),
        quaternion: cube.quaternion.clone(),
      });
    });
  }

  private solveInstant() {
    this.root.children.forEach((cube) => {
      const initial = this.initialTransforms.get(cube.uuid);
      if (!initial) return;

      cube.position.copy(initial.position);
      cube.quaternion.copy(initial.quaternion);

      const size = 0.12;
      const gap = 0.02;
      const spacing = size + gap;
      cube.userData.grid = new THREE.Vector3(
        Math.round(initial.position.x / spacing),
        Math.round(initial.position.y / spacing),
        Math.round(initial.position.z / spacing)
      );
    });
  }

  private shuffleInstant(moveCount: number) {
    this.solveInstant();

    const axes: Array<"x" | "y" | "z"> = ["x", "y", "z"];
    const indices = [-1, 0, 1];
    const dirs = [-1, 1];

    for (let i = 0; i < moveCount; i++) {
      const axis = axes[Math.floor(Math.random() * axes.length)];
      const index = indices[Math.floor(Math.random() * indices.length)];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      this.rotateLayerInstant(axis, index, dir);
    }
  }

  private refreshExplodeRegistration() {
    this.explode.register(this.root, { distanceMultiplier: 0.3, durationMs: this.explodeDurationMs });
  }
}
