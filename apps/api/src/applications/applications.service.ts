import { Injectable } from '@nestjs/common';
import { isAnswer, nextStatuses, statuses, type Status } from '@portfolio/content/applications';
import { ClockService } from '../common/clock.service.js';
import { bakuDay, dayOf, dayOrNull } from '../common/days.js';
import { ApplicationField, Prisma, type Application } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ApplicationEdit, NewApplication, Undo } from './application.schema.js';
import { newCode } from './code.js';

type AddOutcome =
  | { kind: 'added'; application: Application }
  | { kind: 'code taken'; reason: string }
  | { kind: 'invalid'; reason: string };

type EditOutcome =
  | { kind: 'edited'; application: Application }
  | { kind: 'missing' }
  | { kind: 'out of date' }
  | { kind: 'refused'; from: Status; to: Status; allowed: readonly Status[] }
  | { kind: 'invalid'; reason: string };

type UndoOutcome =
  | { kind: 'undone'; application: Application }
  | { kind: 'missing' }
  | { kind: 'out of date' }
  | { kind: 'nothing to undo' };

type Tracked = Pick<Application, ApplicationField>;

const maxDraws = 5;

function isCodeTaken(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function trackedOf({
  company,
  role,
  appliedOn,
  channel,
  cvVariant,
  status,
  answeredOn,
  notes,
  country,
  city,
  atsHost,
  networks,
}: Application): Tracked {
  return {
    company,
    role,
    appliedOn,
    channel,
    cvVariant,
    status,
    answeredOn,
    notes,
    country,
    city,
    atsHost,
    networks,
  };
}

function textOf(value: string | string[] | Date | null): string | null {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return typeof value === 'string' ? value : dayOrNull(value);
}

function appliedDayRefusal(
  day: Date | undefined,
  answeredOn: Date | null,
  firstSeenOn: Date | null,
  today: Date,
): string | undefined {
  if (!day) {
    return undefined;
  }
  if (day > today) {
    return `appliedOn ${dayOf(day)} is after today in Baku`;
  }
  if (answeredOn && day > answeredOn) {
    return `appliedOn ${dayOf(day)} is after answeredOn ${dayOf(answeredOn)}`;
  }
  if (firstSeenOn && day > firstSeenOn) {
    return `appliedOn ${dayOf(day)} is after the first visit on ${dayOf(firstSeenOn)}`;
  }
  return undefined;
}

function answerDayRefusal(
  day: Date | undefined,
  answered: Date | null,
  appliedOn: Date,
  today: Date,
): string | undefined {
  if (!day) {
    return undefined;
  }
  if (!answered) {
    return `answeredOn ${dayOf(day)} needs an answer, and none came`;
  }
  if (day < appliedOn) {
    return `answeredOn ${dayOf(day)} is before appliedOn ${dayOf(appliedOn)}`;
  }
  if (day > today) {
    return `answeredOn ${dayOf(day)} is after today in Baku`;
  }
  return undefined;
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  async add({ code, ...application }: NewApplication): Promise<AddOutcome> {
    const refusal = appliedDayRefusal(application.appliedOn, null, null, bakuDay(this.clock.now()));
    if (refusal) {
      return { kind: 'invalid', reason: refusal };
    }
    const tries = code === undefined ? maxDraws : 1;
    for (let attempt = 1; ; attempt += 1) {
      const candidate = code ?? newCode();
      try {
        const data = { ...application, code: candidate };
        return { kind: 'added', application: await this.prisma.application.create({ data }) };
      } catch (error) {
        if (!isCodeTaken(error)) {
          throw error;
        }
        if (attempt === tries) {
          return {
            kind: 'code taken',
            reason: `code ${candidate} already belongs to another application`,
          };
        }
      }
    }
  }

  find(code: string): Promise<Application | null> {
    return this.prisma.application.findUnique({ where: { code } });
  }

  findWithUndo(code: string): Promise<{ application: Application; undoTo: Status | null } | null> {
    return this.prisma.$transaction(
      async (tx) => {
        const application = await tx.application.findUnique({ where: { code } });
        return application
          ? { application, undoTo: await statusBeforeLastMove(tx, application.id) }
          : null;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  list(): Promise<Application[]> {
    return this.prisma.application.findMany({
      orderBy: [{ appliedOn: 'desc' }, { createdAt: 'desc' }],
    });
  }

  edit(code: string, { version, ...edit }: ApplicationEdit): Promise<EditOutcome> {
    const at = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const current = await lockedApplication(tx, code);
      if (!current) {
        return { kind: 'missing' };
      }
      if (version !== undefined && version !== current.version) {
        return { kind: 'out of date' };
      }
      const status = edit.status ?? current.status;
      const allowed = nextStatuses[current.status];
      if (status !== current.status && !allowed.includes(status)) {
        return { kind: 'refused', from: current.status, to: status, allowed };
      }
      const today = bakuDay(at);
      const answered = current.answeredOn ?? (isAnswer(current.status, status) ? today : null);
      const next: Tracked = {
        ...trackedOf(current),
        ...edit,
        answeredOn: edit.answeredOn ?? answered,
      };
      const refusal =
        appliedDayRefusal(edit.appliedOn, next.answeredOn, current.firstSeenOn, today) ??
        answerDayRefusal(edit.answeredOn, answered, next.appliedOn, today);
      if (refusal) {
        return { kind: 'invalid', reason: refusal };
      }
      return { kind: 'edited', application: await record(tx, current, next, at, false) };
    });
  }

  undo(code: string, { version }: Undo): Promise<UndoOutcome> {
    const at = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const current = await lockedApplication(tx, code);
      if (!current) {
        return { kind: 'missing' };
      }
      if (version !== undefined && version !== current.version) {
        return { kind: 'out of date' };
      }
      const restored = await statusBeforeLastMove(tx, current.id);
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
  await tx.$executeRaw`SELECT 1 FROM "Application" WHERE code = ${code} FOR UPDATE`;
  return tx.application.findUnique({ where: { code } });
}

async function statusBeforeLastMove(
  tx: Prisma.TransactionClient,
  applicationId: string,
): Promise<Status | null> {
  const changes = await tx.applicationChange.findMany({
    where: { applicationId, field: 'status' },
    orderBy: { id: 'desc' },
    select: { before: true, undo: true },
  });
  let undoneSince = 0;
  for (const { before, undo } of changes) {
    if (undo) {
      undoneSince += 1;
    } else if (undoneSince > 0) {
      undoneSince -= 1;
    } else {
      return statuses.find((status) => status === before) ?? null;
    }
  }
  return null;
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
  return tx.application.update({
    where: { id: current.id },
    data: { ...next, version: { increment: 1 } },
  });
}
