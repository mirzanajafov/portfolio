import { hostName, refCode } from '@portfolio/content/analytics';
import { channels, statuses } from '@portfolio/content/applications';
import { z } from 'zod';

const day = z.iso.date().transform((value) => new Date(value));

const text = (max: number) => z.string().trim().min(1).max(max);

export const codeSchema = z.string().regex(refCode);

export const newApplicationSchema = z.strictObject({
  company: text(200),
  role: text(200),
  appliedOn: day,
  channel: z.enum(channels),
  cvVariant: text(100),
  code: codeSchema.optional(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  city: text(100).optional(),
  atsHost: z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[/?#].*$/, ''))
    .pipe(z.string().regex(hostName))
    .optional(),
  networks: z.array(text(100)).max(10).default([]),
});

export const applicationEditSchema = newApplicationSchema
  .pick({ company: true, role: true, channel: true, cvVariant: true })
  .extend({
    status: z.enum(statuses),
    answeredOn: day,
    notes: z.string().trim().max(2000),
  })
  .partial()
  .refine((edit) => Object.keys(edit).length > 0, 'an edit changes at least one field');

export type NewApplication = z.infer<typeof newApplicationSchema>;

export type ApplicationEdit = z.infer<typeof applicationEditSchema>;
