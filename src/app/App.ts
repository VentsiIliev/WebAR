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
  private isSwitching = false;
  private activePointerIds = new Set<number>();

  async start(container: HTMLElement) {
    const video = await this.cameraManager.start();
    container.appendChild(video);

    this.scene = new SceneManager(container);
    this.scene.start();

    this.setMode(this.mode, container);

    container.addEventListener("pointerdown", (event) => {
      if (this.mode !== "model") return;

      if (event.pointerType === "touch") {
        this.activePointerIds.add(event.pointerId);
      }

      if (this.activePointerIds.size > 1) {
        return; // Ignore pinch/zoom touch gestures for double-tap detection
      }

      const now = Date.now();
      if (now - this.lastTap < 300) {
        this.scene.onDoubleTap();
      }
      this.lastTap = now;
    });

    container.addEventListener("pointerup", (event) => {
      if (event.pointerType === "touch") {
        this.activePointerIds.delete(event.pointerId);
      }
    });

    container.addEventListener("pointercancel", (event) => {
      if (event.pointerType === "touch") {
        this.activePointerIds.delete(event.pointerId);
      }
    });

    const button = document.createElement("button");
    button.innerText = "Switch Mode";
    button.style.position = "absolute";
    button.style.top = "20px";
    button.style.left = "20px";
    button.style.zIndex = "10";

    button.onclick = () => {
      if (this.isSwitching) return;  // Prevent rapid switching
      
      this.isSwitching = true;
      this.mode = this.mode === "rubik" ? "model" : "rubik";
      this.setMode(this.mode, container);
      
      // Re-enable switching after a brief delay
      setTimeout(() => {
        this.isSwitching = false;
      }, 300);
    };

    container.appendChild(button);

    this.tracker.onPose((pose) => {
      this.scene.updatePose(pose);
    });

    await this.tracker.start();

    // Desktop testing: emit fake poses to simulate marker tracking
    setInterval(() => {
      this.tracker.emitPose({
        position: [0, 0, -1],
        rotation: [0, 0, 0],
        visible: true,
      });
    }, 16);
  }

  private setMode(mode: ExperienceMode, container: HTMLElement) {
    console.log("Switching mode from", this.mode, "to", mode);
    this.gestures.detach();

    const module = mode === "rubik"
      ? new RubikModule()
      : new GenericModelModule();

    this.scene.setModule(module);

    if (mode === "model") {
      this.gestures.attach(this.scene.getGestureTarget(), container);
    }
    console.log("Mode switched successfully to", mode);
  }
}
