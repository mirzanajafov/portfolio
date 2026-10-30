import { isbot } from 'isbot';
import { describe, expect, it } from 'vitest';
import { browserOf, deviceOf, type Browser, type Device } from './user-agent.js';

type Person = { name: string; userAgent: string; device: Device; browser: Browser };

const people: Person[] = [
  {
    name: 'Chrome on Windows',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    device: 'desktop',
    browser: 'chrome',
  },
  {
    name: 'Safari on an iPhone',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    device: 'phone',
    browser: 'safari',
  },
  {
    name: 'Firefox on a Mac',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:132.0) Gecko/20100101 Firefox/132.0',
    device: 'desktop',
    browser: 'firefox',
  },
  {
    name: 'Edge on Windows',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.68',
    device: 'desktop',
    browser: 'edge',
  },
  {
    name: 'Samsung Internet',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
    device: 'phone',
    browser: 'samsung',
  },
  {
    name: "LinkedIn's in-app browser on an iPhone",
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30.2415',
    device: 'phone',
    browser: 'linkedin',
  },
  {
    name: "LinkedIn's in-app browser on Android",
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.58 Mobile Safari/537.36 [LinkedInApp]/4.1.1010',
    device: 'phone',
    browser: 'linkedin',
  },
  {
    name: "Telegram's in-app browser on Android",
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-A536B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.58 Mobile Safari/537.36 Telegram-Android/11.2.2 (Samsung SM-A536B; Android 13; SDK 33; HIGH)',
    device: 'phone',
    browser: 'chrome',
  },
  {
    name: 'a Cubot phone, whose name ends in "bot"',
    userAgent:
      'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    device: 'phone',
    browser: 'chrome',
  },
  {
    name: 'Chrome on an Android tablet',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    device: 'tablet',
    browser: 'chrome',
  },
];

const bots = [
  {
    name: 'Googlebot for smartphones',
    userAgent:
      'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.58 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  },
  {
    name: 'bingbot',
    userAgent: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  },
  {
    name: 'headless Chrome',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36',
  },
  {
    name: 'Lighthouse',
    userAgent:
      'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',
  },
  {
    name: 'GPTBot',
    userAgent:
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  },
  {
    name: "LinkedIn's link preview",
    userAgent:
      'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  },
  { name: "Telegram's link preview", userAgent: 'TelegramBot (like TwitterBot)' },
  { name: 'curl', userAgent: 'curl/8.10.1' },
];

describe('user agents', () => {
  it.each(people)('counts $name as a person on a $device using $browser', (person) => {
    expect(isbot(person.userAgent)).toBe(false);
    expect(deviceOf(person.userAgent)).toBe(person.device);
    expect(browserOf(person.userAgent)).toBe(person.browser);
  });

  it.each(bots)('drops $name as a bot', ({ userAgent }) => {
    expect(isbot(userAgent)).toBe(true);
  });
});
