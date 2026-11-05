import type { Logger } from '@nestjs/common';

export function runEvery(
  ms: number,
  what: string,
  task: () => Promise<void>,
  log: Logger,
): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) {
      return;
    }
    running = true;
    Promise.resolve()
      .then(task)
      .finally(() => {
        running = false;
      })
      .catch((error: unknown) => {
        log.warn(`${what} failed: ${error instanceof Error ? error.message : String(error)}`);
      });
  }, ms);
  timer.unref();
  return () => {
    clearInterval(timer);
  };
}
