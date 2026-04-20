import { CameraManager } from "../camera/CameraManager";
import { MarkerTracker } from "../tracking/MarkerTracker";
import { SceneManager } from "../scene/SceneManager";
import { PlacementModule } from "../modules/PlacementModule";
import { GenericModelModule } from "../modules/GenericModelModule";
import { MODEL_CATALOG, ModelOption } from "../models/modelCatalog";

export class App {
  private cameraManager = new CameraManager();
  private tracker = new MarkerTracker();
  private scene!: SceneManager;

  private selectedModel: ModelOption = MODEL_CATALOG[0];
  private videoEl?: HTMLVideoElement;

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
    stylePrimaryButton(arBtn, "50%", "linear-gradient(135deg, #6a5cff, #00aaff)");

    const viewerBtn = document.createElement("button");
    viewerBtn.innerText = "Viewer";
    stylePrimaryButton(viewerBtn, "calc(50% + 88px)", "linear-gradient(135deg, #ff7a18, #ff3d77)");
    viewerBtn.style.padding = "16px 32px";
    viewerBtn.style.fontSize = "18px";

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

    const showLaunchMenu = async () => {
      arBtn.style.display = "block";
      arBtn.style.opacity = "1";
      arBtn.style.pointerEvents = "auto";
      viewerBtn.style.display = "block";
      viewerBtn.style.opacity = "1";
      viewerBtn.style.pointerEvents = "auto";
      backBtn.style.display = "none";

      this.scene.setModule(new PlacementModule(this.selectedModel));

      if (!this.videoEl?.srcObject) {
        const newVideo = await this.cameraManager.start();
        this.videoEl = newVideo;
        container.insertBefore(newVideo, container.firstChild);
      }

      if (this.videoEl) {
        this.videoEl.style.display = "block";
      }

      await this.tracker.start();
    };

    const hideLaunchMenu = () => {
      arBtn.style.opacity = "0";
      arBtn.style.pointerEvents = "none";
      viewerBtn.style.opacity = "0";
      viewerBtn.style.pointerEvents = "none";
      arBtn.style.display = "none";
      viewerBtn.style.display = "none";
      backBtn.style.display = "block";
    };

    arBtn.onclick = () => {
      this.tracker.stop();

      if (this.videoEl?.srcObject) {
        const stream = this.videoEl.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        this.videoEl.srcObject = null;
      }

      if (this.videoEl) {
        this.videoEl.style.display = "none";
      }

      hideLaunchMenu();
      container.dispatchEvent(new Event("start-ar"));
    };

    viewerBtn.onclick = () => {
      this.tracker.stop();

      if (this.videoEl?.srcObject) {
        const stream = this.videoEl.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        this.videoEl.srcObject = null;
      }

      if (this.videoEl) {
        this.videoEl.style.display = "none";
      }

      hideLaunchMenu();
      this.scene.setModule(new GenericModelModule(this.selectedModel));
    };

    backBtn.onclick = async () => {
      await showLaunchMenu();
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
