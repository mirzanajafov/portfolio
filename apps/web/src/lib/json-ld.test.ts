import { describe, expect, it } from 'vitest';
import { personJsonLd, serializeJsonLd } from './json-ld';

const profile = {
  name: 'Mirza Najafov',
  alternateNames: ['Mirza Nacafov'],
  headline: 'Senior Backend Engineer',
  location: 'Baku, Azerbaijan',
  timezone: 'UTC+4',
  availability: 'Open to remote roles and relocation',
  summary: 'I build backends.',
  links: {
    email: 'mirza@najafov.dev',
    github: 'https://github.com/mirzanajafov',
    linkedin: 'https://www.linkedin.com/in/mirza-nacafov',
  },
};

describe('personJsonLd', () => {
  it('lets a search for either spelling of the name find the person', () => {
    const person = personJsonLd(profile, 'https://najafov.dev');
    expect(person.name).toBe('Mirza Najafov');
    expect(person.alternateName).toEqual(['Mirza Nacafov']);
    expect(person.sameAs).toContain('https://github.com/mirzanajafov');
  });
});

describe('serializeJsonLd', () => {
  it('cannot close the script tag it is embedded in', () => {
    const text = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(text).not.toContain('</script>');
    expect(JSON.parse(text)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});
