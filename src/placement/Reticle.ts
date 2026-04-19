import * as THREE from "three";

export function createReticle(): THREE.Group {
  const group = new THREE.Group();

  const baseMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    side: THREE.DoubleSide,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });

  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0x7c5cff,
    side: THREE.DoubleSide,
    depthTest: false,
    transparent: true,
    opacity: 0.35,
  });

  const dotMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
    baseMaterial
  );
  ring.name = "reticle-ring";

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.11, 0.15, 40).rotateX(-Math.PI / 2),
    haloMaterial
  );
  halo.name = "reticle-halo";

  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.015, 24).rotateX(-Math.PI / 2),
    dotMaterial
  );
  dot.name = "reticle-dot";

  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.18, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x8fd3ff,
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.45,
    })
  );
  beacon.position.y = 0.09;
  beacon.name = "reticle-beacon";

  const beaconTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 12, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      depthTest: false,
      transparent: true,
      opacity: 0.85,
    })
  );
  beaconTop.position.y = 0.18;
  beaconTop.name = "reticle-beacon-top";

  group.add(halo);
  group.add(ring);
  group.add(dot);
  group.add(beacon);
  group.add(beaconTop);

  group.visible = false;
  group.matrixAutoUpdate = false;

  return group;
}
