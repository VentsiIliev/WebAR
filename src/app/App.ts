import { CameraManager } from "../camera/CameraManager";
import { MarkerTracker } from "../tracking/MarkerTracker";
import { SceneManager } from "../scene/SceneManager";
import { PlacementModule } from "../modules/PlacementModule";
import { GenericModelModule } from "../modules/GenericModelModule";
import { MODEL_CATALOG, ModelOption } from "../models/modelCatalog";
import { GestureController } from "../interaction/GestureController";

export class App {
  private cameraManager = new CameraManager();
  private tracker = new MarkerTracker();
  private scene!: SceneManager;
  private gestures = new GestureController();

  private selectedModel: ModelOption = MODEL_CATALOG[0];
  private videoEl?: HTMLVideoElement;
  private lastTap = 0;
  private mode: "menu" | "viewer" | "ar" = "menu";

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

    const stylePrimaryButton = (btn: HTMLButtonElement, top: string, background: string) => {
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
    };

    const arBtn = document.createElement("button");
    arBtn.innerText = "Start AR";
    stylePrimaryButton(arBtn, "50%", "linear-gradient(135deg, #6a5cff, #00aaff)");

    const viewerBtn = document.createElement("button");
    viewerBtn.innerText = "Viewer";
    stylePrimaryButton(viewerBtn, "calc(50% + 88px)", "linear-gradient(135deg, #ff7a18, #ff3d77)");

    const backBtn = document.createElement("button");
    backBtn.innerText = "Back";
    backBtn.style.position = "absolute";
    backBtn.style.top = "20px";
    backBtn.style.left = "20px";
    backBtn.style.zIndex = "1000";
    backBtn.style.display = "none";

    const handleTap = (e: PointerEvent) => {
      if (this.mode !== "viewer") return;
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
      backBtn.style.display = "none";

      this.scene.setModule(new PlacementModule(this.selectedModel));

      const video = await this.cameraManager.start();
      this.videoEl = video;
      container.insertBefore(video, container.firstChild);
      await this.tracker.start();
    };

    const hideMenu = () => {
      arBtn.style.display = "none";
      viewerBtn.style.display = "none";
      backBtn.style.display = "block";
    };

    arBtn.onclick = () => {
      this.mode = "ar";
      this.gestures.detach();
      this.tracker.stop();
      this.videoEl?.srcObject && (this.videoEl.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      this.videoEl && (this.videoEl.style.display = "none");
      hideMenu();
      container.dispatchEvent(new Event("start-ar"));
    };

    viewerBtn.onclick = () => {
      this.mode = "viewer";
      this.tracker.stop();
      this.videoEl?.srcObject && (this.videoEl.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      this.videoEl && (this.videoEl.style.display = "none");
      hideMenu();
      this.scene.setModule(new GenericModelModule(this.selectedModel));
      this.gestures.attach(this.scene.getGestureTarget(), container);
    };

    backBtn.onclick = async () => {
      await showMenu();
    };

    container.appendChild(arBtn);
    container.appendChild(viewerBtn);
    container.appendChild(backBtn);

    this.tracker.onPose((pose) => {
      this.scene.updatePose(pose);
    });

    await this.tracker.start();
  }
}
