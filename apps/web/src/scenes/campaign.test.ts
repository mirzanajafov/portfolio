import { describe, expect, it } from 'vitest';
import {
  campaignAt,
  campaignData,
  campaignLoop,
  campaignParameters,
  createCampaignScene,
} from './campaign';
import type { SceneHooks } from './types';

const hooks: SceneHooks = {
  label: () => document.createElement('span'),
  place: () => undefined,
  size: () => ({ width: 1200, height: 800 }),
};

const total = (pick: (run: (typeof campaignData.runs)[number]) => number) =>
  campaignData.runs.reduce((sum, run) => sum + pick(run), 0);

describe("the campaign data taken from Car Wash Ledger's chaos results", () => {
  it('adds up to what its README says about the long campaign', () => {
    expect(campaignData.runs).toHaveLength(200);
    expect(total((run) => run.journeys)).toBe(135048);
    expect(total((run) => run.kills)).toBe(8792);
    expect(total((run) => run.postgres + run.kafka)).toBe(876);
    expect(total((run) => run.network)).toBe(2253);
    expect(total((run) => run.forged)).toBe(9108);
    expect(total((run) => run.violations)).toBe(0);
  });

  it('keeps the runs in the order they ran, over one night', () => {
    const minutes = campaignData.runs.map((run) => run.minute);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
    expect(minutes.at(-1)).toBeGreaterThan(4 * 60);
    expect(minutes.at(-1)).toBeLessThan(5 * 60);
  });

  it('catches every mutant except the two meant to survive', () => {
    const survived = campaignData.mutants.filter((mutant) => mutant.caughtIn === null);
    expect(survived.map((mutant) => mutant.id)).toEqual(['M1', 'M7a']);
    for (const mutant of campaignData.mutants.filter((mutant) => mutant.caughtIn !== null)) {
      expect(mutant.caughtBy.length, mutant.id).toBeGreaterThan(0);
    }
    expect(campaignData.mutants.find((mutant) => mutant.id === 'M5')?.caughtBy).toEqual(['S5']);
  });
});

describe('the campaign replay', () => {
  it('adds one run at a time, then the mutants', () => {
    expect(campaignAt(0)).toMatchObject({ runs: 1, mutants: 0 });
    const lastRun = (campaignData.runs.length - 1) / campaignParameters.runsPerSecond;
    expect(campaignAt(lastRun)).toMatchObject({
      runs: 200,
      mutants: 0,
      journeys: 135048,
      kills: 8792,
      violations: 0,
    });
    expect(campaignAt(campaignLoop - 0.01)).toMatchObject({ mutants: 14, caught: 12 });
  });
});

describe('the campaign scene', () => {
  it('opens on the finished night, so a still frame already says it', () => {
    const scene = createCampaignScene(hooks);
    for (let i = 0; i < 40; i += 1) scene.step(0.05, i * 0.05);
    scene.render(2, 0.05);
    const [first, second, third] = scene.readout();
    expect(first).toMatch(
      /^M\d+[a+M\d]*, .+: (caught by .+ in run \d+|survived \d+ runs, as it should)$/,
    );
    expect(second).toBe(
      'the deployed code: 200 runs · 135,048 journeys · 8,792 kills · 0 violations',
    );
    expect(third).toMatch(/^one guard removed: \d+ of \d+ mutants caught$/);
    scene.dispose();
  });

  it('starts the night again after the mutants', () => {
    const scene = createCampaignScene(hooks);
    const seen: string[] = [];
    for (let frame = 0; frame < 60 * 12; frame += 1) {
      scene.step(1 / 60, frame / 60);
      if (frame % 20 === 0) seen.push(scene.readout()[0]!);
    }
    expect(seen.some((line) => line.startsWith('run 1 of 200'))).toBe(true);
    scene.dispose();
  });
});
