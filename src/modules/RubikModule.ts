import * as THREE from "three";
import { ModelExplodeController } from "../interaction/ExplodeController";
import type { ExperienceModule, ExperienceModuleContext } from "./ExperienceModule";

type Axis = "x" | "y" | "z";

interface PendingFaceTurn {
  grid: THREE.Vector3;
  normal: THREE.Vector3;
}

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

  private activePointerId: number | null = null;
  private pointerDownPos = new THREE.Vector2();
  private lastPointerPos = new THREE.Vector2();
  private didDrag = false;
  private lastTap = 0;
  private tapTimeout: number | null = null;
  private pendingFaceTurn: PendingFaceTurn | null = null;
  private startedOnCube = false;

  private activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchDistance: number | null = null;

  private readonly initialTransforms = new Map<string, {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
  }>();

  mount(parent: THREE.Object3D, context: ExperienceModuleContext): void {
    this.context = context;
    this.context.element.style.touchAction = "none";

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

    context.element.addEventListener("pointerdown", this.onPointerDown);
    context.element.addEventListener("pointermove", this.onPointerMove);
    context.element.addEventListener("pointerup", this.onPointerUp);
    context.element.addEventListener("pointercancel", this.onPointerCancel);
  }

  unmount(parent: THREE.Object3D): void {
    this.context.element.removeEventListener("pointerdown", this.onPointerDown);
    this.context.element.removeEventListener("pointermove", this.onPointerMove);
    this.context.element.removeEventListener("pointerup", this.onPointerUp);
    this.context.element.removeEventListener("pointercancel", this.onPointerCancel);
    if (this.tapTimeout !== null) {
      window.clearTimeout(this.tapTimeout);
      this.tapTimeout = null;
    }
    this.activePointers.clear();
    this.lastPinchDistance = null;
    parent.remove(this.root);
    this.root.clear();
    this.initialTransforms.clear();
    this.pendingFaceTurn = null;
    this.startedOnCube = false;
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

  private onPointerDown = (event: PointerEvent) => {
    if (this.isTurning || this.isExplodeTransitioning) return;

    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 1) {
      this.activePointerId = event.pointerId;
      this.pointerDownPos.set(event.clientX, event.clientY);
      this.lastPointerPos.set(event.clientX, event.clientY);
      this.didDrag = false;
      this.pendingFaceTurn = this.pickFace(event.clientX, event.clientY);
      this.startedOnCube = this.pendingFaceTurn !== null;
    } else if (this.activePointers.size === 2) {
      this.activePointerId = null;
      this.pendingFaceTurn = null;
      this.startedOnCube = false;
      this.didDrag = false;
      if (this.tapTimeout !== null) {
        window.clearTimeout(this.tapTimeout);
        this.tapTimeout = null;
      }
      const [a, b] = Array.from(this.activePointers.values());
      this.lastPinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    }

    this.context.element.setPointerCapture?.(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.activePointers.has(event.pointerId)) return;
    if (this.isTurning || this.isExplodeTransitioning) return;

    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 2) {
      const [a, b] = Array.from(this.activePointers.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);

      if (this.lastPinchDistance !== null) {
        const delta = distance - this.lastPinchDistance;
        const nextScale = THREE.MathUtils.clamp(this.root.scale.x + delta * 0.005, 0.5, 2.5);
        this.root.scale.setScalar(nextScale);
      }

      this.lastPinchDistance = distance;
      this.pendingFaceTurn = null;
      this.startedOnCube = false;
      this.didDrag = false;
      return;
    }

    if (this.activePointerId !== event.pointerId) return;

    const dx = event.clientX - this.lastPointerPos.x;
    const dy = event.clientY - this.lastPointerPos.y;
    const totalDx = event.clientX - this.pointerDownPos.x;
    const totalDy = event.clientY - this.pointerDownPos.y;
    const dragDistance = Math.hypot(totalDx, totalDy);

    if (dragDistance > 6) {
      this.didDrag = true;
      if (this.tapTimeout !== null) {
        window.clearTimeout(this.tapTimeout);
        this.tapTimeout = null;
      }
    }

    if (this.didDrag && this.pendingFaceTurn && !this.explode.isExploded()) {
      const turn = this.resolveDragTurn(this.pendingFaceTurn.normal, totalDx, totalDy);
      if (turn) {
        const { axis, dir } = turn;
        const index = this.pendingFaceTurn.grid[axis];
        this.pendingFaceTurn = null;
        this.startedOnCube = false;
        this.rotateLayerAnimated(axis, index, dir);
        this.lastPointerPos.set(event.clientX, event.clientY);
        return;
      }

      this.lastPointerPos.set(event.clientX, event.clientY);
      return;
    }

    if (this.didDrag && !this.startedOnCube) {
      this.root.rotation.y += dx * 0.01;
      this.root.rotation.x += dy * 0.01;
      const maxTilt = Math.PI / 3;
      this.root.rotation.x = THREE.MathUtils.clamp(this.root.rotation.x, -maxTilt, maxTilt);
    }

    this.lastPointerPos.set(event.clientX, event.clientY);
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.activePointers.has(event.pointerId)) return;

    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size < 2) {
      this.lastPinchDistance = null;
    }

    // Release pointer capture to allow other elements (like the button) to receive events
    this.context.element.releasePointerCapture?.(event.pointerId);

    if (this.activePointers.size > 0) {
      return;
    }

    if (this.activePointerId !== null && this.activePointerId !== event.pointerId) return;

    this.activePointerId = null;

    if (this.isTurning || this.isExplodeTransitioning) return;

    if (this.didDrag) {
      this.didDrag = false;
      this.pendingFaceTurn = null;
      this.startedOnCube = false;
      return;
    }

    const now = Date.now();
    if (now - this.lastTap < 300) {
      this.lastTap = 0;
      if (this.tapTimeout !== null) {
        window.clearTimeout(this.tapTimeout);
        this.tapTimeout = null;
      }
      this.pendingFaceTurn = null;
      this.startedOnCube = false;
      this.onDoubleTap();
      return;
    }
    this.lastTap = now;

    this.tapTimeout = window.setTimeout(() => {
      this.tapTimeout = null;
      this.pendingFaceTurn = null;
      this.startedOnCube = false;
    }, 250);
  };

  private onPointerCancel = (event: PointerEvent) => {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size < 2) {
      this.lastPinchDistance = null;
    }
    // Release pointer capture to allow other elements to receive events
    this.context.element.releasePointerCapture?.(event.pointerId);
    this.activePointerId = null;
    this.didDrag = false;
    this.pendingFaceTurn = null;
    this.startedOnCube = false;
    if (this.tapTimeout !== null) {
      window.clearTimeout(this.tapTimeout);
      this.tapTimeout = null;
    }
  };

  private pickFace(clientX: number, clientY: number): PendingFaceTurn | null {
    if (this.explode.isExploded()) return null;

    const rect = this.context.element.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.context.camera);

    const intersects = this.raycaster.intersectObjects(this.getCubelets());
    if (intersects.length === 0) return null;

    const hit = intersects[0];
    const cube = hit.object as THREE.Mesh;
    const normal = hit.face?.normal?.clone();
    if (!normal) return null;

    return {
      grid: (cube.userData.grid as THREE.Vector3).clone(),
      normal,
    };
  }

  private resolveDragTurn(normal: THREE.Vector3, dx: number, dy: number): { axis: Axis; dir: number } | null {
    if (Math.hypot(dx, dy) < 8) return null;

    const horizontal = Math.abs(dx) >= Math.abs(dy);

    if (Math.abs(normal.z) > 0.9) {
      if (horizontal) return { axis: "y", dir: dx > 0 ? 1 : -1 };
      return { axis: "x", dir: dy > 0 ? 1 : -1 };
    }

    if (Math.abs(normal.x) > 0.9) {
      if (horizontal) return { axis: "y", dir: normal.x > 0 ? (dx > 0 ? -1 : 1) : (dx > 0 ? 1 : -1) };
      return { axis: "z", dir: dy > 0 ? 1 : -1 };
    }

    if (Math.abs(normal.y) > 0.9) {
      if (horizontal) return { axis: "z", dir: dx > 0 ? 1 : -1 };
      return { axis: "x", dir: normal.y > 0 ? (dy > 0 ? 1 : -1) : (dy > 0 ? -1 : 1) };
    }

    return null;
  }

  private rotateLayerAnimated(axis: Axis, index: number, dir: number) {
    this.isTurning = true;

    const group = new THREE.Group();
    this.root.add(group);

    const selected = this.getLayer(axis, index);
    selected.forEach((cube) => group.attach(cube));

    const target = dir * Math.PI / 2;
    let progress = 0;

    const animate = () => {
      progress = Math.min(progress + 0.1, 1);
      group.rotation[axis] = progress * target;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        group.rotation[axis] = target;

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

  private rotateLayerInstant(axis: Axis, index: number, dir: number) {
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

  private getCubelets(): THREE.Object3D[] {
    return this.root.children.filter((child) => {
      const grid = child.userData?.grid;
      return child instanceof THREE.Mesh && grid instanceof THREE.Vector3;
    });
  }

  private getLayer(axis: Axis, index: number): THREE.Object3D[] {
    return this.getCubelets().filter((cube) => {
      const grid = cube.userData.grid as THREE.Vector3;
      return Math.round(grid[axis]) === Math.round(index);
    });
  }

  private snapLayerState(selected: THREE.Object3D[], axis: Axis, dir: number) {
    const rotationAxis =
      axis === "x"
        ? new THREE.Vector3(1, 0, 0)
        : axis === "y"
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1);

    const rotation = new THREE.Matrix4();
    rotation.makeRotationAxis(rotationAxis, dir * Math.PI / 2);

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
    this.getCubelets().forEach((cube) => {
      this.initialTransforms.set(cube.uuid, {
        position: cube.position.clone(),
        quaternion: cube.quaternion.clone(),
      });
    });
  }

  private solveInstant() {
    this.getCubelets().forEach((cube) => {
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

    const axes: Axis[] = ["x", "y", "z"];
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
