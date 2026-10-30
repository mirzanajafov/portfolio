import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { adminToken } from '@portfolio/content/admin';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { clientAddress } from '../common/client-address.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { AdminSessionsService } from './admin-sessions.service.js';
import { SignedInGuard, type SignedInRequest } from './signed-in.guard.js';

const signInSchema = z.strictObject({ token: z.string().regex(adminToken) });

type SignInRequest = z.infer<typeof signInSchema>;

@Controller('admin')
export class AdminController {
  constructor(private readonly sessions: AdminSessionsService) {}

  @Post('sessions')
  async signIn(
    @Body(new ZodPipe(signInSchema)) { token }: SignInRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ token: string; expiresAt: Date }> {
    const outcome = await this.sessions.signIn(token, clientAddress(req));
    if (outcome.kind === 'limited') {
      res.set('Retry-After', String(outcome.retryAfterSeconds));
      throw new HttpException(
        { message: 'too many sign-ins', retryAfterSeconds: outcome.retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (outcome.kind === 'refused') {
      throw new NotFoundException();
    }
    return outcome.session;
  }

  @Get('session')
  @UseGuards(SignedInGuard)
  session(@Req() { adminSession }: SignedInRequest): { expiresAt: Date } {
    return { expiresAt: adminSession.expiresAt };
  }

  @Delete('session')
  @UseGuards(SignedInGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(@Req() { adminSession }: SignedInRequest): Promise<void> {
    await this.sessions.end(adminSession);
  }
}
