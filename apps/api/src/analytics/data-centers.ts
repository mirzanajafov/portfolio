import type { Prisma } from '../generated/prisma/client.js';

const dataCenters: readonly string[] = [
  'Amazon.com, Inc.',
  'Google LLC',
  'Google Asia Pacific Pte. Ltd.',
  'Microsoft Corporation',
];

export function dataCenterOf({ network }: { network: string | null }): string | null {
  return network !== null && dataCenters.includes(network) ? network : null;
}

export function byPeople(): Prisma.VisitWhereInput {
  return { OR: [{ network: null }, { network: { notIn: [...dataCenters] } }] };
}
