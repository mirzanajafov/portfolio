export const dataCenters = [
  'Amazon.com, Inc.',
  'Google LLC',
  'Google Asia Pacific Pte. Ltd.',
  'Microsoft Corporation',
];

export function dataCenterOf({ network }: { network: string | null }): string | null {
  return network !== null && dataCenters.includes(network) ? network : null;
}
