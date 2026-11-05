import { Injectable } from '@nestjs/common';
import { isAnswer, nextStatuses, statuses, type Status } from '@portfolio/content/applications';
import { inBaku } from '@portfolio/content/time';
import { ClockService } from '../common/clock.service.js';
import { dayOf, dayOrNull, utcDay } from '../common/days.js';
import {
  ApplicationField,
  Prisma,
  type Application,
  type ApplicationChange,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ApplicationEdit, NewApplication } from './application.schema.js';
import { newCode } from './code.js';

export type EditOutcome =
  | { kind: 'edited'; application: Application }
  | { kind: 'missing' }
  | { kind: 'refused'; from: Status; to: Status; allowed: readonly Status[] }
  | { kind: 'invalid'; reason: string };

export type UndoOutcome =
  { kind: 'undone'; application: Application } | { kind: 'missing' } | { kind: 'nothing to undo' };

type Tracked = Pick<Application, ApplicationField>;

const maxDraws = 5;

function isCodeTaken(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function trackedOf({
  company,
  role,
  channel,
  cvVariant,
  status,
  answeredOn,
  notes,
}: Application): Tracked {
  return { company, role, channel, cvVariant, status, answeredOn, notes };
}

function textOf(value: string | Date | null): string | null {
  return typeof value === 'string' ? value : dayOrNull(value);
}

export class CodeTakenError extends Error {
  constructor(code: string) {
    super(`code ${code} already belongs to another application`);
  }
}

export class FutureApplicationError extends Error {
  constructor(appliedOn: Date) {
    super(`appliedOn ${dayOf(appliedOn)} is after today in Baku`);
  }
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  async add({ code, ...application }: NewApplication): Promise<Application> {
    if (application.appliedOn > utcDay(inBaku(this.clock.now()))) {
      throw new FutureApplicationError(application.appliedOn);
    }
    const tries = code === undefined ? maxDraws : 1;
    for (let attempt = 1; ; attempt += 1) {
      const candidate = code ?? newCode();
      try {
        return await this.prisma.application.create({ data: { ...application, code: candidate } });
      } catch (error) {
        if (!isCodeTaken(error)) {
          throw error;
        }
        if (attempt === tries) {
          throw new CodeTakenError(candidate);
        }
      }
    }
  }

  find(code: string): Promise<Application | null> {
    return this.prisma.application.findUnique({ where: { code } });
  }

  list(): Promise<Application[]> {
    return this.prisma.application.findMany({
      orderBy: [{ appliedOn: 'desc' }, { createdAt: 'desc' }],
    });
  }

  edit(code: string, edit: ApplicationEdit): Promise<EditOutcome> {
    const at = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const current = await lockedApplication(tx, code);
      if (!current) {
        return { kind: 'missing' };
      }
      const status = edit.status ?? current.status;
      const allowed = nextStatuses[current.status];
      if (status !== current.status && !allowed.includes(status)) {
        return { kind: 'refused', from: current.status, to: status, allowed };
      }
      const today = utcDay(inBaku(at));
      const answered = current.answeredOn ?? (isAnswer(current.status, status) ? today : null);
      const { answeredOn } = edit;
      if (answeredOn && (!answered || answeredOn < current.appliedOn || answeredOn > today)) {
        return {
          kind: 'invalid',
          reason: 'answeredOn corrects the day of an answer that came, from appliedOn to today',
        };
      }
      const next: Tracked = { ...trackedOf(current), ...edit, answeredOn: answeredOn ?? answered };
      return { kind: 'edited', application: await record(tx, current, next, at, false) };
    });
  }

  undo(code: string): Promise<UndoOutcome> {
    const at = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const current = await lockedApplication(tx, code);
      if (!current) {
        return { kind: 'missing' };
      }
      const undone = await lastUndoable(tx, current.id);
      const restored = statuses.find((status) => status === undone?.before);
      if (!restored) {
        return { kind: 'nothing to undo' };
      }
      const next: Tracked = {
        ...trackedOf(current),
        status: restored,
        answeredOn: restored === 'sent' ? null : current.answeredOn,
      };
      return { kind: 'undone', application: await record(tx, current, next, at, true) };
    });
  }
}

async function lockedApplication(
  tx: Prisma.TransactionClient,
  code: string,
): Promise<Application | null> {
  await tx.$queryRaw`SELECT id FROM "Application" WHERE code = ${code} FOR UPDATE`;
  return tx.application.findUnique({ where: { code } });
}

async function lastUndoable(
  tx: Prisma.TransactionClient,
  applicationId: string,
): Promise<ApplicationChange | undefined> {
  const changes = await tx.applicationChange.findMany({
    where: { applicationId, field: 'status' },
    orderBy: { id: 'desc' },
  });
  let undoneSince = 0;
  for (const change of changes) {
    if (change.undo) {
      undoneSince += 1;
    } else if (undoneSince > 0) {
      undoneSince -= 1;
    } else {
      return change;
    }
  }
  return undefined;
}

async function record(
  tx: Prisma.TransactionClient,
  current: Application,
  next: Tracked,
  at: Date,
  undo: boolean,
): Promise<Application> {
  const changes = Object.values(ApplicationField).flatMap((field) => {
    const [before, after] = [textOf(current[field]), textOf(next[field])];
    return before === after ? [] : [{ applicationId: current.id, at, field, before, after, undo }];
  });
  if (changes.length === 0) {
    return current;
  }
  await tx.applicationChange.createMany({ data: changes });
  return tx.application.update({ where: { id: current.id }, data: next });
}
