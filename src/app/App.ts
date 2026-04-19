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

  private lastTap = 0;
  private isSwitching = false;

  async start(container: HTMLElement) {
    const video = await this.cameraManager.start();
    container.appendChild(video);

    this.scene = new SceneManager(container);
    this.scene.start();

    this.setMode(this.mode, container);

    const select = document.createElement("select");
    select.style.position = "absolute";
    select.style.top = "60px";
    select.style.left = "20px";
    select.style.zIndex = "1000";
    select.style.padding = "8px 10px";
    select.style.borderRadius = "8px";
    select.style.border = "1px solid rgba(255,255,255,0.3)";
    select.style.background = "rgba(20,20,20,0.85)";
    select.style.color = "white";
    select.style.fontSize = "14px";

    MODEL_CATALOG.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.text = model.label;
      select.appendChild(option);
    });

    select.value = this.selectedModel.id;

    select.onchange = () => {
      const found = MODEL_CATALOG.find((m) => m.id === select.value);
      if (found) {
        this.selectedModel = found;
        this.setMode(this.mode, container);
      }
    };

    container.appendChild(select);

    const button = document.createElement("button");
    button.innerText = "Switch Mode";
    button.style.position = "absolute";
    button.style.top = "20px";
    button.style.left = "20px";
    button.style.zIndex = "1000";
    button.style.padding = "10px 14px";
    button.style.borderRadius = "8px";
    button.style.border = "1px solid rgba(255,255,255,0.3)";
    button.style.background = "rgba(20,20,20,0.85)";
    button.style.color = "white";
    button.style.fontSize = "14px";
    button.style.cursor = "pointer";

    button.onclick = () => {
      if (this.isSwitching) return;

      this.isSwitching = true;

      if (this.mode === "rubik") this.mode = "model";
      else if (this.mode === "model") this.mode = "placement";
      else this.mode = "rubik";

      this.setMode(this.mode, container);

      setTimeout(() => (this.isSwitching = false), 300);
    };

    container.appendChild(button);

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
