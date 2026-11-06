import { BadRequestException } from '@nestjs/common';
import { adminToken } from '@portfolio/content/admin';
import type { Request } from 'express';
import { isbot } from 'isbot';
import { isIP } from 'node:net';

export type Caller = {
  ip: string;
  userAgent: string | undefined;
  optedOut: boolean;
  sessionToken: string | undefined;
};

const bearer = 'Bearer ';

export function clientAddress({ ip }: Request): string {
  if (!ip) {
    throw new BadRequestException('the client has no address');
  }
  if (isIP(ip) === 0) {
    throw new BadRequestException('the forwarded client address is not an IP address');
  }
  return ip;
}

export function sessionTokenOf(request: Request): string | undefined {
  const header = request.get('authorization') ?? '';
  const token = header.startsWith(bearer) ? header.slice(bearer.length) : '';
  return adminToken.test(token) ? token : undefined;
}

export function visitorAgent({ userAgent, optedOut }: Caller): string | null {
  return optedOut || userAgent === undefined || userAgent === '' || isbot(userAgent)
    ? null
    : userAgent;
}

export function fromSite(origin: string | undefined, siteOrigin: string): boolean {
  return origin === undefined || origin === siteOrigin;
}

export function callerOf(request: Request): Caller {
  return {
    ip: clientAddress(request),
    userAgent: request.get('user-agent'),
    optedOut: request.get('sec-gpc') === '1' || request.get('dnt') === '1',
    sessionToken: sessionTokenOf(request),
  };
}
