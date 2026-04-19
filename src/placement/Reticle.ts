import * as THREE from "three";

export function createReticle(): THREE.Group {
  const group = new THREE.Group();

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.95
    })
  );

  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.015, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      depthTest: false
    })
  );

  group.add(ring);
  group.add(dot);

  group.visible = false;
  group.matrixAutoUpdate = false;

  return group;
}
