import { Tracker, Pose } from "./Tracker";

export class MarkerTracker implements Tracker {
  private callback?: (pose: Pose) => void;

  async start(): Promise<void> {
    console.log("MarkerTracker started");
  }

  stop(): void {
    console.log("MarkerTracker stopped");
  }

  onPose(callback: (pose: Pose) => void): void {
    this.callback = callback;
  }

  // Emit a pose to all registered callbacks
  emitPose(pose: Pose): void {
    this.callback?.(pose);
  }
}
