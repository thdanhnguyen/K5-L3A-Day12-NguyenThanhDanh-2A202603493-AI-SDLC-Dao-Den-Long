import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTRACT, TUNING } from '../../src/sim/config';
import { Simulation } from '../../src/sim/engine';
import { InputTimeline, transformMoveToWorld, validateAndParseInputs } from '../../src/sim/input';
import { Mulberry32 } from '../../src/sim/prng';
import { validateAndParseScenario } from '../../src/sim/scenario';
import { FormatError } from '../../src/sim/types';

describe('Mulberry32 PRNG', () => {
  it('produces identical sequences for the same seed', () => {
    const a = new Mulberry32(12345);
    const b = new Mulberry32(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces distinct sequences for different seeds', () => {
    const a = new Mulberry32(1);
    const b = new Mulberry32(2);
    expect(a.next()).not.toEqual(b.next());
  });
});

describe('Contract C movement transform & input rising edges', () => {
  it('matches exact Contract C yaw formulas and normalizes diagonals', () => {
    expect(transformMoveToWorld([0, 1], 0)).toEqual([0, 1]);

    const [wx90, wz90] = transformMoveToWorld([0, 1], 90);
    expect(wx90).toBeCloseTo(1, 6);
    expect(wz90).toBeCloseTo(0, 6);

    const [wx180, wz180] = transformMoveToWorld([1, 0], 180);
    expect(wx180).toBeCloseTo(-1, 6);
    expect(wz180).toBeCloseTo(0, 6);

    const [dx, dz] = transformMoveToWorld([1, 1], 0);
    expect(Math.hypot(dx, dz)).toBeCloseTo(1, 6);
    expect(dx).toBeCloseTo(Math.SQRT1_2, 6);
    expect(dz).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it('triggers action buttons strictly on false -> true transitions', () => {
    const frames = validateAndParseInputs(
      JSON.stringify({
        frames: [
          { tick: 0, interact: true },
          { tick: 1, move: [0, 0] },
          { tick: 2, interact: false },
          { tick: 3, interact: true },
        ],
      })
    );
    const tl = new InputTimeline(frames);
    expect(tl.sampleForTick(0).interactPressed).toBe(true);
    expect(tl.sampleForTick(1).interactPressed).toBe(false);
    expect(tl.sampleForTick(2).interactPressed).toBe(false);
    expect(tl.sampleForTick(3).interactPressed).toBe(true);
  });

  it('rejects non-increasing frame ticks with FormatError', () => {
    expect(() =>
      validateAndParseInputs(
        JSON.stringify({
          frames: [
            { tick: 5, move: [0, 1] },
            { tick: 5, move: [0, 0] },
          ],
        })
      )
    ).toThrow(FormatError);

    expect(() =>
      validateAndParseInputs(
        JSON.stringify({
          frames: [
            { tick: 5, move: [0, 1] },
            { tick: 2, move: [0, 0] },
          ],
        })
      )
    ).toThrow(FormatError);
  });

  it('rejects malformed scenario files with FormatError', () => {
    expect(() => validateAndParseScenario('{bad json')).toThrow(FormatError);
    expect(() =>
      validateAndParseScenario(JSON.stringify({ lanterns: [{ id: 'UNKNOWN', lit: true }] }))
    ).toThrow(FormatError);
  });
});

describe('game.contract.json single source of truth', () => {
  it('exposes exact schema and matching tuning constants', () => {
    const raw = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../game.contract.json'), 'utf8')
    );
    expect(raw.contract_version).toBe('1.0');
    expect(raw.tuning).toEqual(TUNING);
    expect(CONTRACT.tuning.lantern_count_night1).toBe(5);
  });
});

describe('Creative isolation guarantee', () => {
  it('keeps headless (creative: false) free of wandering girl, buffs, and variant stats', () => {
    const simHeadless = new Simulation(42, 1, {}, { creative: false });
    expect(simHeadless.wanderingGirl.active).toBe(false);
    expect(simHeadless.motes.every((m) => m.color === 'gold')).toBe(true);
    expect(simHeadless.shades.every((s) => s.variant === 'standard')).toBe(true);
  });

  it('enables wandering girl (+5 light) and creative features only when creative: true', () => {
    const simCreative = new Simulation(
      42,
      1,
      { random_motes: false, random_shades: false },
      { creative: true }
    );
    expect(simCreative.wanderingGirl.active).toBe(true);
    simCreative.player.pos = [
      simCreative.wanderingGirl.pos[0],
      0,
      simCreative.wanderingGirl.pos[2],
    ];
    simCreative.step({
      move: [0, 0],
      camYawDeg: 0,
      jumpPressed: false,
      interactPressed: false,
      pulsePressed: false,
      dashPressed: false,
    });
    expect(simCreative.wanderingGirl.found).toBe(true);
    expect(simCreative.player.carried).toBe(5);
  });
});
