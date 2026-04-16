import { CameraManager } from "../camera/CameraManager";
import { MarkerTracker } from "../tracking/MarkerTracker";
import { SceneManager } from "../scene/SceneManager";
import { GestureController } from "../interaction/GestureController";

export class App {
  private cameraManager = new CameraManager();
  private tracker = new MarkerTracker();
  private scene!: SceneManager;
  private gestures = new GestureController();

  private lastTap = 0;

  async start(container: HTMLElement) {
    const video = await this.cameraManager.start();
    container.appendChild(video);

    this.scene = new SceneManager(container);
    this.scene.start();

    // attach gestures
    this.gestures.attach(this.scene.getAnchor().userGroup, container);

    // double tap detection
    container.addEventListener("pointerdown", () => {
      const now = Date.now();
      if (now - this.lastTap < 300) {
        this.scene.toggleExplode();
      }
      this.lastTap = now;
    });

    this.tracker.onPose((pose) => {
      this.scene.updatePose(pose);
    });

    await this.tracker.start();

    // TEMP: simulate pose
    setInterval(() => {
      this.tracker["emitPose"]?.({
        position: [0, 0, -1],
        rotation: [0, Date.now() * 0.001, 0],
        visible: true,
      });
    }, 16);
  }
}
