import * as THREE from "three";

export type ExperienceMode = "rubik" | "model";

export interface ExperienceModuleContext {
  element: HTMLElement;
  camera: THREE.Camera;
}

export interface ExperienceModule {
  readonly mode: ExperienceMode;
  mount(parent: THREE.Object3D, context: ExperienceModuleContext): void;
  unmount(parent: THREE.Object3D): void;
  update(deltaMs: number): void;
  onDoubleTap(): void;
  getGestureTarget(): THREE.Object3D;
}
