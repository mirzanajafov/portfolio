import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { isIP } from 'node:net';

export function clientAddress({ ip }: Request): string {
  if (!ip) {
    throw new BadRequestException('the client has no address');
  }
  if (isIP(ip) === 0) {
    throw new BadRequestException('the forwarded client address is not an IP address');
  }
  return ip;
}
