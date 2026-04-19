import * as THREE from "three";

export function createReticle(): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  mesh.matrixAutoUpdate = false;

  return mesh;
}
