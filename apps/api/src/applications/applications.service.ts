import { Injectable } from '@nestjs/common';
import {
  isAnswer,
  nextStatuses,
  statuses,
  type Channel,
  type Status,
} from '@portfolio/content/applications';
import { inBaku } from '@portfolio/content/time';
import { dayOf, utcDay } from '../common/days.js';
import { Prisma, type Application, type ApplicationField } from '../generated/prisma/client.js';
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
  | { kind: 'refused'; status: Status; allowed: readonly Status[] };

export type UndoOutcome =
  { kind: 'undone'; application: Application } | { kind: 'missing' } | { kind: 'nothing to undo' };

type Tracked = Pick<
  Application,
  'company' | 'role' | 'channel' | 'cvVariant' | 'status' | 'answeredOn' | 'notes'
>;

type Change = { field: ApplicationField; before: string | null; after: string | null };

const maxDraws = 5;

const trackedFields: ApplicationField[] = [
  'company',
  'role',
  'channel',
  'cvVariant',
  'status',
  'answeredOn',
  'notes',
];

function isCodeTaken(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function textOf(value: string | Date | null): string | null {
  return value instanceof Date ? dayOf(value) : value;
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

function dayFrom(text: string | null): Date | null {
  return text === null ? null : new Date(text);
}

function changesBetween(before: Tracked, after: Tracked): Change[] {
  return trackedFields.flatMap((field) => {
    const [was, is] = [textOf(before[field]), textOf(after[field])];
    return was === is ? [] : [{ field, before: was, after: is }];
  });
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
      const firstAnswer =
        current.answeredOn === null && isAnswer(current.status, status) ? utcDay(inBaku(at)) : null;
      const next: Tracked = {
        company: edit.company ?? current.company,
        role: edit.role ?? current.role,
        channel: edit.channel ?? current.channel,
        cvVariant: edit.cvVariant ?? current.cvVariant,
        status,
        answeredOn: edit.answeredOn ?? firstAnswer ?? current.answeredOn,
        notes: edit.notes ?? current.notes,
      };
      return { kind: 'edited', application: await record(tx, current, next, at) };
    });
  }

  undo(code: string, at: Date): Promise<UndoOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const current = await lockedApplication(tx, code);
      if (!current) {
        return { kind: 'missing' };
      }
      const last = await tx.applicationChange.findFirst({
        where: { applicationId: current.id, field: 'status' },
        orderBy: { at: 'desc' },
      });
      const restored = statuses.find((status) => status === last?.before);
      if (!last || !restored) {
        return { kind: 'nothing to undo' };
      }
      const answered = await tx.applicationChange.findFirst({
        where: { applicationId: current.id, field: 'answeredOn', at: last.at },
      });
      const next: Tracked = {
        ...trackedOf(current),
        status: restored,
        answeredOn: answered ? dayFrom(answered.before) : current.answeredOn,
      };
      return { kind: 'undone', application: await record(tx, current, next, at) };
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

async function record(
  tx: Prisma.TransactionClient,
  current: Application,
  next: Tracked,
  at: Date,
): Promise<Application> {
  const changes = changesBetween(current, next);
  if (changes.length === 0) {
    return current;
  }
  await tx.applicationChange.createMany({
    data: changes.map((change) => ({ applicationId: current.id, at, ...change })),
  });
  return tx.application.update({ where: { id: current.id }, data: next });
}
