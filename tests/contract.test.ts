import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TUNING } from '../src/sim/config';

const ROOT = path.resolve(__dirname, '..');
const CLI_PATH = path.join(ROOT, 'dist', 'headless', 'cli.js');
const SCENARIO_DIR = path.join(ROOT, 'tests', 'scenarios');

let workDir: string;

beforeAll(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'ddl-contract-'));
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function runCli(args: string[]) {
  const res = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return res;
}

function parseJsonl(filePath: string): Array<Record<string, any>> {
  const raw = readFileSync(filePath, 'utf8').trim();
  return raw.split('\n').map((line) => JSON.parse(line));
}

function countDecimals(n: number): number {
  const s = String(n);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

describe('Headless CLI — Test Contract v1.0', () => {
  it('01: auto-picks motes up to carry_capacity and honors snapshot-every', () => {
    const out = path.join(workDir, '01.jsonl');
    const res = runCli([
      '--seed', '1',
      '--night', '1',
      '--scenario', path.join(SCENARIO_DIR, '01-pickup-capacity.scenario.json'),
      '--inputs', path.join(SCENARIO_DIR, '01-pickup-capacity.inputs.json'),
      '--ticks', '40',
      '--snapshot-every', '10',
      '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    expect(records[0].type).toBe('snapshot');
    expect(records[0].tick).toBe(0);
    expect(records[0].player.carried).toBe(7);

    const picked = records.filter((r) => r.type === 'event' && r.name === 'mote_picked');
    expect(picked).toHaveLength(1);
    expect(picked[0].data.carried).toBe(TUNING.carry_capacity);

    const end = records[records.length - 1];
    expect(end).toEqual({
      type: 'end',
      ticks: 40,
      state: 'playing',
      score: TUNING.score.per_mote,
    });

    const snapshots = records.filter((r) => r.type === 'snapshot');
    expect(snapshots.map((s) => s.tick)).toEqual([0, 10, 20, 30, 40]);
    expect(snapshots[snapshots.length - 1].motes_active).toBe(1);
  });

  it('02: deposits carried light, lights final lantern, adds bonuses, and stops with won/all_lit', () => {
    const out = path.join(workDir, '02.jsonl');
    const res = runCli([
      '--seed', '2',
      '--night', '1',
      '--scenario', path.join(SCENARIO_DIR, '02-deposit-win.scenario.json'),
      '--inputs', path.join(SCENARIO_DIR, '02-deposit-win.inputs.json'),
      '--ticks', '100',
      '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    // Tick 0 snapshot should have 0 score even though 4 lanterns started lit: true
    expect(records[0].score).toBe(0);

    const events = records.filter((r) => r.type === 'event');
    expect(events.map((e) => e.name)).toEqual(['deposit', 'lantern_lit', 'game_over']);
    expect(events[0].tick).toBe(1);
    expect(events[0].data).toEqual({ lantern_id: 'L1', amount: 3, deposited: 3 });
    expect(events[1].data).toEqual({ lantern_id: 'L1' });
    expect(events[2].data).toEqual({ result: 'won', reason: 'all_lit' });

    const expectedTimeLeft = Math.floor(100 - 1 / 60); // 99
    const expectedScore =
      TUNING.score.per_lantern +
      expectedTimeLeft * TUNING.score.per_second_left +
      3 * TUNING.score.per_flame_left;
    const end = records[records.length - 1];
    expect(end).toEqual({
      type: 'end',
      ticks: 1,
      state: 'won',
      score: expectedScore,
    });
  });

  it('03: pulse stuns and pushes shades, enforces cooldown, and recovers after pulse_stun_s', () => {
    const out = path.join(workDir, '03.jsonl');
    const res = runCli([
      '--seed', '3',
      '--night', '1',
      '--scenario', path.join(SCENARIO_DIR, '03-pulse-stun-cooldown.scenario.json'),
      '--inputs', path.join(SCENARIO_DIR, '03-pulse-stun-cooldown.inputs.json'),
      '--ticks', '200',
      '--snapshot-every', '20',
      '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    const pulseEvents = records.filter((r) => r.type === 'event' && r.name === 'pulse');
    expect(pulseEvents).toHaveLength(1);
    expect(pulseEvents[0].tick).toBe(1);
    expect(pulseEvents[0].data).toEqual({ stunned_ids: ['S1'] });

    const snap20 = records.find((r) => r.type === 'snapshot' && r.tick === 20)!;
    expect(snap20.player.carried).toBe(2);
    expect(snap20.shades[0].state).toBe('stunned');
    expect(snap20.shades[0].pos[0]).toBeCloseTo(7.0, 2);

    const snap200 = records.find((r) => r.type === 'snapshot' && r.tick === 200)!;
    expect(snap200.shades[0].state).toBe('chase');
  });

  it('04: lit lantern safe_radius prevents shade from entering or hitting player', () => {
    const out = path.join(workDir, '04.jsonl');
    const res = runCli([
      '--seed', '4',
      '--night', '1',
      '--scenario', path.join(SCENARIO_DIR, '04-safe-radius.scenario.json'),
      '--ticks', '240',
      '--snapshot-every', '60',
      '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    const hits = records.filter((r) => r.type === 'event' && r.name === 'player_hit');
    expect(hits).toHaveLength(0);

    const endSnap = records.filter((r) => r.type === 'snapshot').pop()!;
    const sPos = endSnap.shades[0].pos;
    const distToLantern = Math.hypot(sPos[0] - 0, sPos[2] - 22);
    expect(distToLantern).toBeGreaterThanOrEqual(TUNING.safe_radius);
  });

  it('05: shade hit drops carried motes, grants invuln_s, and ends game on 0 flames', () => {
    const out = path.join(workDir, '05.jsonl');
    const res = runCli([
      '--seed', '5',
      '--night', '1',
      '--scenario', path.join(SCENARIO_DIR, '05-hit-drop-loss.scenario.json'),
      '--ticks', '180',
      '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    const hits = records.filter((r) => r.type === 'event' && r.name === 'player_hit');
    expect(hits).toHaveLength(2);
    expect(hits[0].tick).toBe(1);
    expect(hits[0].data).toEqual({
      by: 'shade',
      flames: 1,
      dropped: Math.floor(5 * TUNING.hit_drop_ratio),
    });
    // Second hit must occur right after invuln_s (1.5s = 90 ticks)
    expect(hits[1].tick).toBe(91);
    expect(hits[1].data.flames).toBe(0);

    const over = records.find((r) => r.type === 'event' && r.name === 'game_over')!;
    expect(over.data).toEqual({ result: 'lost', reason: 'no_flames' });

    const end = records[records.length - 1];
    expect(end.state).toBe('lost');
  });

  it('06: night timer reaching 0 ends with lost/dawn', () => {
    const out = path.join(workDir, '06.jsonl');
    const res = runCli([
      '--seed', '6',
      '--night', '1',
      '--scenario', path.join(SCENARIO_DIR, '06-dawn-loss.scenario.json'),
      '--ticks', '200',
      '--snapshot-every', '60',
      '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    const over = records.find((r) => r.type === 'event' && r.name === 'game_over')!;
    expect(over.tick).toBe(120);
    expect(over.data).toEqual({ result: 'lost', reason: 'dawn' });

    const end = records[records.length - 1];
    expect(end).toEqual({ type: 'end', ticks: 120, state: 'lost', score: 0 });
  });

  it('07: determinism & 3-decimal coordinate rounding on default Night 1 run', () => {
    const out1 = path.join(workDir, 'det1.jsonl');
    const out2 = path.join(workDir, 'det2.jsonl');
    const args = ['--seed', '42', '--night', '1', '--ticks', '600', '--snapshot-every', '10'];

    const r1 = runCli([...args, '--out', out1]);
    const r2 = runCli([...args, '--out', out2]);
    expect(r1.status).toBe(0);
    expect(r2.status).toBe(0);

    const bytes1 = readFileSync(out1);
    const bytes2 = readFileSync(out2);
    const h1 = createHash('sha256').update(bytes1).digest('hex');
    const h2 = createHash('sha256').update(bytes2).digest('hex');
    expect(h1).toBe(h2);

    const records = parseJsonl(out1);
    for (const rec of records) {
      if (rec.type === 'snapshot') {
        expect(rec.sim_tick).toBe(rec.tick);
        expect(countDecimals(rec.time_left_s)).toBeLessThanOrEqual(3);
        for (const coord of rec.player.pos) expect(countDecimals(coord)).toBeLessThanOrEqual(3);
        for (const s of rec.shades) {
          for (const coord of s.pos) expect(countDecimals(coord)).toBeLessThanOrEqual(3);
        }
        expect(Array.isArray(rec.motes)).toBe(true);
        expect(rec.motes_active).toBe(rec.motes.length);
      }
    }
  });

  it('08: malformed scenario/inputs or non-increasing ticks exit with code 2 and stderr message', () => {
    const badJsonPath = path.join(workDir, 'bad.json');
    writeFileSync(badJsonPath, '{invalid', 'utf8');

    const nonIncInputsPath = path.join(workDir, 'non-inc.json');
    writeFileSync(
      nonIncInputsPath,
      JSON.stringify({
        frames: [
          { tick: 10, move: [0, 1] },
          { tick: 10, move: [0, 0] },
        ],
      }),
      'utf8'
    );

    const out = path.join(workDir, 'err.jsonl');

    const resBadScenario = runCli([
      '--seed', '1', '--night', '1', '--scenario', badJsonPath, '--ticks', '10', '--out', out,
    ]);
    expect(resBadScenario.status).toBe(2);
    expect(resBadScenario.stderr.trim().length).toBeGreaterThan(0);

    const resBadInputs = runCli([
      '--seed', '1', '--night', '1', '--inputs', nonIncInputsPath, '--ticks', '10', '--out', out,
    ]);
    expect(resBadInputs.status).toBe(2);
    expect(resBadInputs.stderr.trim().length).toBeGreaterThan(0);
  });

  it('09: exact boundary pickup distance and exact cooldown/stun tick timing (no IEEE-754 drift)', () => {
    const scenPath = path.join(workDir, '09-scen.json');
    const inPath = path.join(workDir, '09-in.json');
    const out = path.join(workDir, '09.jsonl');

    // Player walks +Z at 6 m/s (0.1 m/tick) -> after 10 ticks at z=1.0, mote at z=2.6 is exact dist=1.6 <= pickup_radius
    // Pulse at tick 0 -> tick 1; cooldown=2.0s (120 ticks) -> second pulse at tick 120 -> tick 121 succeeds; stun=3.0s (180 ticks) -> recovers at tick 181
    writeFileSync(
      scenPath,
      JSON.stringify({
        player: { pos: [0, 0, 0], carried: 3, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [[0, 0, 2.6]],
        shades: [{ id: 'S1', pos: [4, 0, 0] }],
        time_left_s: 180,
      }),
      'utf8'
    );
    writeFileSync(
      inPath,
      JSON.stringify({
        frames: [
          { tick: 0, move: [0, 1], pulse: true },
          { tick: 1, pulse: false },
          { tick: 10, move: [0, 0] },
          { tick: 120, pulse: true },
          { tick: 121, pulse: false },
        ],
      }),
      'utf8'
    );

    const res = runCli([
      '--seed', '9', '--night', '1', '--scenario', scenPath, '--inputs', inPath, '--ticks', '310', '--snapshot-every', '1', '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    const picked = records.find((r) => r.type === 'event' && r.name === 'mote_picked');
    expect(picked).toBeDefined();
    expect(picked!.tick).toBe(10);

    const pulses = records.filter((r) => r.type === 'event' && r.name === 'pulse');
    expect(pulses.map((p) => p.tick)).toEqual([1, 121]);

    const snap180 = records.find((r) => r.type === 'snapshot' && r.tick === 180)!;
    const snap181 = records.find((r) => r.type === 'snapshot' && r.tick === 181)!;
    expect(snap180.shades[0].state).toBe('stunned');
    expect(snap181.shades[0].state).toBe('chase');
  });

  it('10: jump vertical arc and cam_yaw_deg=90 world movement follow Test Contract v1.0', () => {
    const scenPath = path.join(workDir, '10-scen.json');
    const inPath = path.join(workDir, '10-in.json');
    const out = path.join(workDir, '10.jsonl');

    writeFileSync(
      scenPath,
      JSON.stringify({
        player: { pos: [0, 0, 0], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [],
        time_left_s: 180,
      }),
      'utf8'
    );
    writeFileSync(
      inPath,
      JSON.stringify({
        frames: [
          { tick: 0, move: [0, 1], cam_yaw_deg: 90, jump: true },
          { tick: 1, jump: false },
          { tick: 60, move: [0, 0] },
        ],
      }),
      'utf8'
    );

    const res = runCli([
      '--seed', '10', '--night', '1', '--scenario', scenPath, '--inputs', inPath, '--ticks', '80', '--snapshot-every', '10', '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    const snap20 = records.find((r) => r.type === 'snapshot' && r.tick === 20)!;
    const snap60 = records.find((r) => r.type === 'snapshot' && r.tick === 60)!;

    expect(snap20.player.pos[1]).toBeGreaterThan(0.5);
    expect(snap60.player.pos[0]).toBeCloseTo(6.0, 2);
    expect(snap60.player.pos[1]).toBe(0);
    expect(snap60.player.pos[2]).toBe(0);
  });
});
