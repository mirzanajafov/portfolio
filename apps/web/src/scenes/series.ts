import { MathUtils } from 'three';

export function commonLength(series: readonly (readonly number[])[]): number {
  const length = series[0]?.length ?? 0;
  if (length === 0 || series.some((values) => values.length !== length)) {
    throw new RangeError('every series needs the same, non-zero number of samples');
  }
  return length;
}

export function sampleAt(values: readonly number[], index: number): number {
  const value = values[MathUtils.clamp(Math.floor(index), 0, values.length - 1)];
  if (value === undefined) {
    throw new RangeError('an empty series has no samples');
  }
  return value;
}
