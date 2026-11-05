import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  applicationEditSchema,
  codeSchema,
  newApplicationSchema,
  type ApplicationEdit,
  type NewApplication,
} from '../applications/application.schema.js';
import { ApplicationsService } from '../applications/applications.service.js';
import { dayOf, dayOrNull } from '../common/days.js';
import { ZodPipe } from '../common/zod.pipe.js';
import type { AdminSession, Application } from '../generated/prisma/client.js';
import { AdminSessionsService } from './admin-sessions.service.js';
import { SignedInGuard, type SignedInRequest } from './signed-in.guard.js';

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

@Controller('admin/applications')
@UseGuards(SignedInGuard)
export class AdminApplicationsController {
  constructor(
    private readonly sessions: AdminSessionsService,
    private readonly applications: ApplicationsService,
  ) {}

  @Get(':code')
  @HttpCode(HttpStatus.NO_CONTENT)
  async find(@Param('code', new ZodPipe(codeSchema)) code: string): Promise<void> {
    if (!(await this.applications.find(code))) {
      throw new NotFoundException();
    }
  }

  @Post()
  async add(
    @Req() { adminSession }: SignedInRequest,
    @Body(new ZodPipe(newApplicationSchema)) application: NewApplication,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApplicationView> {
    await this.admitWrite(adminSession, res);
    const outcome = await this.applications.add(application);
    if (outcome.kind === 'code taken') {
      throw new ConflictException(outcome.reason);
    }
    if (outcome.kind === 'invalid') {
      throw new BadRequestException(outcome.reason);
    }
    return viewOf(outcome.application);
  }

  @Patch(':code')
  async edit(
    @Req() { adminSession }: SignedInRequest,
    @Param('code', new ZodPipe(codeSchema)) code: string,
    @Body(new ZodPipe(applicationEditSchema)) edit: ApplicationEdit,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApplicationView> {
    await this.admitWrite(adminSession, res);
    const outcome = await this.applications.edit(code, edit);
    if (outcome.kind === 'missing') {
      throw new NotFoundException();
    }
    if (outcome.kind === 'invalid') {
      throw new BadRequestException(outcome.reason);
    }
    if (outcome.kind === 'refused') {
      throw new ConflictException({
        message: `an application that is ${outcome.from} can't become ${outcome.to}`,
        allowed: outcome.allowed,
      });
    }
    return viewOf(outcome.application);
  }

  @Post(':code/undo')
  @HttpCode(HttpStatus.OK)
  async undo(
    @Req() { adminSession }: SignedInRequest,
    @Param('code', new ZodPipe(codeSchema)) code: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApplicationView> {
    await this.admitWrite(adminSession, res);
    const outcome = await this.applications.undo(code);
    if (outcome.kind === 'missing') {
      throw new NotFoundException();
    }
    if (outcome.kind === 'nothing to undo') {
      throw new ConflictException('there is no status change to undo');
    }
    return viewOf(outcome.application);
  }

  private async admitWrite(session: AdminSession, res: Response): Promise<void> {
    const verdict = await this.sessions.admitWrite(session);
    if (!verdict.allowed) {
      res.set('Retry-After', String(verdict.retryAfterSeconds));
      throw new HttpException(
        { message: 'too many changes', retryAfterSeconds: verdict.retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
