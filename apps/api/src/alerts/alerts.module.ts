import { Module } from '@nestjs/common';
import { ENV } from '../config/env.js';
import { AlertSenderService } from './alert-sender.service.js';
import { AlertsService } from './alerts.service.js';
import { TELEGRAM, telegramOf } from './telegram.js';

@Module({
  providers: [
    { provide: TELEGRAM, useFactory: telegramOf, inject: [ENV] },
    AlertsService,
    AlertSenderService,
  ],
  exports: [AlertsService],
})
export class AlertsModule {}
