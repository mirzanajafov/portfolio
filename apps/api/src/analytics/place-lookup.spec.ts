import { Logger } from '@nestjs/common';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { openPlaceLookup, placeOf } from './place-lookup.js';

const baku = {
  country: { geoname_id: 587116, iso_code: 'AZ', names: { en: 'Azerbaijan' } },
  city: { geoname_id: 587084, names: { en: 'Baku' } },
};

const nowhere = { country: null, city: null, network: null };

function quietLog() {
  const log = new Logger('test');
  return { log, warn: vi.spyOn(log, 'warn').mockImplementation(() => undefined) };
}

describe('placeOf', () => {
  it('takes the country code, the English city name and the network organisation', () => {
    const network = { autonomous_system_number: 64500, autonomous_system_organization: 'Acme' };
    expect(placeOf(baku, network)).toEqual({ country: 'AZ', city: 'Baku', network: 'Acme' });
  });

  it('leaves out whatever a database does not know about the address', () => {
    expect(placeOf(baku, null)).toEqual({ country: 'AZ', city: 'Baku', network: null });
    expect(placeOf({ country: baku.country }, null)).toEqual({
      country: 'AZ',
      city: null,
      network: null,
    });
    expect(placeOf(null, null)).toEqual(nowhere);
  });
});

describe('openPlaceLookup', () => {
  it('records no place, and says so, when no directory is set', async () => {
    const { log, warn } = quietLog();
    const lookup = await openPlaceLookup(undefined, log);
    expect(lookup.placeOf('203.0.113.7')).toEqual(nowhere);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('GEO_DIR is not set'));
  });

  it('records no place, and says why, when the files are not there', async () => {
    const { log, warn } = quietLog();
    const dir = await mkdtemp(join(tmpdir(), 'geo-'));
    const lookup = await openPlaceLookup(dir, log);
    expect(lookup.placeOf('203.0.113.7')).toEqual(nowhere);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not be read'));
  });
});
