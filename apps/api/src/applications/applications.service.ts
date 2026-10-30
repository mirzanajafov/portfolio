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

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async add({ code, ...application }: NewApplication): Promise<Application> {
    if (code) {
      return this.prisma.application.create({ data: { ...application, code } });
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

  list(): Promise<Application[]> {
    return this.prisma.application.findMany({
      orderBy: [{ appliedOn: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
