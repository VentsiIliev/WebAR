import { CameraManager } from "../camera/CameraManager";
import { MarkerTracker } from "../tracking/MarkerTracker";
import { SceneManager } from "../scene/SceneManager";
import { GestureController } from "../interaction/GestureController";
import { RubikModule } from "../modules/RubikModule";
import { GenericModelModule } from "../modules/GenericModelModule";
import { PlacementModule } from "../modules/PlacementModule";
import { MODEL_CATALOG, ModelOption } from "../models/modelCatalog";
import type { ExperienceMode } from "../modules/ExperienceModule";

export class App {
  private cameraManager = new CameraManager();
  private tracker = new MarkerTracker();
  private scene!: SceneManager;
  private gestures = new GestureController();

  private mode: ExperienceMode = "rubik";
  private selectedModel: ModelOption = MODEL_CATALOG[0];
  private isSwitching = false;
  private videoEl?: HTMLVideoElement;

  async start(container: HTMLElement) {
    const video = await this.cameraManager.start();
    this.videoEl = video;
    container.appendChild(video);

    this.scene = new SceneManager(container);
    this.scene.start();

    this.setMode(this.mode, container);

    const select = document.createElement("select");
    select.style.position = "absolute";
    select.style.top = "60px";
    select.style.left = "20px";
    select.style.zIndex = "1000";

    MODEL_CATALOG.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.text = model.label;
      select.appendChild(option);
    });

    select.onchange = () => {
      const found = MODEL_CATALOG.find((m) => m.id === select.value);
      if (found) {
        this.selectedModel = found;
        this.setMode(this.mode, container);
      }
    };

    container.appendChild(select);

    const switchBtn = document.createElement("button");
    switchBtn.innerText = "Switch Mode";
    switchBtn.style.position = "absolute";
    switchBtn.style.top = "20px";
    switchBtn.style.left = "20px";
    switchBtn.style.zIndex = "1000";

    const arBtn = document.createElement("button");
    arBtn.innerText = "Start AR";
    arBtn.style.position = "absolute";
    arBtn.style.top = "20px";
    arBtn.style.left = "140px";
    arBtn.style.zIndex = "1000";

    arBtn.onclick = () => {
      if (this.mode !== "placement") return;

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

    switchBtn.onclick = async () => {
      if (this.isSwitching) return;
      this.isSwitching = true;

      if (this.mode === "rubik") this.mode = "model";
      else if (this.mode === "model") this.mode = "placement";
      else this.mode = "rubik";

      this.setMode(this.mode, container);

      if (this.mode !== "placement" && (!this.videoEl || !this.videoEl.srcObject)) {
        const newVideo = await this.cameraManager.start();
        this.videoEl = newVideo;
        container.insertBefore(newVideo, container.firstChild);
        await this.tracker.start();
      }

      setTimeout(() => {
        this.isSwitching = false;
      }, 300);
    };

    container.appendChild(switchBtn);
    container.appendChild(arBtn);

    this.tracker.onPose((pose) => {
      this.scene.updatePose(pose);
    });

    await this.tracker.start();
  }

  private setMode(mode: ExperienceMode, container: HTMLElement) {
    this.gestures.detach();

    let module;
    if (mode === "rubik") module = new RubikModule();
    else if (mode === "model") module = new GenericModelModule(this.selectedModel);
    else module = new PlacementModule(this.selectedModel);

    this.scene.setModule(module);

    if (mode === "model") {
      this.gestures.attach(this.scene.getGestureTarget(), container);
    }
  }
}
