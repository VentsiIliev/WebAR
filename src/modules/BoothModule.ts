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

  private booth?: THREE.Object3D;
  private debugCube?: THREE.Mesh;

  private yaw = 0;
  private pitch = 0;

  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private moveSpeed = 1.5;

  private lookActive = false;
  private lastX = 0;
  private lastY = 0;

  private moveForwardBtn?: HTMLButtonElement;
  private moveBackwardBtn?: HTMLButtonElement;
  private moveLeftBtn?: HTMLButtonElement;
  private moveRightBtn?: HTMLButtonElement;

  private lightGroup = new THREE.Group();

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

  private onPointerUp = () => {
    this.lookActive = false;
  };

  mount(parent: THREE.Object3D, context: ExperienceModuleContext): void {
    this.context = context;
    this.isMounted = true;

    parent.add(this.root);
    this.root.clear();
    this.lightGroup.clear();

    this.addBoothLights();
    this.addDebugCube();

    this.loadBooth();
    this.attachControls(context.element);
    this.createMoveButtons();
  }

  private addBoothLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1.2);

    const dir1 = new THREE.DirectionalLight(0xffffff, 1.5);
    dir1.position.set(5, 8, 5);

    const dir2 = new THREE.DirectionalLight(0xffffff, 1.0);
    dir2.position.set(-5, 6, -5);

    this.lightGroup.add(ambient, hemi, dir1, dir2);
    this.root.add(this.lightGroup);
  }

  private addDebugCube() {
    this.debugCube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xff00ff })
    );
    this.debugCube.position.set(0, 0.5, 0);
    this.root.add(this.debugCube);
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

  private createMoveButtons() {
    if (this.moveForwardBtn) return;

    const commonStyle: Partial<CSSStyleDeclaration> = {
      position: "fixed",
      zIndex: "9999",
      width: "64px",
      height: "64px",
      borderRadius: "50%",
      fontSize: "24px",
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
      text: string,
      style: Partial<CSSStyleDeclaration>,
      onDown: () => void,
      onUp: () => void
    ) => {
      const btn = document.createElement("button");
      btn.innerText = text;
      Object.assign(btn.style, commonStyle, style);

      btn.onpointerdown = (e) => {
        e.preventDefault();
        onDown();
      };
      btn.onpointerup = () => onUp();
      btn.onpointerleave = () => onUp();
      btn.onpointercancel = () => onUp();

      document.body.appendChild(btn);
      return btn;
    };

    this.moveForwardBtn = makeButton(
      "↑",
      { bottom: "110px", left: "50%", transform: "translateX(-50%)" },
      () => (this.moveForward = true),
      () => (this.moveForward = false)
    );

    this.moveBackwardBtn = makeButton(
      "↓",
      { bottom: "30px", left: "50%", transform: "translateX(-50%)" },
      () => (this.moveBackward = true),
      () => (this.moveBackward = false)
    );

    this.moveLeftBtn = makeButton(
      "←",
      { bottom: "30px", left: "calc(50% - 80px)", transform: "translateX(-50%)" },
      () => (this.moveLeft = true),
      () => (this.moveLeft = false)
    );

    this.moveRightBtn = makeButton(
      "→",
      { bottom: "30px", left: "calc(50% + 80px)", transform: "translateX(-50%)" },
      () => (this.moveRight = true),
      () => (this.moveRight = false)
    );
  }

  private removeMoveButtons() {
    this.moveForwardBtn?.remove();
    this.moveBackwardBtn?.remove();
    this.moveLeftBtn?.remove();
    this.moveRightBtn?.remove();

    this.moveForwardBtn = undefined;
    this.moveBackwardBtn = undefined;
    this.moveLeftBtn = undefined;
    this.moveRightBtn = undefined;
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
        const minY = box.min.y;

        console.log("BOOTH BOUNDS", box.min, box.max, size);

        // center horizontally, keep floor at y=0
        booth.position.x -= center.x;
        booth.position.z -= center.z;
        booth.position.y -= minY;

        const scale = BOOTH_CONFIG.scale ?? 1;
        booth.scale.setScalar(scale);

        booth.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;

          child.frustumCulled = false;

          const applyMaterial = (material: THREE.Material) => {
            material.side = THREE.DoubleSide;
            material.needsUpdate = true;
          };

          if (Array.isArray(child.material)) {
            child.material.forEach(applyMaterial);
          } else {
            applyMaterial(child.material);
          }
        });

        this.booth = booth;
        this.root.add(booth);

        // remove debug cube after successful load
        if (this.debugCube) {
          this.root.remove(this.debugCube);
          this.debugCube = undefined;
        }

        this.setupCamera(size);
      },
      undefined,
      (err) => {
        console.error("Booth load failed", err);
      }
    );
  }

  private setupCamera(size?: THREE.Vector3) {
    if (!this.context) return;

    const cam = this.context.camera as THREE.PerspectiveCamera;

    const depth = size?.z ?? 10;
    const width = size?.x ?? 10;
    const startDistance = Math.max(depth, width) * 0.8;

    cam.position.set(0, 1.7, Math.max(8, startDistance));
    cam.lookAt(0, 1.6, 0);
    cam.near = 0.01;
    cam.far = 1000;
    cam.updateProjectionMatrix();

    const lookTarget = new THREE.Vector3(0, 1.6, 0);
    const dir = lookTarget.clone().sub(cam.position).normalize();
    this.yaw = Math.atan2(-dir.x, -dir.z);
    this.pitch = Math.asin(dir.y);

    console.log("CAMERA POS", cam.position);
  }

  update(deltaMs: number): void {
    if (!this.context) return;

    const cam = this.context.camera as THREE.PerspectiveCamera;

    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, "YXZ")
    );
    cam.quaternion.copy(quat);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    forward.y = 0;
    if (forward.lengthSq() > 0) forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    right.y = 0;
    if (right.lengthSq() > 0) right.normalize();

    const move = new THREE.Vector3();

    if (this.moveForward) move.add(forward);
    if (this.moveBackward) move.sub(forward);
    if (this.moveRight) move.add(right);
    if (this.moveLeft) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize();
      cam.position.addScaledVector(move, this.moveSpeed * (deltaMs / 1000));
    }

    cam.position.y = 1.7;
  }

  unmount(parent: THREE.Object3D): void {
    this.isMounted = false;
    this.lookActive = false;

    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;

    this.detachControls(this.context?.element);
    this.removeMoveButtons();

    parent.remove(this.root);
    this.root.clear();
    this.booth = undefined;
    this.debugCube = undefined;
  }

  onDoubleTap(): void {}

  getGestureTarget(): THREE.Object3D {
    return this.root;
  }
}