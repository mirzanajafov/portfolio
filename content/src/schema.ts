import { z } from 'zod';

export const profileSchema = z.strictObject({
  name: z.string().min(1),
  alternateNames: z.array(z.string().min(1)).default([]),
  headline: z.string().min(1),
  location: z.string().min(1),
  timezone: z.string().regex(/^UTC[+-]\d{1,2}$/),
  availability: z.string().min(1),
  summary: z.string().min(1).max(400),
  links: z.strictObject({
    email: z.email(),
    github: z.url(),
    linkedin: z.url(),
  }),
});

export const contentSchema = z.strictObject({
  profile: profileSchema,
});

export type Profile = z.infer<typeof profileSchema>;
export type Content = z.infer<typeof contentSchema>;
