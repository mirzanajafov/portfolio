import { Module } from '@nestjs/common';
import type { Content } from '@portfolio/content';
import { CONTENT } from '../content.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { ANSWER_ENGINE } from './answer-engine.js';
import { AskLimitsService } from './ask-limits.service.js';
import { AskLogService } from './ask-log.service.js';
import { AskController } from './ask.controller.js';
import { AskService, CONTACT_EMAIL } from './ask.service.js';
import { KeywordAnswerEngine } from './keyword-engine.js';
import { Knowledge, buildKnowledge } from './knowledge.js';

@Module({
  imports: [RateLimitModule],
  controllers: [AskController],
  providers: [
    { provide: Knowledge, useFactory: buildKnowledge, inject: [CONTENT] },
    {
      provide: ANSWER_ENGINE,
      useFactory: (knowledge: Knowledge) => new KeywordAnswerEngine(knowledge),
      inject: [Knowledge],
    },
    {
      provide: CONTACT_EMAIL,
      useFactory: ({ profile }: Content) => profile.links.email,
      inject: [CONTENT],
    },
    AskService,
    AskLimitsService,
    AskLogService,
  ],
})
export class AskModule {}
