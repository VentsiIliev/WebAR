import * as THREE from "three";
import { createReticle } from "./Reticle";

export class PlacementController {
  private reticle = createReticle();
  private placed = false;

  private session: XRSession | null = null;
  private refSpace: XRReferenceSpace | null = null;
  private viewerSpace: XRReferenceSpace | null = null;
  private hitTestSource: XRHitTestSource | null = null;

  private scene?: THREE.Scene;
  private renderer?: THREE.WebGLRenderer;

  async mount(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;

    scene.add(this.reticle);

    if (!navigator.xr) return;

    const supported = await navigator.xr.isSessionSupported("immersive-ar");
    if (!supported) return;

    this.session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test", "local-floor"],
    });

    renderer.xr.enabled = true;
    await renderer.xr.setSession(this.session);

    this.viewerSpace = await this.session.requestReferenceSpace("viewer");
    this.refSpace = await this.session.requestReferenceSpace("local-floor");

    this.hitTestSource = await this.session.requestHitTestSource({
      space: this.viewerSpace,
    });
  }

  unmount(scene: THREE.Scene) {
    scene.remove(this.reticle);
    this.hitTestSource?.cancel();
    this.session?.end();
  }

  update() {
    if (this.placed || !this.renderer || !this.refSpace || !this.hitTestSource) return;

    const frame = this.renderer.xr.getFrame?.();
    if (!frame) return;

    const hits = frame.getHitTestResults(this.hitTestSource);

    if (hits.length > 0) {
      const pose = hits[0].getPose(this.refSpace);
      if (pose) {
        this.reticle.visible = true;
        this.reticle.matrix.fromArray(pose.transform.matrix);
      }
    } else {
      this.reticle.visible = false;
    }
  }

  place(target: THREE.Object3D) {
    if (!this.reticle.visible) return;

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    this.reticle.matrix.decompose(position, quaternion, scale);

    target.position.copy(position);
    target.quaternion.copy(quaternion);

    this.placed = true;
    this.reticle.visible = false;
  }

  isPlaced(): boolean {
    return this.placed;
  }
}
