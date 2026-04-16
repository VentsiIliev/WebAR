import * as THREE from "three";

export class GestureController {
  private target?: THREE.Object3D;
  private element?: HTMLElement;
  private activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchDistance: number | null = null;

  attach(target: THREE.Object3D, element: HTMLElement): void {
    this.target = target;
    this.element = element;

    element.style.touchAction = "none";
    element.addEventListener("pointerdown", this.onPointerDown);
    element.addEventListener("pointermove", this.onPointerMove);
    element.addEventListener("pointerup", this.onPointerUp);
    element.addEventListener("pointercancel", this.onPointerUp);
    element.addEventListener("pointerleave", this.onPointerUp);
  }

  detach(): void {
    if (!this.element) return;

    this.element.removeEventListener("pointerdown", this.onPointerDown);
    this.element.removeEventListener("pointermove", this.onPointerMove);
    this.element.removeEventListener("pointerup", this.onPointerUp);
    this.element.removeEventListener("pointercancel", this.onPointerUp);
    this.element.removeEventListener("pointerleave", this.onPointerUp);

    this.activePointers.clear();
    this.lastPinchDistance = null;
    this.element = undefined;
    this.target = undefined;
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.element?.setPointerCapture?.(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.target || !this.activePointers.has(event.pointerId)) return;

    const previous = this.activePointers.get(event.pointerId)!;
    const current = { x: event.clientX, y: event.clientY };
    this.activePointers.set(event.pointerId, current);

    const pointers = Array.from(this.activePointers.values());

    if (pointers.length === 1) {
      const dx = current.x - previous.x;
      this.target.rotation.y += dx * 0.01;
      return;
    }

    if (pointers.length === 2) {
      const [a, b] = pointers;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);

      if (this.lastPinchDistance !== null) {
        const delta = distance - this.lastPinchDistance;
        const currentScale = this.target.scale.x;
        const nextScale = THREE.MathUtils.clamp(currentScale + delta * 0.005, 0.2, 5);
        this.target.scale.setScalar(nextScale);
      }

      this.lastPinchDistance = distance;
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size < 2) {
      this.lastPinchDistance = null;
    }
  };
}
