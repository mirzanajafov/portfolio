import type { Logger } from '@nestjs/common';
import { Reader, type AsnResponse, type CityResponse } from 'mmdb-lib';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Place = Readonly<{
  country: string | null;
  city: string | null;
  network: string | null;
}>;

export type PlaceLookup = { placeOf(ip: string): Place };

export const PLACE_LOOKUP = Symbol('PLACE_LOOKUP');

export const nowhere: Place = { country: null, city: null, network: null };

export function placeFrom(city: CityResponse | null, asn: AsnResponse | null): Place {
  return {
    country: city?.country?.iso_code ?? null,
    city: city?.city?.names.en ?? null,
    network: asn?.autonomous_system_organization ?? null,
  };
}

export async function openPlaceLookup(dir: string | undefined, log: Logger): Promise<PlaceLookup> {
  if (!dir) {
    log.warn('GEO_DIR is not set, so visits are recorded without country, city and network');
    return { placeOf: () => nowhere };
  }
  try {
    const [cities, networks] = await Promise.all([
      readFile(join(dir, 'dbip-city-lite.mmdb')).then((file) => new Reader<CityResponse>(file)),
      readFile(join(dir, 'dbip-asn-lite.mmdb')).then((file) => new Reader<AsnResponse>(file)),
    ]);
    return { placeOf: (ip) => placeFrom(cities.get(ip), networks.get(ip)) };
  } catch (error) {
    log.warn(
      `the IP databases in ${dir} could not be read (${error instanceof Error ? error.message : String(error)}), so visits are recorded without country, city and network`,
    );
    return { placeOf: () => nowhere };
  }
}
