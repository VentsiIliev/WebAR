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
  private animationStart = 0;
  private durationMs = 400;
  private progress = 0;
  private easing: (t: number) => number = (t) => 1 - Math.pow(1 - t, 3);

  register(root: THREE.Object3D, options?: ExplodeOptions): void {
    this.parts = [];
    this.exploded = false;
    this.animating = false;
    this.progress = 0;
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
  }

  explode(): void {
    if (this.exploded && !this.animating) return;
    this.startAnimation(true);
  }

  collapse(): void {
    if (!this.exploded && !this.animating) return;
    this.startAnimation(false);
  }

  toggle(): void {
    if (this.exploded) {
      this.collapse();
      return;
    }
    this.explode();
  }

  update(deltaMs: number): void {
    if (!this.animating) return;

    this.animationStart += deltaMs;
    const rawT = Math.min(this.animationStart / this.durationMs, 1);
    const eased = this.easing(rawT);
    const t = this.exploded ? 1 - eased : eased;

    for (const part of this.parts) {
      part.object.position.lerpVectors(part.originalPosition, part.explodedPosition, t);
    }

    this.progress = t;

    if (rawT >= 1) {
      this.animating = false;
      this.exploded = !this.exploded;
      const finalT = this.exploded ? 1 : 0;
      for (const part of this.parts) {
        part.object.position.lerpVectors(part.originalPosition, part.explodedPosition, finalT);
      }
    }
  }

  isExploded(): boolean {
    return this.exploded;
  }

  getParts(): ExplodablePart[] {
    return this.parts;
  }

  private startAnimation(targetExploded: boolean): void {
    this.animating = true;
    this.animationStart = 0;

    // Internal convention:
    // exploded=false + animating -> animating toward exploded state
    // exploded=true + animating  -> animating toward collapsed state
    if (targetExploded === this.exploded) {
      this.exploded = !this.exploded;
    }
  }
}
