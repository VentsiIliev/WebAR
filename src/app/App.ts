import { CameraManager } from "../camera/CameraManager";
import { MarkerTracker } from "../tracking/MarkerTracker";
import { SceneManager } from "../scene/SceneManager";
import { PlacementModule } from "../modules/PlacementModule";
import { GenericModelModule } from "../modules/GenericModelModule";
import { MODEL_CATALOG, ModelOption } from "../models/modelCatalog";
import { GestureController } from "../interaction/GestureController";
import { BoothModule } from "../modules/BoothModule";

export class App {
  private cameraManager = new CameraManager();
  private tracker = new MarkerTracker();
  private scene!: SceneManager;
  private gestures = new GestureController();

  private selectedModel: ModelOption = MODEL_CATALOG[0];
  private videoEl?: HTMLVideoElement;
  private lastTap = 0;
  private mode: "menu" | "viewer" | "ar" | "booth" = "menu";

  async start(container: HTMLElement) {
    const overlayRoot = document.createElement("div");
    overlayRoot.style.position = "fixed";
    overlayRoot.style.inset = "0";
    overlayRoot.style.pointerEvents = "none";
    overlayRoot.style.zIndex = "9999";
    document.body.appendChild(overlayRoot);

    const video = await this.cameraManager.start();
    this.videoEl = video;
    container.appendChild(video);

    this.scene = new SceneManager(container, overlayRoot);
    this.scene.start();

    this.scene.setModule(new PlacementModule(this.selectedModel));

    const stylePrimaryButton = (
      btn: HTMLButtonElement,
      top: string,
      background: string
    ) => {
      btn.style.position = "absolute";
      btn.style.top = top;
      btn.style.left = "50%";
      btn.style.transform = "translate(-50%, -50%)";
      btn.style.zIndex = "1000";
      btn.style.padding = "18px 36px";
      btn.style.fontSize = "20px";
      btn.style.fontWeight = "600";
      btn.style.borderRadius = "14px";
      btn.style.background = background;
      btn.style.color = "white";
      btn.style.border = "none";
      btn.style.cursor = "pointer";
      btn.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
      btn.style.transition = "all 0.2s ease";

      btn.onmousedown = () => {
        btn.style.transform = "translate(-50%, -50%) scale(0.95)";
      };
      btn.onmouseup = () => {
        btn.style.transform = "translate(-50%, -50%) scale(1)";
      };
      btn.onmouseleave = () => {
        btn.style.transform = "translate(-50%, -50%) scale(1)";
      };
    };

    const arBtn = document.createElement("button");
    arBtn.innerText = "Start AR";
    stylePrimaryButton(
      arBtn,
      "50%",
      "linear-gradient(135deg, #6a5cff, #00aaff)"
    );

    const viewerBtn = document.createElement("button");
    viewerBtn.innerText = "Viewer";
    stylePrimaryButton(
      viewerBtn,
      "calc(50% + 88px)",
      "linear-gradient(135deg, #ff7a18, #ff3d77)"
    );
    viewerBtn.style.padding = "16px 32px";
    viewerBtn.style.fontSize = "18px";

    const boothBtn = document.createElement("button");
    boothBtn.innerText = "Booth";
    stylePrimaryButton(
      boothBtn,
      "calc(50% + 168px)",
      "linear-gradient(135deg, #14b8a6, #22c55e)"
    );
    boothBtn.style.padding = "16px 32px";
    boothBtn.style.fontSize = "18px";

    const backBtn = document.createElement("button");
    backBtn.innerText = "Back";
    backBtn.style.position = "absolute";
    backBtn.style.top = "20px";
    backBtn.style.left = "20px";
    backBtn.style.zIndex = "1000";
    backBtn.style.padding = "12px 18px";
    backBtn.style.fontSize = "15px";
    backBtn.style.fontWeight = "600";
    backBtn.style.borderRadius = "12px";
    backBtn.style.background = "rgba(14, 16, 30, 0.82)";
    backBtn.style.color = "white";
    backBtn.style.border = "1px solid rgba(255,255,255,0.18)";
    backBtn.style.cursor = "pointer";
    backBtn.style.boxShadow = "0 8px 24px rgba(0,0,0,0.28)";
    backBtn.style.display = "none";

    const stopCameraAndTracker = () => {
      this.tracker.stop();

      if (this.videoEl?.srcObject) {
        const stream = this.videoEl.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        this.videoEl.srcObject = null;
      }

      if (this.videoEl) {
        this.videoEl.style.display = "none";
      }
    };

    const handleTap = (e: PointerEvent) => {
      if (this.mode !== "viewer") return;
      if ((e.target as HTMLElement)?.closest("button")) return;

      const now = performance.now();
      if (now - this.lastTap < 300) {
        this.scene.onDoubleTap();
        this.lastTap = 0;
      } else {
        this.lastTap = now;
      }
    };

    container.addEventListener("pointerup", handleTap);

    const showMenu = async () => {
      this.mode = "menu";
      this.gestures.detach();

      arBtn.style.display = "block";
      viewerBtn.style.display = "block";
      boothBtn.style.display = "block";
      backBtn.style.display = "none";

      arBtn.style.opacity = "1";
      viewerBtn.style.opacity = "1";
      boothBtn.style.opacity = "1";

      arBtn.style.pointerEvents = "auto";
      viewerBtn.style.pointerEvents = "auto";
      boothBtn.style.pointerEvents = "auto";

      this.scene.setModule(new PlacementModule(this.selectedModel));

      const video = await this.cameraManager.start();
      this.videoEl = video;
      container.insertBefore(video, container.firstChild);

      if (this.videoEl) {
        this.videoEl.style.display = "block";
      }

      await this.tracker.start();
    };

    const hideMenu = () => {
      arBtn.style.display = "none";
      viewerBtn.style.display = "none";
      boothBtn.style.display = "none";
      backBtn.style.display = "block";
    };

    arBtn.onclick = () => {
      this.mode = "ar";
      this.gestures.detach();
      stopCameraAndTracker();
      hideMenu();
      container.dispatchEvent(new Event("start-ar"));
    };

    viewerBtn.onclick = () => {
      this.mode = "viewer";
      stopCameraAndTracker();
      hideMenu();
      this.scene.setModule(new GenericModelModule(this.selectedModel));
      this.gestures.attach(this.scene.getGestureTarget(), container);
    };

    boothBtn.onclick = () => {
      this.mode = "booth";
      this.gestures.detach();
      stopCameraAndTracker();
      hideMenu();
      this.scene.setModule(new BoothModule());
    };

    backBtn.onclick = async () => {
      await showMenu();
    };

    container.appendChild(arBtn);
    container.appendChild(viewerBtn);
    container.appendChild(boothBtn);
    container.appendChild(backBtn);

    this.tracker.onPose((pose) => {
      this.scene.updatePose(pose);
    });

    await this.tracker.start();
  }
}