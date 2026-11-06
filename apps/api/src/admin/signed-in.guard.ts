import {
  Injectable,
  NotFoundException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { sessionTokenOf } from '../common/caller.js';
import type { AdminSession } from '../generated/prisma/client.js';
import { AdminSessionsService } from './admin-sessions.service.js';

export type SignedInRequest = Request & { adminSession: AdminSession };

@Injectable()
export class SignedInGuard implements CanActivate {
  constructor(private readonly sessions: AdminSessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { adminSession?: AdminSession }>();
    const token = sessionTokenOf(request);
    const session = token === undefined ? null : await this.sessions.find(token);
    if (!session) {
      throw new NotFoundException();
    }
    request.adminSession = session;
    return true;
  }
}
