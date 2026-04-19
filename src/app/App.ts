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

    // 🔥 ALWAYS use placement mode
    this.scene.setModule(new PlacementModule(this.selectedModel));

    const arBtn = document.createElement("button");
    arBtn.innerText = "Start AR";
    arBtn.style.position = "absolute";
    arBtn.style.top = "20px";
    arBtn.style.left = "20px";
    arBtn.style.zIndex = "1000";

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

      container.dispatchEvent(new Event("start-ar"));
    };

    container.appendChild(arBtn);

    this.tracker.onPose((pose) => {
      this.scene.updatePose(pose);
    });

    await this.tracker.start();
  }
}
