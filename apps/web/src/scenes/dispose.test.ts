import {
  BoxGeometry,
  BufferGeometry,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Scene,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeScene } from './dispose';

describe('disposeScene', () => {
  it('frees every geometry, material and instance buffer in the scene, nested ones included', () => {
    const scene = new Scene();
    const shared = new BoxGeometry();
    const group = new Group();
    const meshes = [
      new Mesh(shared, new MeshBasicMaterial()),
      new Mesh(shared, [new MeshBasicMaterial(), new MeshBasicMaterial()]),
    ];
    const lines = new LineSegments(new BufferGeometry(), new LineBasicMaterial());
    const points = new Points(new BufferGeometry(), new PointsMaterial());
    const instances = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 4);
    group.add(...meshes, points);
    scene.add(group, lines, instances);
    const resources = [
      shared,
      lines.geometry,
      lines.material,
      points.geometry,
      points.material,
      instances.geometry,
      instances.material,
      ...meshes.flatMap((mesh) => [mesh.material].flat()),
    ];
    const disposed = resources.map((resource) => vi.spyOn(resource, 'dispose'));
    const instanceBuffers = vi.spyOn(instances, 'dispose');

    disposeScene(scene);

    for (const spy of disposed) {
      expect(spy).toHaveBeenCalled();
    }
    expect(instanceBuffers).toHaveBeenCalledOnce();
  });
});
