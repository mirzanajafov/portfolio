import { z } from 'zod';

const positive = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: positive(3201),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgresql:// URL'),
    CLIENT_HASH_SECRET: z.string().min(16),
    TRUST_PROXY: z.string().default('loopback'),
    GEO_DIR: z.string().optional(),
    WEB_URL: z.url().default('http://portfolio-web:3200'),
    CV_RENDER_TOKEN: z.string().min(32).optional(),
    ASK_PER_CLIENT_10_MIN: positive(20),
    ASK_PER_CLIENT_DAY: positive(100),
    ASK_PER_DAY: positive(2000),
    EVENTS_PER_ADDRESS_10_MIN: positive(300),
    EVENTS_PER_ADDRESS_DAY: positive(3000),
    EVENTS_PER_DAY: positive(20_000),
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.CLIENT_HASH_SECRET.length >= 32, {
    message: 'must be at least 32 characters in production',
    path: ['CLIENT_HASH_SECRET'],
  });

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol('ENV');

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function trustProxySetting(value: string): string[] | false {
  return value === 'false' ? false : value.split(',').map((part) => part.trim());
}
