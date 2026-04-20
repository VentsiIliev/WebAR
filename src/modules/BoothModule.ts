import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import type { ExperienceModule, ExperienceModuleContext } from "./ExperienceModule";
import { BOOTH_CONFIG } from "../booth/boothConfig";

export class BoothModule implements ExperienceModule {
  readonly mode = "booth" as const;

  private root = new THREE.Group();
  private loader = new GLTFLoader();
  private dracoLoader = new DRACOLoader();
  private context?: ExperienceModuleContext;
  private isMounted = false;

  private booth?: THREE.Object3D;
  private boothBounds?: THREE.Box3;
  private eyeHeight = 1.7;
  private movementMargin = 0.35;

  private yaw = 0;
  private pitch = 0;

  private stepDistance = 1.1;
  private stepDurationMs = 260;
  private lastTapTime = 0;
  private isStepping = false;
  private stepStart?: THREE.Vector3;
  private stepTarget?: THREE.Vector3;
  private stepProgressMs = 0;

  private lookActive = false;
  private lastX = 0;
  private lastY = 0;

  private scaleUpBtn?: HTMLButtonElement;
  private scaleDownBtn?: HTMLButtonElement;
  private currentScale = 1;

  private lightGroup = new THREE.Group();

  constructor() {
    this.dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
    this.loader.setDRACOLoader(this.dracoLoader);
  }

