import { describe, expect, it } from 'vitest';
import { Reading } from './reading';

function aReading() {
  const clock = { ms: 0 };
  const reading = new Reading(() => clock.ms);
  const wait = (seconds: number) => {
    clock.ms += seconds * 1000;
  };
  return { reading, wait };
}

describe('Reading', () => {
  it('counts no time, and reaches no block, until the visitor touches the page', () => {
    const { reading, wait } = aReading();
    reading.enter('problem');
    wait(20);
    expect(reading.snapshot()).toEqual({ activeSeconds: 0, maxScroll: 0, blocks: {} });
  });

  it('counts time after an input and stops 30 s after the last one', () => {
    const { reading, wait } = aReading();
    reading.input();
    wait(10);
    reading.input();
    wait(100);
    expect(reading.snapshot().activeSeconds).toBe(40);
  });

  it('stops counting while the tab is hidden and picks up again when it is back', () => {
    const { reading, wait } = aReading();
    reading.input();
    wait(5);
    reading.setVisible(false);
    wait(60);
    reading.setVisible(true);
    reading.input();
    wait(5);
    expect(reading.snapshot().activeSeconds).toBe(10);
  });

  it('gives a block only the active time it spent in the middle of the screen', () => {
    const { reading, wait } = aReading();
    reading.input();
    reading.enter('problem');
    wait(4);
    reading.leave('problem');
    reading.enter('decision-1');
    wait(3);
    reading.leave('decision-1');
    wait(10);
    expect(reading.snapshot()).toEqual({
      activeSeconds: 17,
      maxScroll: 0,
      blocks: { problem: 4, 'decision-1': 3 },
    });
  });

  it('reads nothing from a fling through the page', () => {
    const { reading, wait } = aReading();
    reading.input();
    for (const block of ['problem', 'demo', 'decision-1', 'decision-2', 'proof', 'next']) {
      reading.enter(block);
      wait(0.1);
      reading.leave(block);
    }
    expect(Object.values(reading.snapshot().blocks)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(reading.newlyRead()).toBe(false);
  });

  it('says once that a block has been read for 2 s', () => {
    const { reading, wait } = aReading();
    reading.input();
    reading.enter('proof');
    wait(1);
    expect(reading.newlyRead()).toBe(false);
    wait(1.5);
    expect(reading.newlyRead()).toBe(true);
    wait(5);
    expect(reading.newlyRead()).toBe(false);
  });

  it('keeps the deepest scroll as a whole percentage, at most 100', () => {
    const { reading } = aReading();
    reading.scrolled(42.6);
    reading.scrolled(20);
    expect(reading.snapshot().maxScroll).toBe(43);
    reading.scrolled(100.4);
    expect(reading.snapshot().maxScroll).toBe(100);
  });
});
