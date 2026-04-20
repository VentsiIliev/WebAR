import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ExperienceModule, ExperienceModuleContext } from "./ExperienceModule";
import { BOOTH_CONFIG } from "../booth/boothConfig";

export class BoothModule implements ExperienceModule {
  readonly mode = "booth" as const;

  private root = new THREE.Group();
  private loader = new GLTFLoader();
  private context?: ExperienceModuleContext;
  private isMounted = false;

  private yaw = 0;
  private pitch = 0;

  private moveForward = false;
  private moveSpeed = 1.5;

  private lookActive = false;
  private lastX = 0;
  private lastY = 0;

  private moveBtn?: HTMLButtonElement;

  private onPointerDown = (e: PointerEvent) => {
    // ignore UI button presses
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

  private onPointerUp = () => {
    this.lookActive = false;
  };

  mount(parent: THREE.Object3D, context: ExperienceModuleContext): void {
    this.context = context;
    this.isMounted = true;

    parent.add(this.root);
    this.root.clear();

    this.loadBooth();
    this.attachControls(context.element);
    this.createMoveButton();
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

  private createMoveButton() {
    if (this.moveBtn) return;

    const btn = document.createElement("button");
    btn.innerText = "↑";

    Object.assign(btn.style, {
      position: "fixed",
      bottom: "30px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "9999",
      width: "72px",
      height: "72px",
      borderRadius: "50%",
      fontSize: "28px",
      fontWeight: "700",
      background: "rgba(14, 16, 30, 0.82)",
      color: "white",
      border: "1px solid rgba(255,255,255,0.18)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
      cursor: "pointer",
    } as Partial<CSSStyleDeclaration>);

    btn.onpointerdown = (e) => {
      e.preventDefault();
      this.moveForward = true;
    };
    btn.onpointerup = () => {
      this.moveForward = false;
    };
    btn.onpointerleave = () => {
      this.moveForward = false;
    };
    btn.onpointercancel = () => {
      this.moveForward = false;
    };

    document.body.appendChild(btn);
    this.moveBtn = btn;
  }

  private removeMoveButton() {
    if (!this.moveBtn) return;
    this.moveBtn.remove();
    this.moveBtn = undefined;
  }

  private loadBooth() {
    this.loader.load(
      BOOTH_CONFIG.path,
      (gltf) => {
        if (!this.isMounted) return;

        const booth = gltf.scene;

        booth.updateWorldMatrix(true, true);

        const box = new THREE.Box3().setFromObject(booth);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        booth.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = BOOTH_CONFIG.scale ?? 1;

        if (maxDim > 0) {
          booth.scale.setScalar(scale / maxDim);
        }

        this.root.add(booth);
        this.setupCamera();
      },
      undefined,
      (err) => {
        console.error("Booth load failed", err);
      }
    );
  }

  private setupCamera() {
    if (!this.context) return;

    const cam = this.context.camera as THREE.PerspectiveCamera;

    cam.position.set(0, 1.6, 3);

    // initialize yaw/pitch from current look direction
    const lookTarget = new THREE.Vector3(0, 1, 0);
    const dir = lookTarget.clone().sub(cam.position).normalize();
    this.yaw = Math.atan2(-dir.x, -dir.z);
    this.pitch = Math.asin(dir.y);
  }

  update(deltaMs: number): void {
    if (!this.context) return;

    const cam = this.context.camera as THREE.PerspectiveCamera;

    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, "YXZ")
    );
    cam.quaternion.copy(quat);

    if (this.moveForward) {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      forward.y = 0;
      forward.normalize();

      cam.position.addScaledVector(forward, this.moveSpeed * (deltaMs / 1000));
    }
  }

  unmount(parent: THREE.Object3D): void {
    this.isMounted = false;
    this.lookActive = false;
    this.moveForward = false;

    this.detachControls(this.context?.element);
    this.removeMoveButton();

    parent.remove(this.root);
    this.root.clear();
  }

  onDoubleTap(): void {}

  getGestureTarget(): THREE.Object3D {
    return this.root;
  }
}