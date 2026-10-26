import type { Cv, Role } from '@portfolio/content';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMonth(value: string): string {
  const [year, month] = value.split('-');
  const name = months[Number(month) - 1];
  if (!year || !name) {
    throw new Error(`not a YYYY-MM month: ${value}`);
  }
  return `${name} ${year}`;
}

export function formatPeriod(role: Pick<Role, 'from' | 'to'>): string {
  const end = role.to === 'present' ? 'present' : formatMonth(role.to);
  return `${formatMonth(role.from)} – ${end}`;
}

const kindLabels: Record<Role['kind'], string | null> = {
  employee: null,
  contract: 'Contract',
  freelance: 'Freelance',
  'part-time': 'Part-time',
};

export function kindLabel(kind: Role['kind']): string | null {
  return kindLabels[kind];
}

export function rolePlace(role: Pick<Role, 'location' | 'remote'>): string {
  return role.remote ? `${role.location} (remote)` : role.location;
}

export function roleKey(role: Pick<Role, 'company' | 'role' | 'from'>): string {
  return `${role.company ?? role.role}-${role.from}`;
}

export function languagesLine(languages: Cv['languages']): string {
  return languages
    .map((language) => `${language.name} (${language.level.toLowerCase()})`)
    .join(', ');
}

export function linkText(url: string): string {
  return url.replace(/^https:\/\/(www\.)?/, '');
}
