export interface ModelOption {
  id: string;
  label: string;
  path: string;
  previewMode?: "fit" | "fixed";
  previewScale?: number;
  previewTargetSize?: number;
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
    placementScale: 0.2,
  },
  {
    id: "table",
    label: "Table",
    path: "/models/table.glb",
    previewMode: "fit",
    previewTargetSize: 2,
    placementScale: 1,
  },
  {
    id: "cobot",
    label: "Cobot",
    path: "/models/cobot.glb",
    previewMode: "fit",
    previewTargetSize: 2,
    placementScale: 0.01,
  },
  {
    id: "brainstem",
    label: "BrainStem",
    path: "/models/BrainStem.glb",
    previewMode: "fit",
    previewTargetSize: 1.4,
    placementScale: 0.2,
  },
];
