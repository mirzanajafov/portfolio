import {
  Injectable,
  NotFoundException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { adminToken } from '@portfolio/content/admin';
import type { Request } from 'express';
import type { AdminSession } from '../generated/prisma/client.js';
import { AdminSessionsService } from './admin-sessions.service.js';

export type SignedInRequest = Request & { adminSession: AdminSession };

const bearer = 'Bearer ';

@Injectable()
export class SignedInGuard implements CanActivate {
  constructor(private readonly sessions: AdminSessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { adminSession?: AdminSession }>();
    const header = request.get('authorization') ?? '';
    const token = header.startsWith(bearer) ? header.slice(bearer.length) : '';
    const session = adminToken.test(token) ? await this.sessions.find(token) : null;
    if (!session) {
      throw new NotFoundException();
    }
    request.adminSession = session;
    return true;
  }
}
