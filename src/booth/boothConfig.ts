export type BoothConfig = {
  path: string;
  scale?: number;
};

// 👉 Change ONLY this file to swap booth model
export const BOOTH_CONFIG: BoothConfig = {
  path: "/models/booth.glb",
  scale: 1
};
