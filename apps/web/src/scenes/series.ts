export function sampleAt(values: readonly number[], index: number): number {
  const value = values[Math.min(values.length - 1, Math.max(0, Math.floor(index)))];
  if (value === undefined) {
    throw new RangeError('an empty series has no samples');
  }
  return value;
}
