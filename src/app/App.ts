import { CameraManager } from "../camera/CameraManager";
import { MarkerTracker } from "../tracking/MarkerTracker";
import { SceneManager } from "../scene/SceneManager";
import { PlacementModule } from "../modules/PlacementModule";
import { MODEL_CATALOG, ModelOption } from "../models/modelCatalog";

export class App {
  private cameraManager = new CameraManager();
  private tracker = new MarkerTracker();
  private scene!: SceneManager;

  private selectedModel: ModelOption = MODEL_CATALOG[0];
  private videoEl?: HTMLVideoElement;

  async start(container: HTMLElement) {
    const video = await this.cameraManager.start();
    this.videoEl = video;
    container.appendChild(video);

    this.scene = new SceneManager(container);
    this.scene.start();

    this.scene.setModule(new PlacementModule(this.selectedModel));

    const arBtn = document.createElement("button");
    arBtn.innerText = "Start AR";

    arBtn.style.position = "absolute";
    arBtn.style.top = "50%";
    arBtn.style.left = "50%";
    arBtn.style.transform = "translate(-50%, -50%)";
    arBtn.style.zIndex = "1000";

    arBtn.style.padding = "18px 36px";
    arBtn.style.fontSize = "20px";
    arBtn.style.fontWeight = "600";
    arBtn.style.borderRadius = "14px";
    arBtn.style.background = "linear-gradient(135deg, #6a5cff, #00aaff)";
    arBtn.style.color = "white";
    arBtn.style.border = "none";
    arBtn.style.cursor = "pointer";
    arBtn.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
    arBtn.style.transition = "all 0.2s ease";

    arBtn.onmousedown = () => {
      arBtn.style.transform = "translate(-50%, -50%) scale(0.95)";
    };
    arBtn.onmouseup = () => {
      arBtn.style.transform = "translate(-50%, -50%) scale(1)";
    };
    arBtn.onmouseleave = () => {
      arBtn.style.transform = "translate(-50%, -50%) scale(1)";
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

      arBtn.style.opacity = "0";
      arBtn.style.pointerEvents = "none";

      container.dispatchEvent(new Event("start-ar"));
    };

    container.appendChild(arBtn);

    this.tracker.onPose((pose) => {
      this.scene.updatePose(pose);
    });

    await this.tracker.start();
  }
}
