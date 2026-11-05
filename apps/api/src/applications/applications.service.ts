import { Injectable } from '@nestjs/common';
import {
  isAnswer,
  nextStatuses,
  statuses,
  type Channel,
  type Status,
} from '@portfolio/content/applications';
import { inBaku } from '@portfolio/content/time';
import { dayOrNull, utcDay } from '../common/days.js';
import {
  ApplicationField,
  Prisma,
  type Application,
  type ApplicationChange,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { newCode } from './code.js';

export type NewApplication = {
  company: string;
  role: string;
  appliedOn: Date;
  channel: Channel;
  cvVariant: string;
  code?: string;
  country?: string;
  city?: string;
  atsHost?: string;
  networks: string[];
};

export type ApplicationEdit = Partial<{
  company: string;
  role: string;
  channel: Channel;
  cvVariant: string;
  status: Status;
  answeredOn: Date;
  notes: string;
}>;

export type EditOutcome =
  | { kind: 'edited'; application: Application }
  | { kind: 'missing' }
  | { kind: 'refused'; status: Status; allowed: readonly Status[] }
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

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async add({ code, ...application }: NewApplication): Promise<Application> {
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

  inOrderApplied(): Promise<Application[]> {
    return this.prisma.application.findMany({
      orderBy: [{ appliedOn: 'asc' }, { createdAt: 'asc' }],
    });
  }

  edit(code: string, edit: ApplicationEdit, at: Date): Promise<EditOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const current = await lockedApplication(tx, code);
      if (!current) {
        return { kind: 'missing' };
      }
      const status = edit.status ?? current.status;
      if (status !== current.status && !nextStatuses(current.status).includes(status)) {
        return { kind: 'refused', status: current.status, allowed: nextStatuses(current.status) };
      }
      const firstAnswer = isAnswer(current.status, status) ? utcDay(inBaku(at)) : null;
      const next: Tracked = {
        ...trackedOf(current),
        ...edit,
        answeredOn: edit.answeredOn ?? current.answeredOn ?? firstAnswer,
      };
      if (next.answeredOn && (next.status === 'sent' || next.answeredOn < current.appliedOn)) {
        return {
          kind: 'invalid',
          reason: 'answeredOn needs a status past sent and a day no earlier than appliedOn',
        };
      }
      return { kind: 'edited', application: await record(tx, current, next, at, false) };
    });
  }

  undo(code: string, at: Date): Promise<UndoOutcome> {
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
