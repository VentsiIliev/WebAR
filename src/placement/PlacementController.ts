import * as THREE from "three";
import { createReticle } from "./Reticle";

export class PlacementController {
  private reticle = createReticle();
  private placed = false;

  private session: XRSession | null = null;
  private refSpace: XRReferenceSpace | null = null;
  private viewerSpace: XRReferenceSpace | null = null;
  private hitTestSource: XRHitTestSource | null = null;

  private renderer?: THREE.WebGLRenderer;
  private xrActive = false;
  private onSelect?: () => void;
  private onSelectStart?: () => void;
  private onSelectEnd?: () => void;

  private time = 0;

  mount(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    scene.add(this.reticle);
  }

  setSelectHandler(handler: () => void) {
    this.onSelect = handler;
  }

  setSelectStartHandler(handler: () => void) {
    this.onSelectStart = handler;
  }

  setSelectEndHandler(handler: () => void) {
    this.onSelectEnd = handler;
  }

  async startAR(overlayRoot?: HTMLElement): Promise<{ ok: boolean; reason?: string }> {
    if (!this.renderer) return { ok: false, reason: "Renderer not ready" };
    if (!navigator.xr) return { ok: false, reason: "WebXR not available" };

    const supported = await navigator.xr.isSessionSupported("immersive-ar");
    if (!supported) return { ok: false, reason: "immersive-ar not supported" };

    try {
      this.session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test", "local-floor"],
        optionalFeatures: ["dom-overlay"],
        domOverlay: overlayRoot ? { root: overlayRoot } : undefined,
      });

      this.renderer.xr.enabled = true;
      await this.renderer.xr.setSession(this.session);

      this.viewerSpace = await this.session.requestReferenceSpace("viewer");
      this.refSpace = await this.session.requestReferenceSpace("local-floor");
      this.hitTestSource = await this.session.requestHitTestSource({ space: this.viewerSpace });
      this.xrActive = true;

      this.session.addEventListener("select", () => this.onSelect?.());
      this.session.addEventListener("selectstart", () => this.onSelectStart?.());
      this.session.addEventListener("selectend", () => this.onSelectEnd?.());

      this.session.addEventListener("end", () => {
        this.xrActive = false;
        this.hitTestSource?.cancel();
        this.hitTestSource = null;
        this.viewerSpace = null;
        this.refSpace = null;
        this.session = null;
      });

      return { ok: true };
    } catch {
      return { ok: false, reason: "Failed to start AR session" };
    }
  }

  unmount(scene: THREE.Scene) {
    scene.remove(this.reticle);
    this.hitTestSource?.cancel();
    this.session?.end();
    this.session = null;
    this.hitTestSource = null;
    this.viewerSpace = null;
    this.refSpace = null;
    this.xrActive = false;
  }

  update(camera: THREE.Camera) {
    this.time += 0.016;

    const halo = this.reticle.getObjectByName("reticle-halo") as THREE.Mesh;
    const beacon = this.reticle.getObjectByName("reticle-beacon") as THREE.Mesh;
    const beaconTop = this.reticle.getObjectByName("reticle-beacon-top") as THREE.Mesh;

    if (halo) {
      const s = 1 + Math.sin(this.time * 2) * 0.1;
      halo.scale.set(s, s, s);
      (halo.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(this.time * 2) * 0.15;
    }

    if (beacon) {
      beacon.position.y = 0.08 + Math.sin(this.time * 2.5) * 0.02;
    }

    if (beaconTop) {
      beaconTop.position.y = 0.16 + Math.sin(this.time * 2.5) * 0.03;
    }

    if (this.xrActive && this.renderer && this.refSpace && this.hitTestSource) {
      const frame = this.renderer.xr.getFrame?.();
      if (!frame) return;

      const hits = frame.getHitTestResults(this.hitTestSource);
      if (hits.length > 0) {
        const pose = hits[0].getPose(this.refSpace);
        if (pose) {
          this.reticle.visible = true;
          this.reticle.matrix.fromArray(pose.transform.matrix);
          return;
        }
      }

      this.reticle.visible = false;
      return;
    }

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const position = camera.position.clone().add(forward.multiplyScalar(1));
    this.reticle.visible = true;
    this.reticle.position.copy(position);
    this.reticle.quaternion.copy(camera.quaternion);
    this.reticle.updateMatrix();
  }

  place(target: THREE.Object3D): boolean {
    if (!this.reticle.visible) return false;

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    this.reticle.matrix.decompose(position, quaternion, scale);

    target.position.copy(position);
    target.quaternion.copy(quaternion);
    this.placed = true;
    return true;
  }

  getReticlePose(position: THREE.Vector3, quaternion?: THREE.Quaternion): boolean {
    if (!this.reticle.visible) return false;
    const scale = new THREE.Vector3();
    this.reticle.matrix.decompose(position, quaternion ?? new THREE.Quaternion(), scale);
    return true;
  }

  isPlaced(): boolean {
    return this.placed;
  }

  isXRRunning(): boolean {
    return this.xrActive;
  }
}
