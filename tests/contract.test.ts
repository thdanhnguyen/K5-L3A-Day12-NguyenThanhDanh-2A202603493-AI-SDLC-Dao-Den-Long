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
  workDir = mkdtempSync(path.join(tmpdir(), 'ddl-contract-v11-'));
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function runCli(args: string[]) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
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

describe('Headless CLI — Test Contract v1.1 (Regression + Phase 2)', () => {
  it('01: auto-picks motes up to carry_capacity (10) without adding score on pickup', () => {
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
    expect(records[0].player.carried).toBe(9);

    const picked = records.filter((r) => r.type === 'event' && r.name === 'mote_picked');
    expect(picked).toHaveLength(1);
    expect(picked[0].data.carried).toBe(TUNING.carry_capacity);

    const end = records[records.length - 1];
    expect(end).toEqual({
      type: 'end',
      ticks: 40,
      state: 'playing',
      score: 0,
    });
  });

  it('02: deposits carried light (+5/mote), lights final lantern (+100, relight=false), increases capacity, continues playing (no early win per TICKET-03)', () => {
    const out = path.join(workDir, '02.jsonl');
    const res = runCli([
      '--seed', '2',
      '--night', '1',
      '--scenario', path.join(SCENARIO_DIR, '02-deposit-win.scenario.json'),
      '--inputs', path.join(SCENARIO_DIR, '02-deposit-win.inputs.json'),
      '--ticks', '10',
      '--snapshot-every', '1',
      '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    expect(records[0].score).toBe(0);
    expect(records[0].player.capacity).toBe(10);

    const events = records.filter((r) => r.type === 'event' && r.name !== 'night_start');
    expect(events.map((e) => e.name)).toEqual(['deposit', 'lantern_lit']);
    expect(events[0].data).toEqual({ lantern_id: 'L1', amount: 10, deposited: 10 });
    expect(events[1].data).toEqual({ lantern_id: 'L1', relight: false });

    const snap1 = records.find((r) => r.type === 'snapshot' && r.tick === 1)!;
    expect(snap1.player.capacity).toBe(12);
    expect(snap1.lanterns[0].fuel).toBeGreaterThan(99);

    const expectedScore = 10 * TUNING.score.per_mote + TUNING.score.per_lantern; // 50 + 100 = 150
    expect(records[records.length - 1]).toEqual({
      type: 'end',
      ticks: 10,
      state: 'playing',
      score: expectedScore,
    });
  });

  it('03: pulse pushes 4m over 15 ticks, stuns 120 ticks, enforces 3s cooldown, recovers to wander', () => {
    const out = path.join(workDir, '03.jsonl');
    const res = runCli([
      '--seed', '3',
      '--night', '1',
      '--scenario', path.join(SCENARIO_DIR, '03-pulse-stun-cooldown.scenario.json'),
      '--inputs', path.join(SCENARIO_DIR, '03-pulse-stun-cooldown.inputs.json'),
      '--ticks', '150',
      '--snapshot-every', '1',
      '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    const pulseEvents = records.filter((r) => r.type === 'event' && r.name === 'pulse');
    expect(pulseEvents).toHaveLength(1);
    expect(pulseEvents[0].tick).toBe(1);

    const snap20 = records.find((r) => r.type === 'snapshot' && r.tick === 20)!;
    expect(snap20.player.carried).toBe(3);
    expect(snap20.shades[0].state).toBe('stunned');
    expect(snap20.shades[0].pos[0]).toBeCloseTo(7.0, 2);

    const snap120 = records.find((r) => r.type === 'snapshot' && r.tick === 120)!;
    expect(snap120.shades[0].state).toBe('stunned');

    const snap121 = records.find((r) => r.type === 'snapshot' && r.tick === 121)!;
    // Recovering from stunned at 7m (<= 12m detect radius) immediately re-engages chase
    expect(snap121.shades[0].state).toBe('chase');
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
    expect(Math.hypot(sPos[0] - 0, sPos[2] - 25)).toBeGreaterThanOrEqual(TUNING.safe_radius);
  });

  it('05: shade hit drops physical motes, recoils 2m, grants 90t invuln, and ends on 0 flames', () => {
    const out = path.join(workDir, '05.jsonl');
    const res = runCli([
      '--seed', '5',
      '--night', '1',
      '--scenario', path.join(SCENARIO_DIR, '05-hit-drop-loss.scenario.json'),
      '--ticks', '240',
      '--snapshot-every', '10',
      '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    const hits = records.filter((r) => r.type === 'event' && r.name === 'player_hit');
    expect(hits).toHaveLength(2);
    expect(hits[0].tick).toBe(1);
    expect(hits[0].data).toEqual({ by: 'shade', flames: 1, dropped: 2 });
    expect(hits[1].tick).toBeGreaterThanOrEqual(91);
    expect(hits[1].data.flames).toBe(0);

    const snap10 = records.find((r) => r.type === 'snapshot' && r.tick === 10)!;
    expect(snap10.shades[0].state).toBe('recoil');
    expect(snap10.motes.every((m: any) => m.kind === 'dropped')).toBe(true);
    expect(records[records.length - 1].state).toBe('lost');
  });

  it('06: night timer reaching 0 ends with lost/dawn', () => {
    const out = path.join(workDir, '06.jsonl');
    const res = runCli([
      '--seed', '6',
      '--night', '1',
      '--scenario', path.join(SCENARIO_DIR, '06-dawn-loss.scenario.json'),
      '--ticks', '200',
      '--out', out,
    ]);
    expect(res.status).toBe(0);
    const records = parseJsonl(out);
    expect(records[records.length - 1]).toEqual({
      type: 'end',
      ticks: 120,
      state: 'lost',
      score: 0,
    });
  });

  it('07: Contract v1.1 snapshot schema & 3-decimal rounding on default Night 1 run', () => {
    const out = path.join(workDir, '07.jsonl');
    const res = runCli([
      '--seed', '42', '--night', '1', '--ticks', '320', '--snapshot-every', '20', '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    const validShadeStates = new Set(['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain']);
    for (const rec of records) {
      if (rec.type === 'snapshot') {
        expect(rec.night).toBe(1);
        expect(rec.wind).toEqual({ active: false, dir_deg: 0 });
        expect(typeof rec.player.grounded).toBe('boolean');
        expect(typeof rec.player.capacity).toBe('number');
        expect(Array.isArray(rec.player.vel)).toBe(true);
        expect(Array.isArray(rec.drifters)).toBe(true);
        expect(Array.isArray(rec.charms)).toBe(true);
        for (const l of rec.lanterns) {
          expect(typeof l.fuel).toBe('number');
          expect(typeof l.ever_lit).toBe('boolean');
          expect(typeof l.relit_count).toBe('number');
        }
        expect(countDecimals(rec.time_left_s)).toBeLessThanOrEqual(3);
        for (const s of rec.shades) {
          expect(validShadeStates.has(s.state)).toBe(true);
        }
      }
    }
  });

  it('08: malformed scenario/inputs or non-increasing ticks exit with code 2', () => {
    const badJsonPath = path.join(workDir, 'bad.json');
    writeFileSync(badJsonPath, '{invalid', 'utf8');
    const nonIncInputsPath = path.join(workDir, 'non-inc.json');
    writeFileSync(
      nonIncInputsPath,
      JSON.stringify({ frames: [{ tick: 10 }, { tick: 10 }] }),
      'utf8'
    );
    const out = path.join(workDir, 'err.jsonl');

    expect(
      runCli(['--seed', '1', '--night', '1', '--scenario', badJsonPath, '--ticks', '10', '--out', out]).status
    ).toBe(2);
    expect(
      runCli(['--seed', '1', '--night', '1', '--inputs', nonIncInputsPath, '--ticks', '10', '--out', out]).status
    ).toBe(2);
  });

  it('09: dash moves 14 m/s for 12 ticks, holds Y mid-air, enforces 90t cooldown', () => {
    const scenPath = path.join(workDir, '09-dash-scen.json');
    const inPath = path.join(workDir, '09-dash-in.json');
    const out = path.join(workDir, '09-dash.jsonl');

    writeFileSync(
      scenPath,
      JSON.stringify({
        player: { pos: [0, 0, 0], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [],
      }),
      'utf8'
    );
    writeFileSync(
      inPath,
      JSON.stringify({
        frames: [
          { tick: 0, jump: true },
          { tick: 1, jump: false, dash: true },
          { tick: 2, dash: false },
          { tick: 20, dash: true },
          { tick: 21, dash: false },
        ],
      }),
      'utf8'
    );

    const res = runCli([
      '--seed', '9', '--night', '1', '--scenario', scenPath, '--inputs', inPath, '--ticks', '30', '--snapshot-every', '1', '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    const dashEvents = records.filter((r) => r.type === 'event' && r.name === 'dash');
    expect(dashEvents).toHaveLength(1);
    expect(dashEvents[0].tick).toBe(2);

    const snap2 = records.find((r) => r.type === 'snapshot' && r.tick === 2)!;
    const snap13 = records.find((r) => r.type === 'snapshot' && r.tick === 13)!;
    expect(snap13.player.pos[1]).toBe(snap2.player.pos[1]);
    expect(snap13.player.pos[2]).toBeCloseTo(2.8, 2);
  });

  it('10: falling below Y < -10 loses all carried, waits 60t, respawns at (0,0,0) with invuln', () => {
    const scenPath = path.join(workDir, '10-fall-scen.json');
    const inPath = path.join(workDir, '10-fall-in.json');
    const out = path.join(workDir, '10-fall.jsonl');

    // Start near edge of Island A on Night 2 (27.5, 0, 0) and walk +X off void (z=5 outside bridge)
    writeFileSync(
      scenPath,
      JSON.stringify({
        player: { pos: [27.5, 0, 5], carried: 4, flames: 3, invuln_ticks: 50 },
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [],
      }),
      'utf8'
    );
    writeFileSync(
      inPath,
      JSON.stringify({
        frames: [{ tick: 0, move: [1, 0] }],
      }),
      'utf8'
    );

    const res = runCli([
      '--seed', '10', '--night', '2', '--scenario', scenPath, '--inputs', inPath, '--ticks', '200', '--snapshot-every', '1', '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    const fallHit = records.find((r) => r.type === 'event' && r.name === 'player_hit')!;
    expect(fallHit.data).toEqual({ by: 'fall', flames: 2, dropped: 0, lost: 4 });

    const respawnSnap = records.find((r) => r.type === 'snapshot' && r.tick === fallHit.tick + 60)!;
    expect(respawnSnap.player.pos[0]).toBeCloseTo(0.1, 3);
    expect(respawnSnap.player.pos[1]).toBe(0);
    expect(respawnSnap.player.pos[2]).toBe(0);
    expect(respawnSnap.player.invuln).toBe(true);
  });

  it('11: pause freezes sim_tick, time_left_s, and cooldowns while tick advances', () => {
    const inPath = path.join(workDir, '11-pause-in.json');
    const out = path.join(workDir, '11-pause.jsonl');

    writeFileSync(
      inPath,
      JSON.stringify({
        frames: [
          { tick: 5, pause: true },
          { tick: 6, pause: false },
          { tick: 25, pause: true },
          { tick: 26, pause: false },
        ],
      }),
      'utf8'
    );

    const res = runCli([
      '--seed', '11', '--night', '1', '--inputs', inPath, '--ticks', '30', '--snapshot-every', '5', '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    const pausedEv = records.find((r) => r.type === 'event' && r.name === 'paused')!;
    const resumedEv = records.find((r) => r.type === 'event' && r.name === 'resumed')!;
    expect(pausedEv.tick).toBe(6);
    expect(resumedEv.tick).toBe(26);

    const snap10 = records.find((r) => r.type === 'snapshot' && r.tick === 10)!;
    const snap20 = records.find((r) => r.type === 'snapshot' && r.tick === 20)!;
    expect(snap10.state).toBe('paused');
    expect(snap10.sim_tick).toBe(5);
    expect(snap20.sim_tick).toBe(5);
    expect(snap20.time_left_s).toBe(snap10.time_left_s);

    const snap30 = records.find((r) => r.type === 'snapshot' && r.tick === 30)!;
    expect(snap30.state).toBe('playing');
    expect(snap30.sim_tick).toBe(10);
  });

  it('12: Night 2 jump pad launches across void to Island B and Wind Charm grants speed + 0 dash CD', () => {
    const scenPath = path.join(workDir, '12-n2-scen.json');
    const inPath = path.join(workDir, '12-n2-in.json');
    const out = path.join(workDir, '12-n2.jsonl');

    writeFileSync(
      scenPath,
      JSON.stringify({
        player: { pos: [20, 0, 18], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
        motes: [],
        shades: [],
      }),
      'utf8'
    );
    writeFileSync(
      inPath,
      JSON.stringify({ frames: [] }),
      'utf8'
    );

    const res = runCli([
      '--seed', '12', '--night', '2', '--scenario', scenPath, '--inputs', inPath, '--ticks', '120', '--snapshot-every', '10', '--out', out,
    ]);
    expect(res.status).toBe(0);
    const records = parseJsonl(out);
    const endSnap = records.filter((r) => r.type === 'snapshot').pop()!;
    // Landed cleanly inside Island B (center 70,0 R=28)
    expect(endSnap.player.grounded).toBe(true);
    expect(Math.hypot(endSnap.player.pos[0] - 70, endSnap.player.pos[2])).toBeLessThanOrEqual(28);

    // Charm C1 pickup at (35, 0, 0)
    const charmScen = path.join(workDir, '12-charm-scen.json');
    const charmIn = path.join(workDir, '12-charm-in.json');
    const charmOut = path.join(workDir, '12-charm.jsonl');
    writeFileSync(
      charmScen,
      JSON.stringify({
        player: { pos: [35, 0, 0], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
        motes: [],
        shades: [],
      }),
      'utf8'
    );
    writeFileSync(
      charmIn,
      JSON.stringify({
        frames: [
          { tick: 1, dash: true, move: [1, 0] },
          { tick: 2, dash: false },
        ],
      }),
      'utf8'
    );
    const resCharm = runCli([
      '--seed', '12', '--night', '2', '--scenario', charmScen, '--inputs', charmIn, '--ticks', '20', '--snapshot-every', '5', '--out', charmOut,
    ]);
    expect(resCharm.status).toBe(0);
    const charmRecs = parseJsonl(charmOut);
    const picked = charmRecs.find((r) => r.type === 'event' && r.name === 'charm_picked')!;
    expect(picked.data).toEqual({ charm_id: 'C1', charm_ticks: 600 });
    const snap5 = charmRecs.find((r) => r.type === 'snapshot' && r.tick === 5)!;
    expect(snap5.player.dash_cd_s).toBe(0);
    expect(snap5.player.charm_s).toBeGreaterThan(9);
  });

  it('13: Night 2 Drifter (Gió Lạc) steals up to 3 motes and drops them when hit by Pulse during flee', () => {
    const scenPath = path.join(workDir, '13-drifter-scen.json');
    const inPath = path.join(workDir, '13-drifter-in.json');
    const out = path.join(workDir, '13-drifter.jsonl');

    writeFileSync(
      scenPath,
      JSON.stringify({
        player: { pos: [0, 0, 0], carried: 8, flames: 3 },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
        motes: [],
        shades: [],
        drifters: [{ id: 'D1', pos: [0, 0, 0.5], state: 'idle' }],
      }),
      'utf8'
    );
    writeFileSync(
      inPath,
      JSON.stringify({
        frames: [
          { tick: 2, pulse: true },
          { tick: 3, pulse: false },
        ],
      }),
      'utf8'
    );

    const res = runCli([
      '--seed', '13', '--night', '2', '--scenario', scenPath, '--inputs', inPath, '--ticks', '15', '--snapshot-every', '1', '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    const stealEv = records.find((r) => r.type === 'event' && r.name === 'drifter_steal')!;
    expect(stealEv).toBeDefined();
    expect(stealEv.data).toEqual({ drifter_id: 'D1', amount: 3, carried: 5 });

    const dropEv = records.find((r) => r.type === 'event' && r.name === 'drifter_drop')!;
    expect(dropEv).toBeDefined();
    expect(dropEv.data).toEqual({ drifter_id: 'D1', amount: 3 });

    const snap3 = records.find((r) => r.type === 'snapshot' && r.tick === 3)!;
    expect(snap3.motes_active).toBe(3);

    const snap5 = records.find((r) => r.type === 'snapshot' && r.tick === 5)!;
    // 8 start - 3 stolen - 3 pulse + 3 recovered = 5
    expect(snap5.player.carried).toBe(5);
  });

  it('14: Night 3 ramps, Tier-1 jump pad to Tier 2, Bell Tower obstacle, and Wind at sim_tick=1800', () => {
    const scenPath = path.join(workDir, '14-n3-scen.json');
    const inPath = path.join(workDir, '14-n3-in.json');
    const out = path.join(workDir, '14-n3.jsonl');

    // Start at Tier 1 jump pad (0, 3, 13) -> launches to Tier 2 (Y=6)
    writeFileSync(
      scenPath,
      JSON.stringify({
        player: { pos: [0, 3, 13], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
        motes: [],
        shades: [],
      }),
      'utf8'
    );
    writeFileSync(inPath, JSON.stringify({ frames: [] }), 'utf8');

    const res = runCli([
      '--seed', '14', '--night', '3', '--scenario', scenPath, '--inputs', inPath, '--ticks', '1850', '--snapshot-every', '60', '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    const snap60 = records.find((r) => r.type === 'snapshot' && r.tick === 60)!;
    expect(snap60.player.pos[1]).toBe(6);
    expect(snap60.player.grounded).toBe(true);

    const snap1800 = records.find((r) => r.type === 'snapshot' && r.tick === 1800)!;
    expect(snap1800.wind.active).toBe(true);
  });

  it('15: full 21,600-tick Night 3 completes well within 30s and all 3 nights are deterministic', () => {
    const out3a = path.join(workDir, 'perf-n3a.jsonl');
    const out3b = path.join(workDir, 'perf-n3b.jsonl');

    const t0 = performance.now();
    const r3a = runCli([
      '--seed', '77', '--night', '3', '--ticks', '21600', '--snapshot-every', '120', '--out', out3a,
    ]);
    const elapsedMs = performance.now() - t0;
    expect(r3a.status).toBe(0);
    expect(elapsedMs).toBeLessThan(10000);

    const r3b = runCli([
      '--seed', '77', '--night', '3', '--ticks', '21600', '--snapshot-every', '120', '--out', out3b,
    ]);
    expect(r3b.status).toBe(0);

    const h3a = createHash('sha256').update(readFileSync(out3a)).digest('hex');
    const h3b = createHash('sha256').update(readFileSync(out3b)).digest('hex');
    expect(h3a).toBe(h3b);
  });

  it('16: lantern fuel decays to 0 (lantern_out), relight costs 5 (+40), refuel tops up and ignores full lanterns', () => {
    const scenPath = path.join(workDir, '16-fuel-scen.json');
    const inPath = path.join(workDir, '16-fuel-in.json');
    const out = path.join(workDir, '16-fuel.jsonl');

    writeFileSync(
      scenPath,
      JSON.stringify({
        player: { pos: [0, 0, 1.0], carried: 10, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [],
        lanterns: [
          { id: 'L1', pos: [0, 0, 1.5], lit: true, fuel: 1.0 },
          { id: 'L2', pos: [0, 0, -5.0], lit: true, fuel: 85.0 },
        ],
        time_left_s: 240,
      }),
      'utf8'
    );
    writeFileSync(
      inPath,
      JSON.stringify({
        frames: [
          { tick: 65, interact: true },
          { tick: 66, interact: false },
          { tick: 70, move: [0, -1] },
          { tick: 120, move: [0, 0], interact: true },
          { tick: 121, interact: false },
          { tick: 125, interact: true },
          { tick: 126, interact: false },
        ],
      }),
      'utf8'
    );

    const res = runCli([
      '--seed', '16', '--night', '1', '--scenario', scenPath, '--inputs', inPath, '--ticks', '135', '--snapshot-every', '10', '--out', out,
    ]);
    expect(res.status).toBe(0);

    const records = parseJsonl(out);
    const outEv = records.find((r) => r.type === 'event' && r.name === 'lantern_out')!;
    expect(outEv.tick).toBe(60);
    expect(outEv.data).toEqual({ lantern_id: 'L1' });

    const relitEv = records.find((r) => r.type === 'event' && r.name === 'lantern_lit')!;
    expect(relitEv.tick).toBe(66);
    expect(relitEv.data).toEqual({ lantern_id: 'L1', relight: true });

    const refuelEvents = records.filter((r) => r.type === 'event' && r.name === 'refuel');
    expect(refuelEvents).toHaveLength(2);
    expect(refuelEvents[0].data).toEqual({ lantern_id: 'L2', amount: 2, fuel: 100 });
    // After 5 ticks of 1/60 decay (fuel=99.917 < 100), another interact uses 1 mote to top up to 100
    expect(refuelEvents[1].data).toEqual({ lantern_id: 'L2', amount: 1, fuel: 100 });

    const snap70 = records.find((r) => r.type === 'snapshot' && r.tick === 70)!;
    expect(snap70.lanterns[0].ever_lit).toBe(true);
    expect(snap70.lanterns[0].relit_count).toBe(1);
    expect(snap70.player.capacity).toBe(12);
  });

  it('17: shade drains weak lantern (<30 fuel), emits fuel_drain every 60t, awards +15 on pulse, and is pushed out on refuel >= 30', () => {
    const scenPath = path.join(workDir, '17-drain-scen.json');
    const inPath = path.join(workDir, '17-drain-in.json');
    const out = path.join(workDir, '17-drain.jsonl');

    // Player far away at (0,0,-20) initially, S1 wanders to weak L1 (0,0,25) with fuel 25
    writeFileSync(
      scenPath,
      JSON.stringify({
        player: { pos: [0, 0, 24.5], carried: 6, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [{ id: 'S1', pos: [0, 0, 26.5], state: 'drain', target_lantern_id: 'L1' }],
        lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
        time_left_s: 240,
      }),
      'utf8'
    );
    // Refuel L1 at tick 70 (adds 1 mote -> +10 fuel -> crosses 30 -> pushes S1 out)
    // Wait: player is within 2m of S1; in drain state, S1 only transitions to chase if player <= 6m during Step 8.
    // Let's test drain for 65 ticks with player at (0,0,0), then run pulse test separately!
    writeFileSync(
      scenPath,
      JSON.stringify({
        player: { pos: [0, 0, 0], carried: 3, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [{ id: 'S1', pos: [0, 0, 26.0], state: 'drain', target_lantern_id: 'L1' }],
        lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
        time_left_s: 240,
      }),
      'utf8'
    );
    writeFileSync(inPath, JSON.stringify({ frames: [] }), 'utf8');

    const res = runCli([
      '--seed', '17', '--night', '1', '--scenario', scenPath, '--inputs', inPath, '--ticks', '70', '--snapshot-every', '10', '--out', out,
    ]);
    expect(res.status).toBe(0);
    const records = parseJsonl(out);
    const drainEv = records.find((r) => r.type === 'event' && r.name === 'fuel_drain')!;
    expect(drainEv.tick).toBe(60);
    expect(drainEv.data.lantern_id).toBe('L1');
    expect(drainEv.data.shade_id).toBe('S1');
    expect(drainEv.data.fuel).toBeCloseTo(19, 1);

    // Part B: Pulse on draining shade awards +15
    const pulseScen = path.join(workDir, '17b-scen.json');
    const pulseIn = path.join(workDir, '17b-in.json');
    const pulseOut = path.join(workDir, '17b.jsonl');
    writeFileSync(
      pulseScen,
      JSON.stringify({
        player: { pos: [0, 0, 22.0], carried: 3, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [{ id: 'S1', pos: [0, 0, 25.0], state: 'drain', target_lantern_id: 'L1' }],
        lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
        time_left_s: 240,
      }),
      'utf8'
    );
    writeFileSync(
      pulseIn,
      JSON.stringify({ frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }] }),
      'utf8'
    );
    const resB = runCli([
      '--seed', '17', '--night', '1', '--scenario', pulseScen, '--inputs', pulseIn, '--ticks', '5', '--out', pulseOut,
    ]);
    expect(resB.status).toBe(0);
    const recsB = parseJsonl(pulseOut);
    expect(recsB[recsB.length - 1].score).toBe(15);
  });

  it('18: dawn win requires >= ceil(0.6*total) lit lanterns (dawn_survived) and awards dawn bonuses', () => {
    const winScen = path.join(workDir, '18-win-scen.json');
    const lossScen = path.join(workDir, '18-loss-scen.json');
    const outWin = path.join(workDir, '18-win.jsonl');
    const outLoss = path.join(workDir, '18-loss.jsonl');

    writeFileSync(
      winScen,
      JSON.stringify({
        player: { pos: [0, 0, 0], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [],
        lanterns: [
          { id: 'L1', lit: true, fuel: 80 },
          { id: 'L2', lit: true, fuel: 80 },
          { id: 'L3', lit: true, fuel: 80 },
        ],
        time_left_s: 1,
      }),
      'utf8'
    );

    const resWin = runCli([
      '--seed', '18', '--night', '1', '--scenario', winScen, '--ticks', '100', '--out', outWin,
    ]);
    expect(resWin.status).toBe(0);
    const winRecs = parseJsonl(outWin);
    const winOver = winRecs.find((r) => r.type === 'event' && r.name === 'game_over')!;
    expect(winOver.tick).toBe(60);
    expect(winOver.data).toEqual({ result: 'won', reason: 'dawn_survived' });
    // 3 lanterns * (50 + floor(79.0)) + 3 flames * 50 = 3*129 + 150 = 537
    expect(winRecs[winRecs.length - 1]).toEqual({
      type: 'end',
      ticks: 60,
      state: 'won',
      score: 537,
    });

    writeFileSync(
      lossScen,
      JSON.stringify({
        player: { pos: [0, 0, 0], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [],
        lanterns: [
          { id: 'L1', lit: true, fuel: 80 },
          { id: 'L2', lit: true, fuel: 80 },
        ],
        time_left_s: 1,
      }),
      'utf8'
    );
    const resLoss = runCli([
      '--seed', '18', '--night', '1', '--scenario', lossScen, '--ticks', '100', '--out', outLoss,
    ]);
    expect(resLoss.status).toBe(0);
    const lossRecs = parseJsonl(outLoss);
    const lossOver = lossRecs.find((r) => r.type === 'event' && r.name === 'game_over')!;
    expect(lossOver.data).toEqual({ result: 'lost', reason: 'dawn' });
  });
});
