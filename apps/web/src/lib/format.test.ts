import { describe, expect, it } from 'vitest';
import {
  factKindLabel,
  formatMonth,
  formatPeriod,
  languagesLine,
  linkText,
  roleKindLabel,
  rolePlace,
} from './format';

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

describe('roleKindLabel', () => {
  it('labels everything except a regular job, so overlapping dates explain themselves', () => {
    expect(roleKindLabel('employee')).toBeNull();
    expect(roleKindLabel('contract')).toBe('Contract');
    expect(roleKindLabel('freelance')).toBe('Freelance');
  });
});

describe('factKindLabel', () => {
  it('never calls a design parameter a measurement', () => {
    expect(factKindLabel('measured')).toBe('measured');
    expect(factKindLabel('parameter')).toBe('design parameter');
    expect(factKindLabel('design')).toBe('design');
  });
});

describe('rolePlace', () => {
  it('adds remote to the location only when the role was remote', () => {
    expect(rolePlace({ location: 'Baku, Azerbaijan', remote: true })).toBe(
      'Baku, Azerbaijan (remote)',
    );
    expect(rolePlace({ location: 'Berlin', remote: false })).toBe('Berlin');
  });
});

describe('languagesLine', () => {
  it('lists each language with its level in lower case', () => {
    const languages = [
      { name: 'English', level: 'Professional' },
      { name: 'Azerbaijani', level: 'Native' },
    ];
    expect(languagesLine(languages)).toBe('English (professional), Azerbaijani (native)');
  });
});

describe('linkText', () => {
  it('shows a link without its scheme or www', () => {
    expect(linkText('https://www.linkedin.com/in/someone')).toBe('linkedin.com/in/someone');
    expect(linkText('https://github.com/someone')).toBe('github.com/someone');
  });
});
