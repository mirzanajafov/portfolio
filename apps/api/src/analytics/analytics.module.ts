import { Logger, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';
import { PLACE_LOOKUP, openPlaceLookup } from './place-lookup.js';
import { RetentionService } from './retention.service.js';
import { VisitLogService } from './visit-log.service.js';
import { VisitorSaltService } from './visitor-salt.service.js';

@Module({
  imports: [RateLimitModule],
  controllers: [EventsController],
  providers: [
    {
      provide: PLACE_LOOKUP,
      useFactory: ({ GEO_DIR }: Env) => openPlaceLookup(GEO_DIR, new Logger('PlaceLookup')),
      inject: [ENV],
    },
    EventsService,
    RetentionService,
    VisitLogService,
    VisitorSaltService,
  ],
})
export class AnalyticsModule {}
