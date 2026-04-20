import * as THREE from "three";

export type ExperienceMode = "rubik" | "model" | "placement";

export interface ExperienceModuleContext {
  element: HTMLElement;
  overlayRoot?: HTMLElement;
  camera: THREE.Camera;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
}

export interface ExperienceModule {
  readonly mode: ExperienceMode;
  mount(parent: THREE.Object3D, context: ExperienceModuleContext): void;
  unmount(parent: THREE.Object3D): void;
  update(deltaMs: number): void;
  onDoubleTap(): void;
  getGestureTarget(): THREE.Object3D;
}
