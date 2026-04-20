import * as THREE from "three";
import { Anchor } from "./Anchor";
import type { Pose } from "../tracking/Tracker";
import type { ExperienceModule, ExperienceModuleContext } from "../modules/ExperienceModule";

export class SceneManager {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 1000);
  private renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

  private anchor = new Anchor();
  private worldRoot = new THREE.Group();
  private module?: ExperienceModule;
  private moduleParent?: THREE.Object3D;
  private container: HTMLElement;
  private overlayRoot?: HTMLElement;

  private lastTime = performance.now();

  constructor(container: HTMLElement, overlayRoot?: HTMLElement) {
    this.container = container;
    this.overlayRoot = overlayRoot;

    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.physicallyCorrectLights = true;
    this.renderer.xr.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.scene.add(this.worldRoot);
    this.scene.add(this.anchor.markerRoot);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    this.scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 2, 1);
    this.scene.add(directionalLight);

    this.camera.position.z = 2;
  }

  setModule(module: ExperienceModule) {
    if (this.module && this.moduleParent) {
      this.module.unmount(this.moduleParent);
    }

    this.module = module;
    this.moduleParent = module.mode === "booth" ? this.worldRoot : this.anchor.userGroup;

    this.worldRoot.visible = module.mode === "booth";
    this.anchor.markerRoot.visible = module.mode !== "booth";

    const context: ExperienceModuleContext = {
      element: this.container,
      overlayRoot: this.overlayRoot,
      camera: this.camera,
      scene: this.scene,
      renderer: this.renderer,
    };

    this.module.mount(this.moduleParent, context);
  }

  getGestureTarget() {
    return this.module?.getGestureTarget() ?? this.moduleParent ?? this.anchor.userGroup;
  }

  onDoubleTap() {
    this.module?.onDoubleTap();
  }

  getAnchor() {
    return this.anchor;
  }

  updatePose(pose: Pose) {
    if (this.module?.mode === "booth") return;
    this.anchor.updatePose(pose);
  }

  render() {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;

    this.module?.update(delta);

    this.renderer.render(this.scene, this.camera);
  }

  start() {
    this.renderer.setAnimationLoop(() => {
      this.render();
    });
  }
}
