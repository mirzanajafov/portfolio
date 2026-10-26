import {
  InstancedMesh,
  Line,
  Mesh,
  Points,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';

type Drawn = Object3D & { geometry: BufferGeometry; material: Material | Material[] };

function isDrawn(node: Object3D): node is Drawn {
  return node instanceof Mesh || node instanceof Line || node instanceof Points;
}

export function disposeScene(root: Object3D): void {
  root.traverse((node) => {
    if (isDrawn(node)) {
      node.geometry.dispose();
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        material.dispose();
      }
    }
    if (node instanceof InstancedMesh) {
      node.dispose();
    }
  });
}
