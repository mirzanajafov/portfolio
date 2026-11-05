import type { Server } from 'node:http';
import { assert } from 'vitest';

export async function listenLocally(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address !== null && typeof address === 'object');
  return `http://127.0.0.1:${String(address.port)}`;
}
