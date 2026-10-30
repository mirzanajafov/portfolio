import { describe, expect, it } from 'vitest';
import { parseCommand } from './cli-command.js';

const required = ['--company', 'Acme', '--role', 'Backend Engineer', '--applied', '2026-10-30'];

describe('parseCommand', () => {
  it('turns the flags of application add into an application', () => {
    expect(
      parseCommand([
        'application',
        'add',
        ...required,
        '--code',
        'memh',
        '--country',
        'AZ',
        '--city',
        'Baku',
        '--ats',
        'acme.wd3.myworkdayjobs.com',
        '--network',
        'ACME-NET',
        '--network',
        'ACME-VPN',
      ]),
    ).toEqual({
      name: 'application add',
      application: {
        company: 'Acme',
        role: 'Backend Engineer',
        appliedOn: new Date('2026-10-30'),
        code: 'memh',
        country: 'AZ',
        city: 'Baku',
        atsHost: 'acme.wd3.myworkdayjobs.com',
        networks: ['ACME-NET', 'ACME-VPN'],
      },
    });
  });

  it('leaves the hints out when none are given', () => {
    expect(parseCommand(['application', 'add', ...required])).toEqual({
      name: 'application add',
      application: {
        company: 'Acme',
        role: 'Backend Engineer',
        appliedOn: new Date('2026-10-30'),
        networks: [],
      },
    });
  });

  it('reads list and cv', () => {
    expect(parseCommand(['application', 'list'])).toEqual({ name: 'application list' });
    expect(parseCommand(['application', 'cv', 'memh'])).toEqual({
      name: 'application cv',
      code: 'memh',
    });
  });

  it('names the flag that is wrong', () => {
    expect(() =>
      parseCommand([
        'application',
        'add',
        '--company',
        'Acme',
        '--role',
        'Dev',
        '--applied',
        '30.10.2026',
      ]),
    ).toThrow(/applied/);
  });

  it.each([
    ['without a role', ['application', 'add', '--company', 'Acme', '--applied', '2026-10-30']],
    [
      'with a country that is not two capital letters',
      ['application', 'add', ...required, '--country', 'az'],
    ],
    ['with a flag it does not know', ['application', 'add', ...required, '--salary', '1']],
    ['with a code a link could not carry', ['application', 'cv', 'Memh!']],
    ['with two codes', ['application', 'cv', 'memh', 'kxqtz']],
    ['with arguments list does not take', ['application', 'list', '--all']],
    ['for a command it does not know', ['application', 'remove', 'memh']],
  ])('refuses arguments %s', (_, args) => {
    expect(() => parseCommand(args)).toThrow();
  });
});
