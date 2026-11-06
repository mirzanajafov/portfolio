import {
  Injectable,
  NotFoundException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminSessionsService } from '../admin-sessions/admin-sessions.service.js';
import { sessionTokenOf } from '../common/caller.js';
import type { AdminSession } from '../generated/prisma/client.js';

export type SignedInRequest = Request & { adminSession: AdminSession };

@Injectable()
export class SignedInGuard implements CanActivate {
  constructor(private readonly sessions: AdminSessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { adminSession?: AdminSession }>();
    const session = await this.sessions.find(sessionTokenOf(request));
    if (!session) {
      throw new NotFoundException();
    }
    request.adminSession = session;
    return true;
  }
}