  private onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement)?.closest("button")) return;

    this.lookActive = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.lookActive) return;

    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;

    this.lastX = e.clientX;
    this.lastY = e.clientY;

    this.yaw -= dx * 0.005;
    this.pitch -= dy * 0.005;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 3, Math.PI / 3);
  };

  private onPointerUp = (e: PointerEvent) => {
    this.lookActive = false;

    if ((e.target as HTMLElement)?.closest("button")) return;

    const now = performance.now();
    if (now - this.lastTapTime < 300) {
      this.startStepMove();
      this.lastTapTime = 0;
    } else {
      this.lastTapTime = now;
    }
  };

  mount(parent: THREE.Object3D, context: ExperienceModuleContext): void {
    this.context = context;
    this.isMounted = true;

    context.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    parent.add(this.root);
    this.root.clear();
    this.lightGroup.clear();
    this.currentScale = BOOTH_CONFIG.scale ?? 1;
    this.lastTapTime = 0;
    this.isStepping = false;
    this.stepProgressMs = 0;
    this.stepStart = undefined;
    this.stepTarget = undefined;

    this.addBoothLights();
    this.loadBooth();
    this.attachControls(context.element);
    this.createScaleButtons();
  }

  private addBoothLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 1.0);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 0.9);

    const dir1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dir1.position.set(5, 8, 5);

    const dir2 = new THREE.DirectionalLight(0xffffff, 0.8);
    dir2.position.set(-5, 6, -5);

    this.lightGroup.add(ambient, hemi, dir1, dir2);
    this.root.add(this.lightGroup);
  }

  private attachControls(el: HTMLElement) {
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("pointercancel", this.onPointerUp);
    el.addEventListener("pointerleave", this.onPointerUp);
  }

  private detachControls(el?: HTMLElement) {
    if (!el) return;

    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointercancel", this.onPointerUp);
    el.removeEventListener("pointerleave", this.onPointerUp);
  }

  private createScaleButtons() {
    if (this.scaleUpBtn) return;

    const commonStyle: Partial<CSSStyleDeclaration> = {
      position: "fixed",
      zIndex: "9999",
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      fontSize: "22px",
      fontWeight: "700",
      background: "rgba(14, 16, 30, 0.82)",
      color: "white",
      border: "1px solid rgba(255,255,255,0.18)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
      cursor: "pointer",
      userSelect: "none",
      WebkitUserSelect: "none",
      touchAction: "none",
    };

    const makeButton = (
      label: string,
      style: Partial<CSSStyleDeclaration>,
      onClick: () => void
    ) => {
      const btn = document.createElement("button");
      btn.innerText = label;
      Object.assign(btn.style, commonStyle, style);
      btn.onclick = onClick;
      document.body.appendChild(btn);
      return btn;
    };

    this.scaleUpBtn = makeButton(
      "＋",
      { right: "20px", bottom: "110px" },
      () => this.scaleBooth(1.2)
    );

    this.scaleDownBtn = makeButton(
      "－",
      { right: "20px", bottom: "40px" },
      () => this.scaleBooth(1 / 1.2)
    );
  }

  private startStepMove() {
    if (!this.context || this.isStepping) return;

    const cam = this.context.camera as THREE.PerspectiveCamera;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    forward.y = 0;
    if (forward.lengthSq() === 0) return;
    forward.normalize();

    this.stepStart = cam.position.clone();
    this.stepTarget = cam.position.clone().addScaledVector(forward, this.stepDistance);
    this.isStepping = true;
    this.stepProgressMs = 0;
  }

  private scaleBooth(factor: number) {
    if (!this.booth) return;

    this.currentScale *= factor;
    this.currentScale = THREE.MathUtils.clamp(this.currentScale, 0.01, 50);
    this.booth.scale.setScalar(this.currentScale);
    this.refreshBoothBounds();

    console.log("BOOTH SCALE:", this.currentScale);
  }

  private removeScaleButtons() {
    this.scaleUpBtn?.remove();
    this.scaleDownBtn?.remove();
    this.scaleUpBtn = undefined;
    this.scaleDownBtn = undefined;
  }

  private refreshBoothBounds() {
    if (!this.booth) return;
    this.booth.updateWorldMatrix(true, true);
    this.boothBounds = new THREE.Box3().setFromObject(this.booth);
  }

  private clampCameraToBounds(cam: THREE.PerspectiveCamera) {
    if (!this.boothBounds) return;

    const min = this.boothBounds.min;
    const max = this.boothBounds.max;
    const m = this.movementMargin;

    cam.position.x = THREE.MathUtils.clamp(cam.position.x, min.x + m, max.x - m);
    cam.position.z = THREE.MathUtils.clamp(cam.position.z, min.z + m, max.z - m);
    cam.position.y = this.eyeHeight;
  }

  private loadBooth() {
    console.log("Loading booth from:", BOOTH_CONFIG.path);
    const startedAt = performance.now();
    const timeoutId = window.setTimeout(() => {
      console.warn(
        `Booth still loading after ${((performance.now() - startedAt) / 1000).toFixed(1)}s: ${BOOTH_CONFIG.path}`
      );
    }, 12000);

    this.loader.load(
      BOOTH_CONFIG.path,
      (gltf) => {
        if (!this.isMounted) return;
        window.clearTimeout(timeoutId);
        console.log(`Booth loaded successfully in ${((performance.now() - startedAt) / 1000).toFixed(2)}s`);

        const booth = gltf.scene;
        booth.updateWorldMatrix(true, true);

        const box = new THREE.Box3().setFromObject(booth);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const minY = box.min.y;

        console.log("BOOTH BOUNDS", box.min, box.max, size);

        booth.position.x -= center.x;
        booth.position.z -= center.z;
        booth.position.y -= minY;

        const scale = BOOTH_CONFIG.scale ?? 1;
        this.currentScale = scale;
        booth.scale.setScalar(scale);

        this.booth = booth;
        this.root.add(booth);
        this.refreshBoothBounds();
        this.setupCamera();
      },
      (event) => {
        if (event.total && event.total > 0) {
          const pct = ((event.loaded / event.total) * 100).toFixed(1);
          console.log(`Booth loading: ${pct}% (${event.loaded}/${event.total} bytes)`);
        } else {
          console.log(`Booth loading bytes: ${event.loaded}`);
        }
      },
      (err) => {
        window.clearTimeout(timeoutId);
        console.error("Booth load failed", BOOTH_CONFIG.path, err);
      }
    );
  }

  private setupCamera() {
    if (!this.context || !this.boothBounds) return;

    const cam = this.context.camera as THREE.PerspectiveCamera;
    const center = this.boothBounds.getCenter(new THREE.Vector3());
    const size = this.boothBounds.getSize(new THREE.Vector3());

    this.eyeHeight = Math.max(1.6, Math.min(1.9, size.y * 0.22));

    cam.position.set(center.x, this.eyeHeight, center.z);
    cam.lookAt(center.x, this.eyeHeight, center.z - 1);
    cam.near = 0.01;
    cam.far = 1000;
    cam.updateProjectionMatrix();

    this.yaw = 0;
    this.pitch = 0;

    console.log("CAMERA POS", cam.position);
  }

  update(deltaMs: number): void {
    if (!this.context) return;

    const cam = this.context.camera as THREE.PerspectiveCamera;

    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, "YXZ")
    );
    cam.quaternion.copy(quat);

    if (this.isStepping && this.stepStart && this.stepTarget) {
      this.stepProgressMs += deltaMs;
      const t = Math.min(1, this.stepProgressMs / this.stepDurationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      cam.position.lerpVectors(this.stepStart, this.stepTarget, eased);
      this.clampCameraToBounds(cam);

      if (t >= 1) {
        this.isStepping = false;
        this.stepProgressMs = 0;
        this.stepStart = undefined;
        this.stepTarget = undefined;
      }
    } else {
      this.clampCameraToBounds(cam);
    }
  }

  unmount(parent: THREE.Object3D): void {
    this.isMounted = false;
    this.lookActive = false;
    this.isStepping = false;
    this.stepProgressMs = 0;
    this.stepStart = undefined;
    this.stepTarget = undefined;
    this.lastTapTime = 0;

    this.detachControls(this.context?.element);
    this.removeScaleButtons();

    parent.remove(this.root);
    this.root.clear();
    this.booth = undefined;
    this.boothBounds = undefined;
  }

  onDoubleTap(): void {}

  getGestureTarget(): THREE.Object3D {
    return this.root;
  }
}
