import { describe, expect, it } from 'vitest';
import { labelPosition } from './label-position';

describe('labelPosition', () => {
  it('puts a label over its node when the node is well inside the frame', () => {
    expect(labelPosition({ x: 0, y: 0, z: 0.5 }, 800, 600, 30)).toEqual({ left: 400, top: 300 });
  });

  it('keeps a label for a node on the edge whole instead of cutting it in half', () => {
    const left = labelPosition({ x: -0.98, y: 0, z: 0.5 }, 800, 600, 40)?.left;
    expect(left).toBe(46);
    const right = labelPosition({ x: 0.99, y: 0, z: 0.5 }, 800, 600, 40)?.left;
    expect(right).toBe(754);
  });

  it('hides the label once its node leaves the frame or sits behind the camera', () => {
    expect(labelPosition({ x: -1.05, y: 0, z: 0.5 }, 800, 600, 40)).toBeNull();
    expect(labelPosition({ x: 0, y: 1.1, z: 0.5 }, 800, 600, 40)).toBeNull();
    expect(labelPosition({ x: 0, y: 0, z: 1.2 }, 800, 600, 40)).toBeNull();
  });

  it('centers a label that is wider than the frame rather than pushing it off one side', () => {
    expect(labelPosition({ x: 0.5, y: 0, z: 0.5 }, 60, 600, 50)?.left).toBe(30);
  });
});
