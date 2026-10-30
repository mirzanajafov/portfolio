import { Injectable } from '@nestjs/common';
import { Prisma, type Application } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { newCode } from './code.js';

export type NewApplication = {
  company: string;
  role: string;
  appliedOn: Date;
  code?: string;
  country?: string;
  city?: string;
  atsHost?: string;
  networks: string[];
};

const attempts = 5;

function takenCode(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
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
    if (code) {
      try {
        return await this.prisma.application.create({ data: { ...application, code } });
      } catch (error) {
        if (takenCode(error)) {
          throw new CodeTakenError(code);
        }
        throw error;
      }
    }
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.prisma.application.create({ data: { ...application, code: newCode() } });
      } catch (error) {
        if (!takenCode(error) || attempt === attempts) {
          throw error;
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
}
