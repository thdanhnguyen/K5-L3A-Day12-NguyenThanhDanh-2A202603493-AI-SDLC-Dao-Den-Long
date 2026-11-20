import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTRACT, TUNING } from '../../src/sim/config';
import { Simulation } from '../../src/sim/engine';
import { InputTimeline, transformMoveToWorld, validateAndParseInputs } from '../../src/sim/input';
import { getNightMap, getReachableGroundY, resolveHorizontalObstacles } from '../../src/sim/maps';
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

describe('Contract v1.1 movement transform & input rising edges', () => {
  it('matches exact yaw formulas and normalizes diagonals', () => {
    expect(transformMoveToWorld([0, 1], 0)).toEqual([0, 1]);

    const [wx90, wz90] = transformMoveToWorld([0, 1], 90);
    expect(wx90).toBeCloseTo(1, 6);
    expect(wz90).toBeCloseTo(0, 6);

    const [wx180, wz180] = transformMoveToWorld([1, 0], 180);
    expect(wx180).toBeCloseTo(-1, 6);
    expect(wz180).toBeCloseTo(0, 6);

    const [dx, dz] = transformMoveToWorld([1, 1], 0);
    expect(Math.hypot(dx, dz)).toBeCloseTo(1, 6);
  });

  it('triggers action buttons (including dash & pause) strictly on false -> true', () => {
    const frames = validateAndParseInputs(
      JSON.stringify({
        frames: [
          { tick: 0, interact: true, dash: true, pause: true },
          { tick: 1, move: [0, 0] },
          { tick: 2, interact: false, dash: false, pause: false },
          { tick: 3, interact: true, dash: true, pause: true },
        ],
      })
    );
    const tl = new InputTimeline(frames);
    const s0 = tl.sampleForTick(0);
    expect(s0.interactPressed).toBe(true);
    expect(s0.dashPressed).toBe(true);
    expect(s0.pausePressed).toBe(true);

    const s1 = tl.sampleForTick(1);
    expect(s1.interactPressed).toBe(false);
    expect(s1.dashPressed).toBe(false);
    expect(s1.pausePressed).toBe(false);

    tl.sampleForTick(2);
    const s3 = tl.sampleForTick(3);
    expect(s3.interactPressed).toBe(true);
    expect(s3.dashPressed).toBe(true);
    expect(s3.pausePressed).toBe(true);
  });

  it('rejects non-increasing frame ticks and malformed scenario with FormatError', () => {
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

    expect(() => validateAndParseScenario('{bad json')).toThrow(FormatError);
    expect(() =>
      validateAndParseScenario(JSON.stringify({ lanterns: [{ id: 'UNKNOWN', lit: true }] }), 1)
    ).toThrow(FormatError);
  });
});

describe('game.contract.json v1.1 single source of truth', () => {
  it('exposes exact v1.1 schema and matching tuning constants', () => {
    const raw = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../game.contract.json'), 'utf8')
    );
    expect(raw.contract_version).toBe('1.1');
    expect(raw.tuning).toEqual(TUNING);
    expect(CONTRACT.tuning.carry_capacity).toBe(10);
    expect(CONTRACT.tuning.lantern_cost).toBe(10);
    expect(CONTRACT.tuning.dash_speed).toBe(14.0);
  });
});

describe('Standardized Night 1/2/3 map geometry', () => {
  it('defines exact lantern counts and jump pads for all 3 nights', () => {
    expect(getNightMap(1).lanterns).toHaveLength(5);
    expect(getNightMap(2).lanterns).toHaveLength(6);
    expect(getNightMap(2).jumpPads).toHaveLength(2);
    expect(getNightMap(3).lanterns).toHaveLength(7);
    expect(getNightMap(3).moteSpawns).toHaveLength(30);
  });

  it('blocks walking up Night 3 vertical cliffs and center Bell Tower, but allows 30° ramp', () => {
    const map3 = getNightMap(3);
    // Vertical cliff at (0, 23.5) z > 0 from y = 0 should be blocked
    const [bx, bz, blocked] = resolveHorizontalObstacles(map3, 0, 24.5, 0, 23.5, 0);
    expect(blocked).toBe(true);
    expect(bx).toBe(0);
    expect(bz).toBe(24.5);

    // 30° ramp at r=27 has height Y = 1.5
    const rx = 27 * Math.cos((30 * Math.PI) / 180);
    const rz = 27 * Math.sin((30 * Math.PI) / 180);
    expect(getReachableGroundY(map3, rx, rz, 1.6)).toBeCloseTo(1.5, 2);

    // Bell tower cylinder at (0, 0) R=2 blocks movement at y=6
    const [tx, tz, towerBlocked] = resolveHorizontalObstacles(map3, 2.2, 0, 1.5, 0, 6);
    expect(towerBlocked).toBe(true);
    expect(Math.hypot(tx, tz)).toBeGreaterThanOrEqual(2.0);
  });
});

describe('Creative isolation guarantee', () => {
  it('keeps headless (creative: false) free of wandering girl, buffs, and variant stats', () => {
    const simHeadless = new Simulation(42, 1, {}, { creative: false });
    expect(simHeadless.wanderingGirl.active).toBe(false);
    expect(simHeadless.motes.every((m) => m.color === 'gold')).toBe(true);
    expect(simHeadless.shades.every((s) => s.variant === 'standard')).toBe(true);
  });

  it('enables wandering girl (+5 light) only when creative: true', () => {
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
      pausePressed: false,
    });
    expect(simCreative.wanderingGirl.found).toBe(true);
    expect(simCreative.player.carried).toBe(5);
  });
});
