import { Inject, Injectable } from '@nestjs/common';
import type { Content } from '@portfolio/content';
import { demoNames, pageNames } from '@portfolio/content/analytics';
import { CONTENT } from '../content.js';
import type { Prisma } from '../generated/prisma/client.js';
import { firstVisitText } from './first-visit-text.js';
import { TELEGRAM, type Telegram } from './telegram.js';

export type FirstView = { path: string; demo: string | null; notFound: boolean };

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
    { path, demo, notFound }: FirstView,
    at: Date,
  ): Promise<void> {
    if (!this.telegram) {
      return;
    }
    const firstPage =
      (demo === null ? this.pageNameOf(path, notFound) : this.demoNames.get(demo)) ??
      "a page that isn't on the site";
    await tx.alert.create({
      data: { createdAt: at, nextAttemptAt: at, text: firstVisitText(application, firstPage, at) },
    });
  }

  private pageNameOf(path: string, notFound: boolean): string | undefined {
    return notFound ? undefined : this.pageNames.get(path);
  }
}
