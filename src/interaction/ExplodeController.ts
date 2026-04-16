import * as THREE from "three";

export interface ExplodablePart {
  id: string;
  object: THREE.Object3D;
  originalPosition: THREE.Vector3;
  explodedPosition: THREE.Vector3;
}

export interface ExplodeOptions {
  distanceMultiplier?: number;
  durationMs?: number;
  easing?: (t: number) => number;
}

export interface ExplodeController {
  register(root: THREE.Object3D, options?: ExplodeOptions): void;
  explode(): void;
  collapse(): void;
  toggle(): void;
  update(deltaMs: number): void;
  isExploded(): boolean;
  getParts(): ExplodablePart[];
}

export class ModelExplodeController implements ExplodeController {
  private parts: ExplodablePart[] = [];
  private exploded = false;
  private animating = false;
  private elapsedMs = 0;
  private durationMs = 400;
  private startT = 0;
  private targetT = 0;
  private easing: (t: number) => number = (t) => 1 - Math.pow(1 - t, 3);

  register(root: THREE.Object3D, options?: ExplodeOptions): void {
    this.parts = [];
    this.exploded = false;
    this.animating = false;
    this.elapsedMs = 0;
    this.startT = 0;
    this.targetT = 0;
    this.durationMs = options?.durationMs ?? 400;
    this.easing = options?.easing ?? ((t) => 1 - Math.pow(1 - t, 3));

    const multiplier = options?.distanceMultiplier ?? 0.25;
    const center = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());

    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;

      const partCenter = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
      const direction = partCenter.clone().sub(center);

      if (direction.lengthSq() === 0) {
        direction.set(0, 1, 0);
      } else {
        direction.normalize();
      }

      const originalPosition = mesh.position.clone();
      const explodedPosition = originalPosition.clone().add(direction.multiplyScalar(multiplier));

      this.parts.push({
        id: mesh.uuid,
        object: mesh,
        originalPosition,
        explodedPosition,
      });
    });

    this.applyT(0);
  }

  explode(): void {
    if (this.exploded && !this.animating) return;
    this.startAnimation(1);
  }

  collapse(): void {
    if (!this.exploded && !this.animating) return;
    this.startAnimation(0);
  }

  toggle(): void {
    this.startAnimation(this.exploded ? 0 : 1);
  }

  update(deltaMs: number): void {
    if (!this.animating) return;

    this.elapsedMs += deltaMs;
    const rawT = Math.min(this.elapsedMs / this.durationMs, 1);
    const eased = this.easing(rawT);
    const currentT = THREE.MathUtils.lerp(this.startT, this.targetT, eased);

    this.applyT(currentT);

    if (rawT >= 1) {
      this.animating = false;
      this.exploded = this.targetT === 1;
      this.applyT(this.targetT);
    }
  }

  isExploded(): boolean {
    return this.exploded;
  }

  getParts(): ExplodablePart[] {
    return this.parts;
  }

  private startAnimation(targetT: 0 | 1): void {
    const currentT = this.getCurrentT();
    this.startT = currentT;
    this.targetT = targetT;
    this.elapsedMs = 0;
    this.animating = true;
  }

  private getCurrentT(): number {
    if (!this.animating) {
      return this.exploded ? 1 : 0;
    }

    const rawT = Math.min(this.elapsedMs / this.durationMs, 1);
    const eased = this.easing(rawT);
    return THREE.MathUtils.lerp(this.startT, this.targetT, eased);
  }

  private applyT(t: number): void {
    for (const part of this.parts) {
      part.object.position.lerpVectors(part.originalPosition, part.explodedPosition, t);
    }
  }
}
