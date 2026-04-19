export interface ModelOption {
  id: string;
  label: string;
  path: string;
  // Desktop / generic preview behavior
  previewMode?: "fit" | "fixed";
  previewScale?: number;
  previewTargetSize?: number;
  // AR / WebXR placement scale, where 1 unit = 1 meter
  placementScale?: number;
}

export const MODEL_CATALOG: ModelOption[] = [
  {
    id: "car",
    label: "Car",
    path: "/models/Car.glb",
    previewMode: "fit",
    previewTargetSize: 2.2,
    placementScale: 1,
  },
  {
    id: "disk",
    label: "Disk",
    path: "/models/disk.glb",
    previewMode: "fit",
    previewTargetSize: 1.4,
    placementScale: 1,
  },
  {
    id: "cobot",
    label: "Cobot",
    path: "/models/cobot.glb",
    previewMode: "fit",
    previewTargetSize: 2,
    placementScale: 1,
  },
  {
    id: "brainstem",
    label: "BrainStem",
    path: "/models/BrainStem.glb",
    previewMode: "fit",
    previewTargetSize: 1.4,
    placementScale: 1,
  },
];
