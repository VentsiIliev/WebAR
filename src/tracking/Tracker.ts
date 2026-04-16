export interface Pose {
  position: [number, number, number];
  rotation: [number, number, number];
  visible: boolean;
}

export interface Tracker {
  start(): Promise<void>;
  stop(): void;
  onPose(callback: (pose: Pose) => void): void;
}
