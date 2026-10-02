import type { NestExpressApplication } from '@nestjs/platform-express';
import { ENV, trustProxySetting, type Env } from './config/env.js';

export function configureApp(app: NestExpressApplication): void {
  const env = app.get<Env>(ENV);
  app.set('trust proxy', trustProxySetting(env.TRUST_PROXY));
  app.enableShutdownHooks();
}
