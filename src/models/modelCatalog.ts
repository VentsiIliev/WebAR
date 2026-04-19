export interface ModelOption {
  id: string;
  label: string;
  path: string;
}

export const MODEL_CATALOG: ModelOption[] = [
  {
    id: "car",
    label: "Car",
    path: "/models/Car.glb",
  },
  {
    id: "disk",
    label: "Disk",
    path: "/models/disk.glb",
  },
  {
    id: "cobot",
    label: "Cobot",
    path: "/models/cobot.glb",
  },
  {
    id: "brainstem",
    label: "BrainStem",
    path: "/models/BrainStem.glb",
  },
];
