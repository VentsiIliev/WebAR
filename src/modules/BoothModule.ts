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
  private debugCube?: THREE.Mesh;
  private boothHelper?: THREE.BoxHelper;

  private yaw = 0;
  private pitch = 0;

  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private moveUp = false;
  private moveDown = false;
  private moveSpeed = 4;

  private lookActive = false;
  private lastX = 0;
  private lastY = 0;

  private moveForwardBtn?: HTMLButtonElement;
  private moveBackwardBtn?: HTMLButtonElement;
  private moveLeftBtn?: HTMLButtonElement;
  private moveRightBtn?: HTMLButtonElement;
  private moveUpBtn?: HTMLButtonElement;
  private moveDownBtn?: HTMLButtonElement;
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

  private onPointerUp = () => {
    this.lookActive = false;
  };

  mount(parent: THREE.Object3D, context: ExperienceModuleContext): void {
    this.context = context;
    this.isMounted = true;

    parent.add(this.root);
    this.root.clear();
    this.lightGroup.clear();
    this.currentScale = BOOTH_CONFIG.scale ?? 1;

    this.addBoothLights();
    this.addDebugCube();

    this.loadBooth();
    this.attachControls(context.element);
    this.createMoveButtons();
    this.createScaleButtons();
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

    this.moveUpBtn = makeButton(
      "⬆",
      { right: "100px", bottom: "110px" },
      () => (this.moveUp = true),
      () => (this.moveUp = false)
    );

    this.moveDownBtn = makeButton(
      "⬇",
      { right: "100px", bottom: "30px" },
      () => (this.moveDown = true),
      () => (this.moveDown = false)
    );
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

  private scaleBooth(factor: number) {
    if (!this.booth) return;

    this.currentScale *= factor;
    this.currentScale = THREE.MathUtils.clamp(this.currentScale, 0.01, 50);
    this.booth.scale.setScalar(this.currentScale);
    this.boothHelper?.update();

    console.log("BOOTH SCALE:", this.currentScale);
  }

  private removeMoveButtons() {
    this.moveForwardBtn?.remove();
    this.moveBackwardBtn?.remove();
    this.moveLeftBtn?.remove();
    this.moveRightBtn?.remove();
    this.moveUpBtn?.remove();
    this.moveDownBtn?.remove();

    this.moveForwardBtn = undefined;
    this.moveBackwardBtn = undefined;
    this.moveLeftBtn = undefined;
    this.moveRightBtn = undefined;
    this.moveUpBtn = undefined;
    this.moveDownBtn = undefined;
  }

  private removeScaleButtons() {
    this.scaleUpBtn?.remove();
    this.scaleDownBtn?.remove();
    this.scaleUpBtn = undefined;
    this.scaleDownBtn = undefined;
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

        booth.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.frustumCulled = false;
          child.material = new THREE.MeshStandardMaterial({
            color: 0x66ccff,
            roughness: 1,
            metalness: 0,
            side: THREE.DoubleSide,
          });
        });

        this.booth = booth;
        this.root.add(booth);

        this.boothHelper = new THREE.BoxHelper(booth, 0x00ff00);
        this.root.add(this.boothHelper);

        if (this.debugCube) {
          this.root.remove(this.debugCube);
          this.debugCube = undefined;
        }

        this.setupCamera(size);
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

  private setupCamera(size?: THREE.Vector3) {
    if (!this.context) return;

    const cam = this.context.camera as THREE.PerspectiveCamera;
    const depth = size?.z ?? 10;
    const width = size?.x ?? 10;
    const height = size?.y ?? 4;
    const startDistance = Math.max(depth, width) * 1.5;

    cam.position.set(0, Math.max(1.7, height * 0.4), Math.max(12, startDistance));
    cam.lookAt(0, Math.max(1.6, height * 0.3), 0);
    cam.near = 0.01;
    cam.far = 1000;
    cam.updateProjectionMatrix();

    const lookTarget = new THREE.Vector3(0, Math.max(1.6, height * 0.3), 0);
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
    if (forward.lengthSq() > 0) forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    if (right.lengthSq() > 0) right.normalize();

    const up = new THREE.Vector3(0, 1, 0);
    const move = new THREE.Vector3();

    if (this.moveForward) move.add(forward);
    if (this.moveBackward) move.sub(forward);
    if (this.moveRight) move.add(right);
    if (this.moveLeft) move.sub(right);
    if (this.moveUp) move.add(up);
    if (this.moveDown) move.sub(up);

    if (move.lengthSq() > 0) {
      move.normalize();
      cam.position.addScaledVector(move, this.moveSpeed * (deltaMs / 1000));
    }

    this.boothHelper?.update();
  }

  unmount(parent: THREE.Object3D): void {
    this.isMounted = false;
    this.lookActive = false;

    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.moveUp = false;
    this.moveDown = false;

    this.detachControls(this.context?.element);
    this.removeMoveButtons();
    this.removeScaleButtons();

    if (this.boothHelper) {
      this.root.remove(this.boothHelper);
      this.boothHelper = undefined;
    }

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
