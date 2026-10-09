export type Projected = { x: number; y: number; z: number };

export function labelPosition(
  projected: Projected,
  width: number,
  height: number,
  halfLabel: number,
  margin = 6,
): { left: number; top: number } | null {
  const inside = projected.z < 1 && Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1;
  if (!inside) {
    return null;
  }
  const edge = Math.min(halfLabel + margin, width / 2);
  const left = ((projected.x + 1) / 2) * width;
  return {
    left: Math.min(Math.max(left, edge), width - edge),
    top: ((1 - projected.y) / 2) * height,
  };
}
