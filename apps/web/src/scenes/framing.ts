import { type PerspectiveCamera, Vector3 } from 'three';

type Margins = { top: number; side: number; bottom: number };

const worldUp = new Vector3(0, 1, 0);

function axes(direction: Vector3) {
  const right = worldUp.clone().cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  return { right, up };
}

export function viewFrom(tilt: number, swing: number): Vector3 {
  return new Vector3(
    Math.sin(swing) * Math.cos(tilt),
    Math.sin(tilt),
    Math.cos(swing) * Math.cos(tilt),
  );
}

export function frame(
  points: Vector3[],
  direction: Vector3,
  aspect: number,
  fov: number,
  margins: Margins,
  center: Vector3,
): { distance: number; shift: number } {
  const { right, up } = axes(direction);
  const tan = Math.tan((fov * Math.PI) / 360);
  const relative = new Vector3();
  const measured = points.map((point) => {
    relative.subVectors(point, center);
    return {
      along: relative.dot(direction),
      across: Math.abs(relative.dot(right)),
      height: relative.dot(up),
    };
  });
  const shiftAt = (distance: number): number | null => {
    let low = -Infinity;
    let high = Infinity;
    for (const { along, across, height } of measured) {
      const reach = (distance - along) * tan;
      if (reach <= 0 || across > reach * aspect * margins.side) return null;
      low = Math.max(low, height - reach * margins.top);
      high = Math.min(high, height + reach * margins.bottom);
    }
    return low <= high ? (low + high) / 2 : null;
  };
  let near = 1;
  let far = 1000;
  for (let i = 0; i < 40; i += 1) {
    const middle = (near + far) / 2;
    if (shiftAt(middle) === null) near = middle;
    else far = middle;
  }
  return { distance: far, shift: shiftAt(far) ?? 0 };
}

const target = new Vector3();

export function aim(
  camera: PerspectiveCamera,
  points: Vector3[],
  direction: Vector3,
  margins: Margins,
  center: Vector3,
) {
  const { distance, shift } = frame(points, direction, camera.aspect, camera.fov, margins, center);
  target.copy(center).addScaledVector(axes(direction).up, shift);
  camera.position.copy(target).addScaledVector(direction, distance);
  camera.lookAt(target);
}
