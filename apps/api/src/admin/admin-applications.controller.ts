import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  PreconditionFailedException,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ApplicationPage, ApplicationView } from '@portfolio/content/applications';
import {
  applicationEditSchema,
  codeSchema,
  newApplicationSchema,
  undoSchema,
  type ApplicationEdit,
  type NewApplication,
  type Undo,
} from '../applications/application.schema.js';
import { ApplicationsService } from '../applications/applications.service.js';
import { dayOf, dayOrNull } from '../common/days.js';
import { TooManyRequestsException } from '../common/too-many-requests.exception.js';
import { ZodPipe } from '../common/zod.pipe.js';
import type { AdminSession, Application } from '../generated/prisma/client.js';
import { AdminSessionsService } from './admin-sessions.service.js';
import { SignedInGuard, type SignedInRequest } from './signed-in.guard.js';

const changedSinceLoaded = 'the application changed since that page loaded';

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
  country,
  city,
  atsHost,
  networks,
  version,
}: Application): ApplicationView {
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
    country,
    city,
    atsHost,
    networks,
    version,
  };
}

@Controller('admin/applications')
@UseGuards(SignedInGuard)
export class AdminApplicationsController {
  constructor(
    private readonly sessions: AdminSessionsService,
    private readonly applications: ApplicationsService,
  ) {}

  @Get()
  async list(): Promise<ApplicationView[]> {
    return (await this.applications.list()).map(viewOf);
  }

  @Get(':code')
  async find(@Param('code', new ZodPipe(codeSchema)) code: string): Promise<ApplicationPage> {
    const found = await this.applications.findWithUndo(code);
    if (!found) {
      throw new NotFoundException();
    }
    return { ...viewOf(found.application), undoTo: found.undoTo };
  }

  @Post()
  async add(
    @Req() { adminSession }: SignedInRequest,
    @Body(new ZodPipe(newApplicationSchema)) application: NewApplication,
  ): Promise<ApplicationView> {
    await this.admitWrite(adminSession);
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
  ): Promise<ApplicationView> {
    await this.admitWrite(adminSession);
    const outcome = await this.applications.edit(code, edit);
    if (outcome.kind === 'missing') {
      throw new NotFoundException();
    }
    if (outcome.kind === 'invalid') {
      throw new BadRequestException(outcome.reason);
    }
    if (outcome.kind === 'out of date') {
      throw new PreconditionFailedException(changedSinceLoaded);
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
    @Body(new ZodPipe(undoSchema)) expected: Undo,
  ): Promise<ApplicationView> {
    await this.admitWrite(adminSession);
    const outcome = await this.applications.undo(code, expected);
    if (outcome.kind === 'missing') {
      throw new NotFoundException();
    }
    if (outcome.kind === 'out of date') {
      throw new PreconditionFailedException(changedSinceLoaded);
    }
    if (outcome.kind === 'nothing to undo') {
      throw new ConflictException('there is no status change to undo');
    }
    return viewOf(outcome.application);
  }

  private async admitWrite(session: AdminSession): Promise<void> {
    const verdict = await this.sessions.admitWrite(session);
    if (verdict.kind === 'limited') {
      throw new TooManyRequestsException('too many changes', verdict.retryAfterSeconds);
    }
  }
}
