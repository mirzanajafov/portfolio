import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ENV, type Env } from '../config/env.js';
import { fromSite } from './caller.js';

@Injectable()
export class SiteOriginGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    return fromSite(request.get('origin'), this.env.SITE_ORIGIN);
  }
}
