import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  private readonly log = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.log.warn(
        `the database did not answer: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException('the database is not answering');
    }
    return { status: 'ok' };
  }
}
