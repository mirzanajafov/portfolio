import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { adminToken } from '@portfolio/content/admin';
import { reportDaysSchema, type Report } from '@portfolio/content/report';
import type { Request } from 'express';
import { z } from 'zod';
import { AdminSessionsService } from '../admin-sessions/admin-sessions.service.js';
import { AnalyticsReportService } from '../analytics/report/analytics-report.service.js';
import { clientAddress } from '../common/caller.js';
import { TooManyRequestsException } from '../common/too-many-requests.exception.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { SignedInGuard, type SignedInRequest } from './signed-in.guard.js';

const signInSchema = z.strictObject({ token: z.string().regex(adminToken) });

type SignInRequest = z.infer<typeof signInSchema>;

const reportQuery = z.strictObject({ days: reportDaysSchema });

type ReportQuery = z.infer<typeof reportQuery>;

@Controller('admin')
export class AdminController {
  constructor(
    private readonly sessions: AdminSessionsService,
    private readonly reports: AnalyticsReportService,
  ) {}

  @Post('sessions')
  async signIn(
    @Body(new ZodPipe(signInSchema)) { token }: SignInRequest,
    @Req() req: Request,
  ): Promise<{ token: string; expiresAt: Date }> {
    const outcome = await this.sessions.signIn(token, clientAddress(req));
    if (outcome.kind === 'limited') {
      throw new TooManyRequestsException('too many sign-ins', outcome.retryAfterSeconds);
    }
    if (outcome.kind === 'refused') {
      throw new NotFoundException();
    }
    return outcome.session;
  }

  @Get('session')
  @UseGuards(SignedInGuard)
  session(@Req() { adminSession }: SignedInRequest): { expiresAt: Date } {
    return { expiresAt: adminSession.expiresAt };
  }

  @Delete('session')
  @UseGuards(SignedInGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(@Req() { adminSession }: SignedInRequest): Promise<void> {
    await this.sessions.end(adminSession);
  }

  @Get('report')
  @UseGuards(SignedInGuard)
  report(@Query(new ZodPipe(reportQuery)) { days }: ReportQuery): Promise<Report> {
    return this.reports.build(days);
  }
}
