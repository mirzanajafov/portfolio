import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

export function parseOrRefuse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException(z.prettifyError(result.error));
  }
  return result.data;
}

export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    return parseOrRefuse(this.schema, value);
  }
}
