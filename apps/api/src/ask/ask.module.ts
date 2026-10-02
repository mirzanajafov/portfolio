import { Module } from '@nestjs/common';
import { content } from '@portfolio/content';
import { ANSWER_ENGINE } from './answer-engine.js';
import { AskController } from './ask.controller.js';
import { AskService } from './ask.service.js';
import { KeywordAnswerEngine } from './keyword-engine.js';
import { Knowledge, buildKnowledge } from './knowledge.js';

@Module({
  controllers: [AskController],
  providers: [
    { provide: Knowledge, useFactory: () => buildKnowledge(content) },
    {
      provide: ANSWER_ENGINE,
      useFactory: (knowledge: Knowledge) => new KeywordAnswerEngine(knowledge),
      inject: [Knowledge],
    },
    { provide: 'CONTACT_EMAIL', useValue: content.profile.links.email },
    AskService,
  ],
})
export class AskModule {}
