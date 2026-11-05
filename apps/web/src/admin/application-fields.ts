import type { ApplicationView } from '@portfolio/content/applications';

const sharedFields = [
  'company',
  'role',
  'appliedOn',
  'channel',
  'cvVariant',
  'country',
  'city',
  'atsHost',
  'networks',
] as const;

export const addFields = [...sharedFields, 'code'] as const;

export const editFields = [...sharedFields, 'status', 'answeredOn', 'notes'] as const;

export type FieldName = (typeof addFields)[number] | (typeof editFields)[number];

export type FormValues = Partial<Record<FieldName, string>>;

export function shownValues(
  application: ApplicationView,
): Record<(typeof editFields)[number], string> {
  return {
    company: application.company,
    role: application.role,
    appliedOn: application.appliedOn,
    channel: application.channel,
    cvVariant: application.cvVariant,
    status: application.status,
    answeredOn: application.answeredOn ?? '',
    notes: application.notes,
    country: application.country ?? '',
    city: application.city ?? '',
    atsHost: application.atsHost ?? '',
    networks: application.networks.join('\n'),
  };
}
