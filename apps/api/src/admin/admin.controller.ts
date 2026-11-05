import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { adminToken } from '@portfolio/content/admin';
import { hostName, refCode } from '@portfolio/content/analytics';
import {
  channels,
  cvVariantMaxLength,
  notesMaxLength,
  statuses,
} from '@portfolio/content/applications';
import { reportDaysSchema, type Report } from '@portfolio/content/report';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AnalyticsReportService } from '../analytics/report/analytics-report.service.js';
import {
  ApplicationsService,
  CodeTakenError,
  type ApplicationEdit,
  type NewApplication,
} from '../applications/applications.service.js';
import { clientAddress } from '../common/caller.js';
import { ClockService } from '../common/clock.service.js';
import { dayOf, dayOrNull } from '../common/days.js';
import { ZodPipe } from '../common/zod.pipe.js';
import type { Application } from '../generated/prisma/client.js';
import { RateLimiterService } from '../rate-limit/rate-limiter.service.js';
import { AdminSessionsService } from './admin-sessions.service.js';
import { SignedInGuard, type SignedInRequest } from './signed-in.guard.js';

const signInSchema = z.strictObject({ token: z.string().regex(adminToken) });

type SignInRequest = z.infer<typeof signInSchema>;

const reportQuery = z.strictObject({ days: reportDaysSchema });

type ReportQuery = z.infer<typeof reportQuery>;

const codeParam = z.string().regex(refCode);

const writesPer10Min = 60;

const day = z.iso.date().transform((value) => new Date(value));

const text = (max: number) => z.string().trim().min(1).max(max);

const newApplicationBody = z.strictObject({
  company: text(200),
  role: text(200),
  appliedOn: day,
  channel: z.enum(channels),
  cvVariant: text(cvVariantMaxLength),
  code: z.string().regex(refCode).optional(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  city: text(100).optional(),
  atsHost: z.string().toLowerCase().regex(hostName).optional(),
  networks: z.array(text(100)).max(10).default([]),
});

const editBody = z
  .strictObject({
    company: text(200).optional(),
    role: text(200).optional(),
    channel: z.enum(channels).optional(),
    cvVariant: text(cvVariantMaxLength).optional(),
    status: z.enum(statuses).optional(),
    answeredOn: day.optional(),
    notes: z.string().trim().max(notesMaxLength).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'an edit changes at least one field');

function viewOf({
  code,
  company,
  role,
  appliedOn,
  channel,
  cvVariant,
  status,
  answeredOn,
  notes,
  firstSeenOn,
}: Application) {
  return {
    code,
    company,
    role,
    appliedOn: dayOf(appliedOn),
    channel,
    cvVariant,
    status,
    answeredOn: dayOrNull(answeredOn),
    notes,
    firstSeenOn: dayOrNull(firstSeenOn),
  };
}

type ApplicationView = ReturnType<typeof viewOf>;

@Controller('admin')
export class AdminController {
  constructor(
    private readonly sessions: AdminSessionsService,
    private readonly reports: AnalyticsReportService,
    private readonly applications: ApplicationsService,
    private readonly limiter: RateLimiterService,
    private readonly clock: ClockService,
  ) {}

  @Post('sessions')
  async signIn(
    @Body(new ZodPipe(signInSchema)) { token }: SignInRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ token: string; expiresAt: Date }> {
    const outcome = await this.sessions.signIn(token, clientAddress(req));
    if (outcome.kind === 'limited') {
      res.set('Retry-After', String(outcome.retryAfterSeconds));
      throw new HttpException(
        { message: 'too many sign-ins', retryAfterSeconds: outcome.retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS,
      );
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

  @Get('applications/:code')
  @UseGuards(SignedInGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async application(@Param('code', new ZodPipe(codeParam)) code: string): Promise<void> {
    if (!(await this.applications.find(code))) {
      throw new NotFoundException();
    }
  }

  @Post('applications')
  @UseGuards(SignedInGuard)
  async addApplication(
    @Req() { adminSession }: SignedInRequest,
    @Body(new ZodPipe(newApplicationBody)) application: NewApplication,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApplicationView> {
    await this.admitWrite(adminSession.hash, res);
    try {
      return viewOf(await this.applications.add(application));
    } catch (error) {
      if (error instanceof CodeTakenError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  @Patch('applications/:code')
  @UseGuards(SignedInGuard)
  async editApplication(
    @Req() { adminSession }: SignedInRequest,
    @Param('code', new ZodPipe(codeParam)) code: string,
    @Body(new ZodPipe(editBody)) edit: ApplicationEdit,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApplicationView> {
    await this.admitWrite(adminSession.hash, res);
    const outcome = await this.applications.edit(code, edit, this.clock.now());
    if (outcome.kind === 'missing') {
      throw new NotFoundException();
    }
    if (outcome.kind === 'invalid') {
      throw new BadRequestException(outcome.reason);
    }
    if (outcome.kind === 'refused') {
      throw new ConflictException({
        message: `an application that is ${outcome.status} can't become that`,
        allowed: outcome.allowed,
      });
    }
    return viewOf(outcome.application);
  }

  @Post('applications/:code/undo')
  @UseGuards(SignedInGuard)
  @HttpCode(HttpStatus.OK)
  async undoStatus(
    @Req() { adminSession }: SignedInRequest,
    @Param('code', new ZodPipe(codeParam)) code: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApplicationView> {
    await this.admitWrite(adminSession.hash, res);
    const outcome = await this.applications.undo(code, this.clock.now());
    if (outcome.kind === 'missing') {
      throw new NotFoundException();
    }
    if (outcome.kind === 'nothing to undo') {
      throw new ConflictException('there is no status change to undo');
    }
    return viewOf(outcome.application);
  }

  private async admitWrite(session: Uint8Array, res: Response): Promise<void> {
    const verdict = await this.limiter.admit(
      [
        {
          key: `admin:writes:10m:${Buffer.from(session).toString('hex')}`,
          limit: writesPer10Min,
          windowSeconds: 600,
        },
      ],
      [],
    );
    if (!verdict.allowed) {
      res.set('Retry-After', String(verdict.retryAfterSeconds));
      throw new HttpException(
        { message: 'too many changes', retryAfterSeconds: verdict.retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
