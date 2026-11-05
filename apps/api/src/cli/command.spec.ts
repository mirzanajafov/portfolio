import { describe, expect, it } from 'vitest';
import { parseCommand } from './command.js';

describe('parseCommand', () => {
  it('reads report for the last week unless told how many days', () => {
    expect(parseCommand(['report'])).toEqual({ name: 'report', days: 7, all: false });
    expect(parseCommand(['report', '--days', '30', '--all'])).toEqual({
      name: 'report',
      days: 30,
      all: true,
    });
  });

  it('reads list, export and cv', () => {
    expect(parseCommand(['application', 'list'])).toEqual({ name: 'application list' });
    expect(parseCommand(['application', 'export'])).toEqual({ name: 'application export' });
    expect(parseCommand(['application', 'cv', 'memh'])).toEqual({
      name: 'application cv',
      code: 'memh',
    });
  });

  it('reads admin link and admin revoke', () => {
    expect(parseCommand(['admin', 'link'])).toEqual({ name: 'admin link' });
    expect(parseCommand(['admin', 'revoke'])).toEqual({ name: 'admin revoke' });
  });

  it.each([
    ['for application add, which moved to /admin', ['application', 'add', '--company', 'Acme']],
    ['with arguments export does not take', ['application', 'export', '--all']],
    ['with a code a link could not carry', ['application', 'cv', 'Memh!']],
    ['with two codes', ['application', 'cv', 'memh', 'kxqtz']],
    ['with arguments list does not take', ['application', 'list', '--all']],
    ['with arguments admin link does not take', ['admin', 'link', '--minutes', '60']],
    ['for a command it does not know', ['application', 'remove', 'memh']],
    ['for more days than are kept', ['report', '--days', '31']],
    ['for no days', ['report', '--days', '0']],
    ['for days that are not a number', ['report', '--days', 'week']],
    ['with an argument report does not take', ['report', 'xsolla']],
  ])('refuses arguments %s', (_, args) => {
    expect(() => parseCommand(args)).toThrow();
  });
});
