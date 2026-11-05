import { Inject, Injectable } from '@nestjs/common';
import type { Content } from '@portfolio/content';
import { demoNames, pageNames } from '@portfolio/content/analytics';
import { CONTENT } from '../content.js';
import type { Prisma } from '../generated/prisma/client.js';
import { firstVisitText } from './first-visit-text.js';
import { TELEGRAM, type Telegram } from './telegram.js';

export type FirstView = { path: string; demo: string | null; notFound: boolean };

const offTheSite = "a page that isn't on the site";

@Injectable()
export class AlertsService {
  private readonly demoNames: Map<string, string>;
  private readonly pageNames: Map<string, string>;

  constructor(
    @Inject(TELEGRAM) private readonly telegram: Telegram | null,
    @Inject(CONTENT) content: Content,
  ) {
    this.demoNames = demoNames(content);
    this.pageNames = pageNames(content);
  }

  async queueFirstVisit(
    tx: Prisma.TransactionClient,
    application: { company: string; role: string },
    firstView: FirstView,
    at: Date,
  ): Promise<void> {
    if (!this.telegram) {
      return;
    }
    const text = firstVisitText(application, this.firstPageOf(firstView), at);
    await tx.alert.create({ data: { createdAt: at, nextAttemptAt: at, text } });
  }

  private firstPageOf({ path, demo, notFound }: FirstView): string {
    if (demo !== null) {
      return this.demoNames.get(demo) ?? offTheSite;
    }
    return notFound ? offTheSite : (this.pageNames.get(path) ?? offTheSite);
  }
}
