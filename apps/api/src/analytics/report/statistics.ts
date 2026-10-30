export function percentile(values: readonly number[], fraction: number): number | null {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)] ?? null;
}

export function median(values: readonly number[]): number | null {
  return percentile(values, 0.5);
}

export function groupBy<T, K extends string>(
  items: readonly T[],
  keyOf: (item: T) => K,
): [K, T[]][] {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return [...groups].sort(
    ([a, groupA], [b, groupB]) => groupB.length - groupA.length || a.localeCompare(b),
  );
}

export function tally<T, K extends string>(
  items: readonly T[],
  keyOf: (item: T) => K,
): [K, number][] {
  return groupBy(items, keyOf).map(([key, group]) => [key, group.length]);
}
