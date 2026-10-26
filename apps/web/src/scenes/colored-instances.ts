import {
  type BufferGeometry,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  type MeshBasicMaterial,
} from 'three';

export function coloredInstances<G extends BufferGeometry>(
  geometry: G,
  material: MeshBasicMaterial,
  count: number,
): InstancedMesh<G, MeshBasicMaterial> {
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  const white = new Color(1, 1, 1);
  for (let i = 0; i < count; i += 1) {
    mesh.setColorAt(i, white);
  }
  mesh.count = 0;
  return mesh;
}
