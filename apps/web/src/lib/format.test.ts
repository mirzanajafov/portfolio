import { describe, expect, it } from 'vitest';
import { formatMonth, formatPeriod, kindLabel } from './format';

describe('formatMonth', () => {
  it('turns YYYY-MM into a short month and year', () => {
    expect(formatMonth('2026-07')).toBe('Jul 2026');
    expect(formatMonth('2019-01')).toBe('Jan 2019');
  });

  it('refuses anything else instead of printing undefined', () => {
    expect(() => formatMonth('2026-13')).toThrow(/YYYY-MM/);
  });
});

describe('formatPeriod', () => {
  it('writes open-ended roles as present', () => {
    expect(formatPeriod({ from: '2025-09', to: 'present' })).toBe('Sep 2025 – present');
    expect(formatPeriod({ from: '2023-02', to: '2025-08' })).toBe('Feb 2023 – Aug 2025');
  });
});

describe('kindLabel', () => {
  it('labels everything except a regular job, so overlapping dates explain themselves', () => {
    expect(kindLabel('employee')).toBeNull();
    expect(kindLabel('contract')).toBe('Contract');
    expect(kindLabel('freelance')).toBe('Freelance');
  });
});
