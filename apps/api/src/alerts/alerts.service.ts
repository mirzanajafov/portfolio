import { Inject, Injectable } from '@nestjs/common';
import type { Content } from '@portfolio/content';
import { demoSites, pageNames } from '@portfolio/content/analytics';
import { CONTENT } from '../content.js';
import type { Prisma } from '../generated/prisma/client.js';
import { firstVisitText } from './first-visit-text.js';
import { TELEGRAM, type Telegram } from './telegram.js';

export type FirstView = { path: string; demo: string | null };

@Injectable()
export class AlertsService {
  private readonly demoNames: Map<string, string>;
  private readonly pageNames: Map<string, string>;

  constructor(
    @Inject(TELEGRAM) private readonly telegram: Telegram | null,
    @Inject(CONTENT) content: Content,
  ) {
    this.demoNames = new Map(
      [...demoSites(content).values()].map(({ slug, name }) => [slug, name]),
    );
    this.pageNames = pageNames(content);
  }

  async queueFirstVisit(
    tx: Prisma.TransactionClient,
    application: { company: string; role: string },
    { path, demo }: FirstView,
    at: Date,
  ): Promise<void> {
    if (!this.telegram) {
      return;
    }
    const firstPage =
      demo === null
        ? (this.pageNames.get(path) ?? "a page that isn't on the site")
        : `the ${this.demoNames.get(demo) ?? demo} demo`;
    await tx.alert.create({
      data: { createdAt: at, nextAttemptAt: at, text: firstVisitText(application, firstPage, at) },
    });
  }
}
