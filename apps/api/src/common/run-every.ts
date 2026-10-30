import type { Logger } from '@nestjs/common';

export function runEvery(
  ms: number,
  what: string,
  task: () => Promise<void>,
  log: Logger,
): () => void {
  const timer = setInterval(() => {
    task().catch((error: unknown) => {
      log.warn(`${what} failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, ms);
  timer.unref();
  return () => {
    clearInterval(timer);
  };
}
