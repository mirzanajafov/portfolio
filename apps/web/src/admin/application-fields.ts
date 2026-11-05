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

export const clearableFields = ['country', 'city', 'atsHost'] as const;

export const addFields = [...sharedFields, 'code'] as const;

export const editFields = [...sharedFields, 'status', 'answeredOn', 'notes'] as const;

export type FieldName = (typeof addFields)[number] | (typeof editFields)[number];

export type FormValues = Partial<Record<FieldName, string>>;
