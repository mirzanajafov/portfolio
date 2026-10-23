export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

export function plural(count: number, one: string, many: string): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

export function formatClock(value: number): string {
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}
