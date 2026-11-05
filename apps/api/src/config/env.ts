import { siteUrl } from '@portfolio/content';
import { z } from 'zod';

const positive = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const unsetWhenEmpty = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: positive(3201),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgresql:// URL'),
    CLIENT_HASH_SECRET: z.string().min(16),
    TRUST_PROXY: z.string().default('loopback'),
    GEO_DIR: z.string().optional(),
    WEB_URL: z.url().default('http://portfolio-web:3200'),
    SITE_ORIGIN: z
      .url({ protocol: /^https?$/ })
      .refine(
        (url) => new URL(url).origin === url,
        'must be an origin, such as https://najafov.dev',
      )
      .default(new URL(siteUrl).origin),
    CV_RENDER_TOKEN: z.string().min(32).optional(),
    ASK_PER_CLIENT_10_MIN: positive(20),
    ASK_PER_CLIENT_DAY: positive(100),
    ASK_PER_DAY: positive(2000),
    EVENTS_PER_ADDRESS_10_MIN: positive(300),
    EVENTS_PER_ADDRESS_DAY: positive(3000),
    EVENTS_PER_DAY: positive(20_000),
    TELEGRAM_API_URL: z.url().default('https://api.telegram.org'),
    TELEGRAM_BOT_TOKEN: unsetWhenEmpty,
    TELEGRAM_CHAT_ID: unsetWhenEmpty,
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.CLIENT_HASH_SECRET.length >= 32, {
    message: 'must be at least 32 characters in production',
    path: ['CLIENT_HASH_SECRET'],
  })
  .refine(
    (env) => (env.TELEGRAM_BOT_TOKEN === undefined) === (env.TELEGRAM_CHAT_ID === undefined),
    {
      message: 'set both TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID, or neither',
      path: ['TELEGRAM_CHAT_ID'],
    },
  );

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
