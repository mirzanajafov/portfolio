import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { isbot } from 'isbot';
import { isIP } from 'node:net';

export type Caller = { ip: string; userAgent: string | undefined; optedOut: boolean };

export function clientAddress({ ip }: Request): string {
  if (!ip) {
    throw new BadRequestException('the client has no address');
  }
  if (isIP(ip) === 0) {
    throw new BadRequestException('the forwarded client address is not an IP address');
  }
  return ip;
}

export function isPersonAgent(userAgent: string | undefined): userAgent is string {
  return userAgent !== undefined && userAgent !== '' && !isbot(userAgent);
}

export function callerOf(request: Request): Caller {
  return {
    ip: clientAddress(request),
    userAgent: request.get('user-agent'),
    optedOut: request.get('sec-gpc') === '1' || request.get('dnt') === '1',
  };
}
