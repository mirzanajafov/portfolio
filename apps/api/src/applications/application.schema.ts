import { hostName, refCode } from '@portfolio/content/analytics';
import { channels, statuses } from '@portfolio/content/applications';
import { z } from 'zod';

const day = z.iso.date().transform((value) => new Date(value));

const text = (max: number) => z.string().trim().min(1).max(max);

const country = z
  .string()
  .trim()
  .regex(/^[a-z]{2}$/i)
  .transform((value) => value.toUpperCase());

const city = text(100);

const atsHost = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[/?#].*$/, ''))
  .pipe(z.string().regex(hostName));

const networks = z.array(text(100)).max(10);

export const codeSchema = z.string().regex(refCode);

export const newApplicationSchema = z.strictObject({
  company: text(200),
  role: text(200),
  appliedOn: day,
  channel: z.enum(channels),
  cvVariant: text(100),
  code: codeSchema.optional(),
  country: country.optional(),
  city: city.optional(),
  atsHost: atsHost.optional(),
  networks: networks.default([]),
});

export const applicationEditSchema = newApplicationSchema
  .pick({ company: true, role: true, appliedOn: true, channel: true, cvVariant: true })
  .extend({
    status: z.enum(statuses),
    answeredOn: day,
    notes: z.string().trim().max(2000),
    country: country.nullable(),
    city: city.nullable(),
    atsHost: atsHost.nullable(),
    networks,
  })
  .partial()
  .refine((edit) => Object.keys(edit).length > 0, 'an edit changes at least one field');

export const undoSchema = z.strictObject({ from: z.enum(statuses) });

export type NewApplication = z.infer<typeof newApplicationSchema>;

export type ApplicationEdit = z.infer<typeof applicationEditSchema>;

export type Undo = z.infer<typeof undoSchema>;
