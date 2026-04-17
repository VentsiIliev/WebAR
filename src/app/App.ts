import { CameraManager } from "../camera/CameraManager";
import { MarkerTracker } from "../tracking/MarkerTracker";
import { SceneManager } from "../scene/SceneManager";
import { GestureController } from "../interaction/GestureController";
import { RubikModule } from "../modules/RubikModule";
import { GenericModelModule } from "../modules/GenericModelModule";
import type { ExperienceMode } from "../modules/ExperienceModule";

export class App {
  private cameraManager = new CameraManager();
  private tracker = new MarkerTracker();
  private scene!: SceneManager;
  private gestures = new GestureController();

  private mode: ExperienceMode = "rubik";
  private lastTap = 0;

  async start(container: HTMLElement) {
    const video = await this.cameraManager.start();
    container.appendChild(video);

    this.scene = new SceneManager(container);
    this.scene.start();

    this.setMode(this.mode, container);

    // double tap
    container.addEventListener("pointerdown", () => {
      const now = Date.now();
      if (now - this.lastTap < 300) {
        this.scene.onDoubleTap();
      }
      this.lastTap = now;
    });

    // UI button
    const button = document.createElement("button");
    button.innerText = "Switch Mode";
    button.style.position = "absolute";
    button.style.top = "20px";
    button.style.left = "20px";
    button.style.zIndex = "10";

    button.onclick = () => {
      this.mode = this.mode === "rubik" ? "model" : "rubik";
      this.setMode(this.mode, container);
    };

    container.appendChild(button);

    this.tracker.onPose((pose) => {
      this.scene.updatePose(pose);
    });

    await this.tracker.start();

    // stable pose
    setInterval(() => {
      this.tracker["emitPose"]?.({
        position: [0, 0, -1],
        rotation: [0, 0, 0],
        visible: true,
      });
    }, 16);
  }

  private setMode(mode: ExperienceMode, container: HTMLElement) {
    const module = mode === "rubik"
      ? new RubikModule()
      : new GenericModelModule();

    this.scene.setModule(module);

    this.gestures.attach(this.scene.getGestureTarget(), container);
  }
}
