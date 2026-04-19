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
    id: "table",
    label: "Table",
    path: "/models/table.glb",
    previewMode: "fit",
    previewTargetSize: 2,
    placementScale: 1,
  },
];
