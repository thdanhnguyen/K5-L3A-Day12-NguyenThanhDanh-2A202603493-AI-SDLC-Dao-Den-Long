import { DT, TICK_RATE, TUNING, dist3D, distXZ, round3, roundVec3 } from './config';
import {
  applyCreativeMoteBuff,
  createWanderingGirl,
  pickCreativeMoteColor,
  pickCreativeShadeVariant,
  stepWanderingGirl,
} from './creative';
import { transformMoveToWorld } from './input';
import {
  getGroundHeightAt,
  getNightMap,
  getReachableGroundY,
  isOnWalkableGround,
  resolveHorizontalObstacles,
  type NightMapDef,
} from './maps';
import { Mulberry32 } from './prng';
import type {
  CharmState,
  CreativeBuffs,
  DrifterState,
  EndRecord,
  GameState,
  LanternState,
  MoteState,
  PlayerState,
  ScenarioData,
  ShadeState,
  SimEvent,
  SimOptions,
  SnapshotRecord,
  StepInput,
  Vec3,
  WanderingGirlState,
  WindState,
} from './types';

const GRAVITY = 20.0;
const JUMP_VELOCITY = 7.0;
const EPS = 1e-6;

const INITIAL_RANDOM_MOTES = 20;
const MAX_MOTES = 30;
const MOTE_RESPAWN_TICKS = 240;
const DROPPED_MOTE_TTL_TICKS = 480;

const DASH_DURATION_TICKS = Math.round(TUNING.dash_duration_s * TICK_RATE); // 12
const DASH_COOLDOWN_TICKS = Math.round(TUNING.dash_cooldown_s * TICK_RATE); // 90
const PULSE_COOLDOWN_TICKS = Math.round(TUNING.pulse_cooldown_s * TICK_RATE); // 180
const PULSE_STUN_TICKS = Math.round(TUNING.pulse_stun_s * TICK_RATE); // 120
const PULSE_PUSH_TICKS = 15;
const INVULN_TICKS = Math.round(TUNING.invuln_s * TICK_RATE); // 90
const RECOIL_TICKS = 60;
const RECOIL_DIST_M = 2.0;
const RESPAWN_WAIT_TICKS = 60;

const CHARM_DURATION_TICKS = 600;
const CHARM_RESPAWN_TICKS = 2700;
const CHARM_SPEED = 7.2;

const DRIFTER_SPAWN_INTERVAL_TICKS = 1200;
const DRIFTER_IDLE_SPEED = 2.0;
const DRIFTER_CHASE_SPEED = 7.0;
const DRIFTER_DETECT_RADIUS = 15.0;
const DRIFTER_STEAL_RADIUS = 1.2;
const DRIFTER_FLEE_TICKS = 240;
const DRIFTER_DROP_FLEE_TICKS = 120;

const SHADE_DETECT_RADIUS = 12.0;
const SHADE_LOSE_RADIUS = 18.0;

const WIND_CYCLE_TICKS = 1800; // 30s
const WIND_TELEGRAPH_TICKS = 120; // 2s
const WIND_DURATION_TICKS = 300; // 5s
const WIND_PUSH_SPEED = 2.0;

export class Simulation {
  readonly seed: number;
  readonly night: 1 | 2 | 3;
  readonly map: NightMapDef;
  readonly creative: boolean;
  readonly prng: Mulberry32;

  tick = 0;
  simTick = 0;
  state: GameState = 'playing';
  winOrLoseReason: 'all_lit' | 'dawn' | 'no_flames' | null = null;
  score = 0;

  initialTimeLeftS: number;
  timeLeftS: number;
  private maxTicks: number;

  player: PlayerState;
  lanterns: LanternState[];
  motes: MoteState[];
  shades: ShadeState[];
  drifters: DrifterState[];
  charms: CharmState[];
  wind: WindState;
  wanderingGirl: WanderingGirlState;
  creativeBuffs: CreativeBuffs = {
    powerTimer: 0,
    speedTimer: 0,
    lastNotice: null,
  };

  private randomMotesEnabled: boolean;
  private randomShadesEnabled: boolean;
  private randomDriftersEnabled: boolean;
  private nextMoteNum = 1;
  private nextShadeNum = 1;
  private nextDrifterNum = 1;

  constructor(
    seed: number,
    night: 1 | 2 | 3 = 1,
    scenario: ScenarioData = {},
    options: SimOptions = {}
  ) {
    this.seed = seed | 0;
    this.night = night;
    this.map = getNightMap(night);
    this.creative = Boolean(options.creative);
    this.prng = new Mulberry32(this.seed ^ (night * 0x9e3779b9));

    this.initialTimeLeftS = scenario.time_left_s ?? this.map.durationS;
    this.timeLeftS = this.initialTimeLeftS;
    this.maxTicks = Math.round(this.initialTimeLeftS * TICK_RATE);

    const pPos: Vec3 = scenario.player?.pos
      ? [scenario.player.pos[0], scenario.player.pos[1], scenario.player.pos[2]]
      : [0, 0, 0];

    const startGroundY = getReachableGroundY(this.map, pPos[0], pPos[2], pPos[1]);
    const grounded = startGroundY > -Infinity && Math.abs(pPos[1] - startGroundY) <= 0.05;

    this.player = {
      pos: pPos,
      vel: [0, 0, 0],
      grounded,
      flames: scenario.player?.flames ?? TUNING.flames,
      carried: scenario.player?.carried ?? 0,
      facing: [0, 0], // updated cleanly below -> +Z default
      invulnTicks: scenario.player?.invuln_ticks ?? 0,
      dashTicksLeft: 0,
      dashCdTicks: scenario.player?.dash_cd_ticks ?? 0,
      dashDir: [0, 1],
      pulseCdTicks: scenario.player?.pulse_cd_ticks ?? 0,
      charmTicks: scenario.player?.charm_ticks ?? 0,
      respawnWaitTicks: 0,
      launchActive: false,
      launchVel: [0, 0],
    };
    this.player.facing = [0, 1];

    // Lanterns
    this.lanterns = this.map.lanterns.map((def) => ({
      id: def.id,
      name: def.name,
      pos: [def.pos[0], def.pos[1], def.pos[2]],
      lit: false,
      deposited: 0,
    }));

    if (scenario.lanterns) {
      for (const patch of scenario.lanterns) {
        const target = this.lanterns.find((l) => l.id === patch.id);
        if (!target) continue;
        if (patch.pos) {
          target.pos = [patch.pos[0], patch.pos[1], patch.pos[2]];
        }
        if (patch.deposited !== undefined) {
          target.deposited = patch.deposited;
        }
        if (patch.lit !== undefined) {
          target.lit = patch.lit;
          if (patch.lit && patch.deposited === undefined) {
            target.deposited = TUNING.lantern_cost;
          }
        }
      }
    }

    this.randomMotesEnabled = scenario.random_motes ?? true;
    this.randomShadesEnabled = scenario.random_shades ?? true;
    this.randomDriftersEnabled = scenario.random_drifters ?? (night >= 2);

    this.wind = {
      enabled: scenario.wind_enabled ?? this.map.windEnabled,
      active: false,
      telegraph: false,
      dirDeg: 0,
      ticksLeft: 0,
    };

    // Motes: 20 initial at 20 distinct spawn points unless overridden
    this.motes = [];
    if (scenario.motes !== undefined) {
      for (const entry of scenario.motes) {
        const pos: Vec3 = Array.isArray(entry)
          ? [entry[0], entry[1], entry[2]]
          : [entry.pos[0], entry.pos[1], entry.pos[2]];
        const id = !Array.isArray(entry) && entry.id ? entry.id : this.allocMoteId();
        this.syncMoteIdCounter(id);
        const kind = !Array.isArray(entry) && entry.kind ? entry.kind : 'random';
        const ttlTicks =
          !Array.isArray(entry) && entry.ttl_s !== undefined
            ? Math.round(entry.ttl_s * TICK_RATE)
            : kind === 'dropped'
              ? DROPPED_MOTE_TTL_TICKS
              : null;
        this.motes.push({
          id,
          pos,
          color: this.creative ? pickCreativeMoteColor(this.prng) : 'gold',
          kind,
          ttlTicks,
          justSpawned: false,
        });
      }
    } else if (this.randomMotesEnabled) {
      const indices = this.map.moteSpawns.map((_, idx) => idx);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = this.prng.int(0, i);
        const tmp = indices[i];
        indices[i] = indices[j];
        indices[j] = tmp;
      }
      const count = Math.min(INITIAL_RANDOM_MOTES, indices.length);
      for (let i = 0; i < count; i++) {
        const pt = this.map.moteSpawns[indices[i]];
        this.motes.push({
          id: this.allocMoteId(),
          pos: [pt[0], pt[1], pt[2]],
          color: this.creative ? pickCreativeMoteColor(this.prng) : 'gold',
          kind: 'random',
          ttlTicks: null,
          justSpawned: false,
        });
      }
    }

    // Shades: empty at tick 0 unless scenario provides them (first scheduled spawn is tick 300)
    this.shades = [];
    if (scenario.shades !== undefined) {
      for (const entry of scenario.shades) {
        const id = entry.id ?? this.allocShadeId();
        this.syncShadeIdCounter(id);
        const st = entry.state ?? 'chase';
        const ticksLeft =
          entry.state_ticks_left ??
          (st === 'stunned' ? PULSE_STUN_TICKS : st === 'recoil' ? RECOIL_TICKS : 0);
        this.shades.push({
          id,
          pos: [entry.pos[0], entry.pos[1], entry.pos[2]],
          state: st,
          stateTicksLeft: ticksLeft,
          pushTicksLeft: 0,
          pushStep: [0, 0],
          recoilDir: [1, 0],
          safePushTicks: 0,
          wanderAngle: this.prng.range(0, Math.PI * 2),
          justSpawned: false,
          variant: this.creative ? pickCreativeShadeVariant(this.prng) : 'standard',
        });
      }
    }

    // Drifters: empty at tick 0 unless scenario provides them (first scheduled spawn is tick 1200)
    this.drifters = [];
    if (scenario.drifters !== undefined) {
      for (const entry of scenario.drifters) {
        const id = entry.id ?? this.allocDrifterId();
        this.syncDrifterIdCounter(id);
        const stolen = entry.stolen ?? 0;
        const st = entry.state ?? 'idle';
        this.drifters.push({
          id,
          pos: [entry.pos[0], entry.pos[1], entry.pos[2]],
          state: st,
          stolen,
          hasStolen: stolen > 0 || st === 'flee',
          fleeTicksLeft: st === 'flee' ? DRIFTER_FLEE_TICKS : 0,
          wanderAngle: this.prng.range(0, Math.PI * 2),
          justSpawned: false,
        });
      }
    }

    // Charms
    this.charms = this.map.charms.map((c) => ({
      id: c.id,
      pos: [c.pos[0], c.pos[1], c.pos[2]],
      available: true,
      respawnTicks: 0,
    }));
    if (scenario.charms !== undefined) {
      this.charms = scenario.charms.map((c) => ({
        id: c.id,
        pos: c.pos ? [c.pos[0], c.pos[1], c.pos[2]] : [0, 0, 0],
        available: c.available ?? true,
        respawnTicks: c.respawn_s !== undefined ? Math.round(c.respawn_s * TICK_RATE) : 0,
      }));
    }

    this.wanderingGirl = createWanderingGirl(this.creative, this.night, this.prng);
  }

  private allocMoteId(): string {
    const id = `M${this.nextMoteNum}`;
    this.nextMoteNum++;
    return id;
  }

  private syncMoteIdCounter(id: string): void {
    const match = /^M(\d+)$/.exec(id);
    if (match) {
      const num = Number(match[1]);
      if (num >= this.nextMoteNum) this.nextMoteNum = num + 1;
    }
  }

  private allocShadeId(): string {
    const id = `S${this.nextShadeNum}`;
    this.nextShadeNum++;
    return id;
  }

  private syncShadeIdCounter(id: string): void {
    const match = /^S(\d+)$/.exec(id);
    if (match) {
      const num = Number(match[1]);
      if (num >= this.nextShadeNum) this.nextShadeNum = num + 1;
    }
  }

  private allocDrifterId(): string {
    const id = `D${this.nextDrifterNum}`;
    this.nextDrifterNum++;
    return id;
  }

  private syncDrifterIdCounter(id: string): void {
    const match = /^D(\d+)$/.exec(id);
    if (match) {
      const num = Number(match[1]);
      if (num >= this.nextDrifterNum) this.nextDrifterNum = num + 1;
    }
  }

  step(input: StepInput): SimEvent[] {
    if (this.state === 'won' || this.state === 'lost') {
      return [];
    }

    const events: SimEvent[] = [];

    // 1. Read input (handle pause first; if paused, stop step immediately)
    this.tick += 1;
    if (input.pausePressed) {
      if (this.state === 'playing') {
        this.state = 'paused';
        events.push({ type: 'event', tick: this.tick, name: 'paused', data: {} });
        return events;
      } else if (this.state === 'paused') {
        this.state = 'playing';
        events.push({ type: 'event', tick: this.tick, name: 'resumed', data: {} });
      }
    }

    if (this.state === 'paused') {
      return events;
    }

    // 2. Decrement timers, cooldowns, invuln, stun, charm, dropped TTL, charm respawn, wind
    this.simTick += 1;
    this.timeLeftS = Math.max(0, this.initialTimeLeftS - this.simTick / TICK_RATE);

    if (this.player.dashTicksLeft > 0) this.player.dashTicksLeft--;
    if (this.player.dashCdTicks > 0) this.player.dashCdTicks--;
    if (this.player.pulseCdTicks > 0) this.player.pulseCdTicks--;
    if (this.player.invulnTicks > 0) this.player.invulnTicks--;
    if (this.player.charmTicks > 0) this.player.charmTicks--;

    if (this.creative) {
      this.creativeBuffs.powerTimer = Math.max(0, this.creativeBuffs.powerTimer - DT);
      this.creativeBuffs.speedTimer = Math.max(0, this.creativeBuffs.speedTimer - DT);
    }

    if (this.player.respawnWaitTicks > 0) {
      this.player.respawnWaitTicks--;
      if (this.player.respawnWaitTicks === 0) {
        this.player.pos = [0, 0, 0];
        this.player.vel = [0, 0, 0];
        this.player.grounded = true;
        this.player.invulnTicks = INVULN_TICKS;
        this.player.dashTicksLeft = 0;
        this.player.launchActive = false;
      }
    }

    for (const shade of this.shades) {
      shade.justSpawned = false;
      if (shade.safePushTicks > 0) shade.safePushTicks--;
      if (shade.stateTicksLeft > 0) {
        shade.stateTicksLeft--;
        if (shade.stateTicksLeft === 0) {
          if (shade.state === 'stunned' || shade.state === 'recoil' || shade.state === 'spawning') {
            shade.state = 'wander';
            shade.pushTicksLeft = 0;
          }
        }
      }
    }

    for (const drifter of this.drifters) {
      drifter.justSpawned = false;
    }

    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      m.justSpawned = false;
      if (m.ttlTicks !== null) {
        m.ttlTicks--;
        if (m.ttlTicks <= 0) {
          this.motes.splice(i, 1);
          i--;
        }
      }
    }

    for (const charm of this.charms) {
      if (!charm.available && charm.respawnTicks > 0) {
        charm.respawnTicks--;
        if (charm.respawnTicks === 0) {
          charm.available = true;
        }
      }
    }

    if (this.wind.enabled) {
      if (this.simTick > 0 && this.simTick % WIND_CYCLE_TICKS === 0) {
        this.wind.active = true;
        this.wind.telegraph = false;
        this.wind.ticksLeft = WIND_DURATION_TICKS;
        this.wind.dirDeg = round3(this.prng.range(0, 360));
      } else if (this.wind.ticksLeft > 0) {
        this.wind.ticksLeft--;
        if (this.wind.ticksLeft === 0) {
          this.wind.active = false;
        }
      }
      this.wind.telegraph =
        !this.wind.active && this.simTick % WIND_CYCLE_TICKS >= WIND_CYCLE_TICKS - WIND_TELEGRAPH_TICKS;
    }

    // 3. Move player (jump, dash, jump pads, wind) & check fall
    const isRespawning = this.player.respawnWaitTicks > 0;
    if (!isRespawning) {
      const [wx, wz] = transformMoveToWorld(input.move, input.camYawDeg);
      const moveLen = Math.hypot(wx, wz);
      if (moveLen > 1e-6) {
        this.player.facing = [wx / moveLen, wz / moveLen];
      }

      if (input.dashPressed && this.player.dashCdTicks === 0 && this.player.dashTicksLeft === 0) {
        this.player.dashTicksLeft = DASH_DURATION_TICKS;
        this.player.dashCdTicks = this.player.charmTicks > 0 ? 0 : DASH_COOLDOWN_TICKS;
        this.player.dashDir =
          moveLen > 1e-6 ? [wx / moveLen, wz / moveLen] : [this.player.facing[0], this.player.facing[1]];
        this.player.vel[1] = 0;
        this.player.launchActive = false;
        events.push({ type: 'event', tick: this.tick, name: 'dash', data: {} });
      }

      let vx = 0;
      let vz = 0;
      if (this.player.dashTicksLeft > 0) {
        vx = this.player.dashDir[0] * TUNING.dash_speed;
        vz = this.player.dashDir[1] * TUNING.dash_speed;
        this.player.vel[1] = 0;
      } else if (this.player.launchActive) {
        vx = this.player.launchVel[0];
        vz = this.player.launchVel[1];
      } else {
        const baseSpeed = this.player.charmTicks > 0 ? CHARM_SPEED : TUNING.player_speed;
        const creativeSpeedMult =
          this.creative && this.creativeBuffs.speedTimer > 0 ? 1.35 : 1.0;
        const speed = baseSpeed * creativeSpeedMult;
        vx = wx * speed;
        vz = wz * speed;
      }

      if (this.player.dashTicksLeft === 0 && input.jumpPressed && this.player.grounded) {
        this.player.vel[1] = JUMP_VELOCITY;
        this.player.grounded = false;
      }

      if (this.wind.active) {
        const windRad = (this.wind.dirDeg * Math.PI) / 180;
        vx += Math.cos(windRad) * WIND_PUSH_SPEED;
        vz += Math.sin(windRad) * WIND_PUSH_SPEED;
      }

      this.player.vel[0] = vx;
      this.player.vel[2] = vz;

      const nextX = this.player.pos[0] + vx * DT;
      const nextZ = this.player.pos[2] + vz * DT;
      const [rx, rz] = resolveHorizontalObstacles(
        this.map,
        this.player.pos[0],
        this.player.pos[2],
        nextX,
        nextZ,
        this.player.pos[1]
      );
      this.player.pos[0] = rx;
      this.player.pos[2] = rz;

      // Vertical physics (dash mid-air holds current Y)
      if (this.player.dashTicksLeft === 0) {
        if (!this.player.grounded) {
          this.player.vel[1] -= GRAVITY * DT;
          const nextY = this.player.pos[1] + this.player.vel[1] * DT;
          const groundY = getReachableGroundY(this.map, this.player.pos[0], this.player.pos[2], this.player.pos[1]);
          if (groundY > -Infinity && nextY <= groundY + EPS && this.player.vel[1] <= 0) {
            this.player.pos[1] = groundY;
            this.player.vel[1] = 0;
            this.player.grounded = true;
            this.player.launchActive = false;
          } else {
            this.player.pos[1] = nextY;
            this.player.grounded = false;
          }
        } else {
          const groundY = getReachableGroundY(this.map, this.player.pos[0], this.player.pos[2], this.player.pos[1]);
          if (groundY === -Infinity || this.player.pos[1] > groundY + 0.55) {
            this.player.grounded = false;
          } else {
            this.player.pos[1] = groundY;
          }
        }
      }

      // Jump pads
      for (const pad of this.map.jumpPads) {
        if (
          distXZ(this.player.pos, pad.pos) <= pad.radius + EPS &&
          Math.abs(this.player.pos[1] - pad.pos[1]) <= 0.35
        ) {
          this.player.vel[1] = pad.vy;
          this.player.grounded = false;
          this.player.dashTicksLeft = 0;
          this.player.launchActive = true;
          this.player.launchVel = [pad.dir[0] * pad.vh, pad.dir[1] * pad.vh];
          this.player.vel[0] = this.player.launchVel[0];
          this.player.vel[2] = this.player.launchVel[1];
          break;
        }
      }

      // Fall check (Y < -10): ignores invuln, loses all carried, waits 60 ticks then respawns
      if (TUNING.fall_enabled && this.player.pos[1] < -10) {
        this.player.flames = Math.max(0, this.player.flames - 1);
        const lost = this.player.carried;
        this.player.carried = 0;
        this.player.vel = [0, 0, 0];
        this.player.dashTicksLeft = 0;
        this.player.launchActive = false;
        this.player.respawnWaitTicks = this.player.flames > 0 ? RESPAWN_WAIT_TICKS : 0;
        events.push({
          type: 'event',
          tick: this.tick,
          name: 'player_hit',
          data: {
            by: 'fall',
            flames: this.player.flames,
            dropped: 0,
            lost,
          },
        });
      }
    }

    // 4. Pick up motes and charms (only if not waiting to respawn)
    if (this.player.respawnWaitTicks === 0) {
      if (this.player.carried < TUNING.carry_capacity) {
        for (let i = 0; i < this.motes.length; i++) {
          if (this.player.carried >= TUNING.carry_capacity) break;
          const mote = this.motes[i];
          if (mote.justSpawned) continue;
          if (
            distXZ(this.player.pos, mote.pos) <= TUNING.pickup_radius + EPS &&
            Math.abs(this.player.pos[1] - mote.pos[1]) <= 1.5 + EPS
          ) {
            this.motes.splice(i, 1);
            i--;
            this.player.carried += 1;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'mote_picked',
              data: { carried: this.player.carried },
            });
            if (this.creative) {
              applyCreativeMoteBuff(mote.color, this.player, this.creativeBuffs);
            }
          }
        }
      }

      for (const charm of this.charms) {
        if (!charm.available) continue;
        if (
          distXZ(this.player.pos, charm.pos) <= TUNING.pickup_radius + EPS &&
          Math.abs(this.player.pos[1] - charm.pos[1]) <= 1.5 + EPS
        ) {
          charm.available = false;
          charm.respawnTicks = CHARM_RESPAWN_TICKS;
          this.player.charmTicks = CHARM_DURATION_TICKS;
          this.player.dashCdTicks = 0;
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'charm_picked',
            data: { charm_id: charm.id, charm_ticks: CHARM_DURATION_TICKS },
          });
        }
      }

      if (this.creative) {
        stepWanderingGirl(this.wanderingGirl, this.player, this.creativeBuffs, DT);
      }
    }

    // 5. Interact with lanterns
    if (this.player.respawnWaitTicks === 0 && input.interactPressed && this.player.carried > 0) {
      let bestLantern: LanternState | null = null;
      let bestDist = Infinity;

      for (const lantern of this.lanterns) {
        if (lantern.lit) continue;
        const d = distXZ(this.player.pos, lantern.pos);
        if (
          d <= TUNING.interact_radius + EPS &&
          Math.abs(this.player.pos[1] - lantern.pos[1]) <= 2.5
        ) {
          if (
            d < bestDist - 1e-9 ||
            (Math.abs(d - bestDist) <= 1e-9 &&
              bestLantern !== null &&
              lantern.id < bestLantern.id)
          ) {
            bestDist = d;
            bestLantern = lantern;
          }
        }
      }

      if (bestLantern !== null) {
        const need = Math.max(0, TUNING.lantern_cost - bestLantern.deposited);
        const amount = Math.min(this.player.carried, need);
        if (amount > 0) {
          this.player.carried -= amount;
          bestLantern.deposited += amount;
          this.score += amount * TUNING.score.per_mote;
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'deposit',
            data: {
              lantern_id: bestLantern.id,
              amount,
              deposited: bestLantern.deposited,
            },
          });

          if (bestLantern.deposited >= TUNING.lantern_cost) {
            bestLantern.lit = true;
            this.score += TUNING.score.per_lantern;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'lantern_lit',
              data: { lantern_id: bestLantern.id },
            });
          }
        }
      }
    }

    // 6. Update lit lantern safe zones (push shades out within <= 30 ticks)
    const litLanterns = this.lanterns.filter((l) => l.lit);
    for (const shade of this.shades) {
      if (shade.justSpawned) continue;
      let insideSafe = false;
      for (const lantern of litLanterns) {
        const d = distXZ(shade.pos, lantern.pos);
        if (d < TUNING.safe_radius - EPS) {
          insideSafe = true;
          if (shade.safePushTicks === 0) {
            shade.safePushTicks = 30;
          }
          let dx = shade.pos[0] - lantern.pos[0];
          let dz = shade.pos[2] - lantern.pos[2];
          if (d > 1e-6) {
            dx /= d;
            dz /= d;
          } else {
            dx = 1;
            dz = 0;
          }
          const remainingTicks = Math.max(1, shade.safePushTicks);
          const distOut = TUNING.safe_radius + 0.02 - d;
          const pushStep = Math.max(distOut / remainingTicks, this.map.shadeSpeed * DT);
          const nx = shade.pos[0] + dx * Math.min(distOut, pushStep);
          const nz = shade.pos[2] + dz * Math.min(distOut, pushStep);
          const [rx, rz] = resolveHorizontalObstacles(this.map, shade.pos[0], shade.pos[2], nx, nz, shade.pos[1]);
          shade.pos[0] = rx;
          shade.pos[2] = rz;
        }
      }
      if (!insideSafe) {
        shade.safePushTicks = 0;
      }
    }

    // 7. Pulse (Tỏa Sáng)
    if (
      this.player.respawnWaitTicks === 0 &&
      input.pulsePressed &&
      this.player.carried >= TUNING.pulse_cost &&
      this.player.pulseCdTicks === 0
    ) {
      const powerMult =
        this.creative && this.creativeBuffs.powerTimer > 0 ? 1.4 : 1.0;
      const effectiveRadius = TUNING.pulse_radius * powerMult;
      const effectiveStunTicks = Math.round(PULSE_STUN_TICKS * powerMult);

      this.player.carried -= TUNING.pulse_cost;
      this.player.pulseCdTicks = PULSE_COOLDOWN_TICKS;

      const pulseCenter: Vec3 = [
        this.player.pos[0],
        this.player.pos[1] + 0.8,
        this.player.pos[2],
      ];

      const stunnedIds: string[] = [];
      for (const shade of this.shades) {
        if (shade.justSpawned) continue;
        if (dist3D(pulseCenter, shade.pos) <= effectiveRadius + EPS) {
          let dx = shade.pos[0] - this.player.pos[0];
          let dz = shade.pos[2] - this.player.pos[2];
          const d = Math.hypot(dx, dz);
          if (d > 1e-6) {
            dx /= d;
            dz /= d;
          } else {
            dx = 1;
            dz = 0;
          }
          const pushScale = this.creative
            ? shade.variant === 'large'
              ? 0.7
              : shade.variant === 'small'
                ? 1.2
                : 1.0
            : 1.0;
          const stepDist = (TUNING.pulse_push_m * pushScale) / PULSE_PUSH_TICKS;
          shade.state = 'stunned';
          shade.stateTicksLeft = effectiveStunTicks;
          shade.pushTicksLeft = PULSE_PUSH_TICKS;
          shade.pushStep = [dx * stepDist, dz * stepDist];
          stunnedIds.push(shade.id);
        }
      }

      this.score += stunnedIds.length * TUNING.score.per_stun;
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'pulse',
        data: { stunned_ids: stunnedIds },
      });

      // Drifters vs Pulse
      for (const drifter of this.drifters) {
        if (drifter.justSpawned || drifter.state === 'removed') continue;
        if (dist3D(pulseCenter, drifter.pos) <= effectiveRadius + EPS) {
          if (drifter.state === 'chase') {
            drifter.state = 'flee';
            drifter.hasStolen = true;
            drifter.fleeTicksLeft = DRIFTER_FLEE_TICKS;
          } else if (drifter.state === 'flee' && drifter.stolen > 0) {
            const amount = drifter.stolen;
            const dropY = getGroundHeightAt(this.map, drifter.pos[0], drifter.pos[2]);
            const yPos = dropY > -Infinity ? dropY : Math.max(0, drifter.pos[1]);
            for (let k = 0; k < amount; k++) {
              const angle = (k * Math.PI * 2) / Math.max(1, amount);
              const mx = drifter.pos[0] + Math.cos(angle) * 0.4;
              const mz = drifter.pos[2] + Math.sin(angle) * 0.4;
              const my = isOnWalkableGround(this.map, mx, mz)
                ? getGroundHeightAt(this.map, mx, mz)
                : yPos;
              this.motes.push({
                id: this.allocMoteId(),
                pos: [mx, my, mz],
                color: 'gold',
                kind: 'dropped',
                ttlTicks: DROPPED_MOTE_TTL_TICKS,
                justSpawned: true,
              });
            }
            drifter.stolen = 0;
            drifter.fleeTicksLeft = DRIFTER_DROP_FLEE_TICKS;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'drifter_drop',
              data: { drifter_id: drifter.id, amount },
            });
          }
        }
      }
    }

    // 8. Move Shades and Drifters
    const playerAvailable = this.player.respawnWaitTicks === 0;
    for (const shade of this.shades) {
      if (shade.justSpawned) continue;

      if (shade.state === 'stunned') {
        if (shade.pushTicksLeft > 0) {
          shade.pushTicksLeft--;
          const nx = shade.pos[0] + shade.pushStep[0];
          const nz = shade.pos[2] + shade.pushStep[1];
          const [rx, rz, blocked] = resolveHorizontalObstacles(
            this.map,
            shade.pos[0],
            shade.pos[2],
            nx,
            nz,
            shade.pos[1]
          );
          if (blocked || !isOnWalkableGround(this.map, rx, rz)) {
            shade.pushTicksLeft = 0;
          } else {
            shade.pos[0] = rx;
            shade.pos[2] = rz;
            this.projectOutsideLitSafeZones(shade.pos);
          }
        }
        continue;
      }

      if (shade.state === 'recoil') {
        const stepDist = RECOIL_DIST_M / RECOIL_TICKS;
        const nx = shade.pos[0] + shade.recoilDir[0] * stepDist;
        const nz = shade.pos[2] + shade.recoilDir[1] * stepDist;
        const [rx, rz] = resolveHorizontalObstacles(
          this.map,
          shade.pos[0],
          shade.pos[2],
          nx,
          nz,
          shade.pos[1]
        );
        if (isOnWalkableGround(this.map, rx, rz)) {
          shade.pos[0] = rx;
          shade.pos[2] = rz;
          this.projectOutsideLitSafeZones(shade.pos);
        }
        continue;
      }

      if (shade.state === 'spawning') {
        continue;
      }

      const dToPlayer = distXZ(this.player.pos, shade.pos);
      if (shade.state === 'wander') {
        if (playerAvailable && dToPlayer <= SHADE_DETECT_RADIUS + EPS) {
          shade.state = 'chase';
        }
      } else if (shade.state === 'chase') {
        if (!playerAvailable || dToPlayer > SHADE_LOSE_RADIUS + EPS) {
          shade.state = 'wander';
        }
      }

      const variantScale = this.creative
        ? shade.variant === 'large'
          ? 0.82
          : shade.variant === 'small'
            ? 1.15
            : 1.0
        : 1.0;
      const moveSpeed = this.map.shadeSpeed * variantScale;

      if (shade.state === 'chase') {
        const dx = this.player.pos[0] - shade.pos[0];
        const dz = this.player.pos[2] - shade.pos[2];
        const d = Math.hypot(dx, dz);
        if (d > 1e-6) {
          const stepLen = Math.min(d, moveSpeed * DT);
          const nx = shade.pos[0] + (dx / d) * stepLen;
          const nz = shade.pos[2] + (dz / d) * stepLen;
          const [rx, rz] = resolveHorizontalObstacles(
            this.map,
            shade.pos[0],
            shade.pos[2],
            nx,
            nz,
            shade.pos[1]
          );
          if (isOnWalkableGround(this.map, rx, rz)) {
            shade.pos[0] = rx;
            shade.pos[2] = rz;
            const gy = getReachableGroundY(this.map, rx, rz, shade.pos[1]);
            if (gy > -Infinity) shade.pos[1] = gy;
          }
          this.projectOutsideLitSafeZones(shade.pos);
        }
      } else {
        // wander
        const wSpeed = moveSpeed * 0.45;
        shade.wanderAngle += 0.015;
        const nx = shade.pos[0] + Math.cos(shade.wanderAngle) * wSpeed * DT;
        const nz = shade.pos[2] + Math.sin(shade.wanderAngle) * wSpeed * DT;
        const [rx, rz] = resolveHorizontalObstacles(
          this.map,
          shade.pos[0],
          shade.pos[2],
          nx,
          nz,
          shade.pos[1]
        );
        if (isOnWalkableGround(this.map, rx, rz)) {
          shade.pos[0] = rx;
          shade.pos[2] = rz;
          this.projectOutsideLitSafeZones(shade.pos);
        } else {
          shade.wanderAngle += Math.PI * 0.75;
        }
      }
    }

    // Move Drifters
    for (let i = 0; i < this.drifters.length; i++) {
      const drifter = this.drifters[i];
      if (drifter.justSpawned) continue;

      if (drifter.state === 'idle') {
        if (
          playerAvailable &&
          !drifter.hasStolen &&
          this.player.carried >= 5 &&
          distXZ(this.player.pos, drifter.pos) <= DRIFTER_DETECT_RADIUS + EPS
        ) {
          drifter.state = 'chase';
        }
      } else if (drifter.state === 'chase') {
        if (
          !playerAvailable ||
          drifter.hasStolen ||
          this.player.carried < 5 ||
          distXZ(this.player.pos, drifter.pos) > DRIFTER_DETECT_RADIUS + EPS
        ) {
          drifter.state = 'idle';
        }
      }

      if (drifter.state === 'idle') {
        drifter.wanderAngle += 0.03;
        drifter.pos[0] += Math.cos(drifter.wanderAngle) * DRIFTER_IDLE_SPEED * DT;
        drifter.pos[2] += Math.sin(drifter.wanderAngle) * DRIFTER_IDLE_SPEED * DT;
      } else if (drifter.state === 'chase') {
        const dx = this.player.pos[0] - drifter.pos[0];
        const dz = this.player.pos[2] - drifter.pos[2];
        const d = Math.hypot(dx, dz);
        if (d > 1e-6) {
          const stepLen = Math.min(d, DRIFTER_CHASE_SPEED * DT);
          drifter.pos[0] += (dx / d) * stepLen;
          drifter.pos[2] += (dz / d) * stepLen;
        }
      } else if (drifter.state === 'flee') {
        let dx = drifter.pos[0] - this.player.pos[0];
        let dz = drifter.pos[2] - this.player.pos[2];
        const d = Math.hypot(dx, dz);
        if (d > 1e-6) {
          dx /= d;
          dz /= d;
        } else {
          dx = 1;
          dz = 0;
        }
        drifter.pos[0] += dx * DRIFTER_CHASE_SPEED * DT;
        drifter.pos[2] += dz * DRIFTER_CHASE_SPEED * DT;
        drifter.fleeTicksLeft--;
        if (drifter.fleeTicksLeft <= 0) {
          drifter.state = 'removed';
          this.drifters.splice(i, 1);
          i--;
        }
      }
    }

    // 9. Collisions: Drifters steal first, then Shades hit (by ascending id)
    if (this.player.respawnWaitTicks === 0) {
      const sortedDrifters = [...this.drifters].sort((a, b) => a.id.localeCompare(b.id));
      for (const drifter of sortedDrifters) {
        if (
          drifter.justSpawned ||
          drifter.state !== 'chase' ||
          drifter.hasStolen
        ) {
          continue;
        }
        if (distXZ(this.player.pos, drifter.pos) <= DRIFTER_STEAL_RADIUS + EPS) {
          const amount = Math.min(3, this.player.carried);
          this.player.carried -= amount;
          drifter.stolen = amount;
          drifter.hasStolen = true;
          drifter.state = 'flee';
          drifter.fleeTicksLeft = DRIFTER_FLEE_TICKS;
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'drifter_steal',
            data: {
              drifter_id: drifter.id,
              amount,
              carried: this.player.carried,
            },
          });
        }
      }

      if (this.player.invulnTicks === 0) {
        const sortedShades = [...this.shades].sort((a, b) => a.id.localeCompare(b.id));
        for (const shade of sortedShades) {
          if (
            shade.justSpawned ||
            shade.safePushTicks > 0 ||
            (shade.state !== 'wander' && shade.state !== 'chase')
          ) {
            continue;
          }
          const hitRadius =
            TUNING.shade_hit_radius *
            (this.creative && shade.variant === 'large' ? 1.25 : 1.0);
          if (
            distXZ(this.player.pos, shade.pos) <= hitRadius + EPS &&
            Math.abs(this.player.pos[1] - shade.pos[1]) <= 1.5 + EPS
          ) {
            this.player.flames = Math.max(0, this.player.flames - 1);
            const dropped = Math.floor(this.player.carried * TUNING.hit_drop_ratio);
            this.player.carried = Math.max(0, this.player.carried - dropped);
            this.player.invulnTicks = INVULN_TICKS;

            // Spawn dropped motes in 1.5-2.5m ring around Mây
            for (let k = 0; k < dropped; k++) {
              const angle = this.prng.range(0, Math.PI * 2);
              const rad = this.prng.range(1.5, 2.5);
              let mx = this.player.pos[0] + Math.cos(angle) * rad;
              let mz = this.player.pos[2] + Math.sin(angle) * rad;
              if (!isOnWalkableGround(this.map, mx, mz)) {
                mx = this.player.pos[0];
                mz = this.player.pos[2];
              }
              const my = getGroundHeightAt(this.map, mx, mz);
              this.motes.push({
                id: this.allocMoteId(),
                pos: [mx, my > -Infinity ? my : Math.max(0, this.player.pos[1]), mz],
                color: 'gold',
                kind: 'dropped',
                ttlTicks: DROPPED_MOTE_TTL_TICKS,
                justSpawned: true,
              });
            }

            let dx = shade.pos[0] - this.player.pos[0];
            let dz = shade.pos[2] - this.player.pos[2];
            const d = Math.hypot(dx, dz);
            if (d > 1e-6) {
              dx /= d;
              dz /= d;
            } else {
              dx = 1;
              dz = 0;
            }
            shade.state = 'recoil';
            shade.stateTicksLeft = RECOIL_TICKS;
            shade.recoilDir = [dx, dz];

            events.push({
              type: 'event',
              tick: this.tick,
              name: 'player_hit',
              data: {
                by: 'shade',
                flames: this.player.flames,
                dropped,
              },
            });
            break;
          }
        }
      }
    }

    // 10. Scheduled spawns (newly spawned entities interact starting next tick)
    if (
      this.randomMotesEnabled &&
      this.simTick > 0 &&
      this.simTick % MOTE_RESPAWN_TICKS === 0 &&
      this.motes.length < MAX_MOTES
    ) {
      const emptyPoints = this.map.moteSpawns.filter(
        (pt) => !this.motes.some((m) => distXZ(m.pos, pt) < 0.5 && Math.abs(m.pos[1] - pt[1]) < 0.5)
      );
      if (emptyPoints.length > 0) {
        const pt = emptyPoints[this.prng.int(0, emptyPoints.length - 1)];
        this.motes.push({
          id: this.allocMoteId(),
          pos: [pt[0], pt[1], pt[2]],
          color: this.creative ? pickCreativeMoteColor(this.prng) : 'gold',
          kind: 'random',
          ttlTicks: null,
          justSpawned: true,
        });
      }
    }

    if (this.randomShadesEnabled && this.simTick >= 300) {
      let toSpawn = 0;
      if (this.simTick === 300) {
        toSpawn = 2;
      } else if ((this.simTick - 300) % this.map.shadeIntervalTicks === 0) {
        toSpawn = 1;
      }

      for (let s = 0; s < toSpawn; s++) {
        if (this.shades.length >= this.map.maxShades) break;
        const validPoints = this.map.shadeSpawns.filter((pt) => {
          if (distXZ(pt, this.player.pos) < 15.0) return false;
          if (litLanterns.some((l) => distXZ(pt, l.pos) <= TUNING.safe_radius + 0.5)) return false;
          if (this.shades.some((sh) => distXZ(pt, sh.pos) < 1.0)) return false;
          return true;
        });
        if (validPoints.length === 0) break;
        const pt = validPoints[this.prng.int(0, validPoints.length - 1)];
        const id = this.allocShadeId();
        this.shades.push({
          id,
          pos: [pt[0], pt[1], pt[2]],
          state: 'spawning',
          stateTicksLeft: 1,
          pushTicksLeft: 0,
          pushStep: [0, 0],
          recoilDir: [1, 0],
          safePushTicks: 0,
          wanderAngle: this.prng.range(0, Math.PI * 2),
          justSpawned: true,
          variant: this.creative ? pickCreativeShadeVariant(this.prng) : 'standard',
        });
        events.push({
          type: 'event',
          tick: this.tick,
          name: 'shade_spawned',
          data: { id },
        });
      }
    }

    if (
      this.randomDriftersEnabled &&
      this.map.maxDrifters > 0 &&
      this.simTick > 0 &&
      this.simTick % DRIFTER_SPAWN_INTERVAL_TICKS === 0 &&
      this.drifters.length < this.map.maxDrifters
    ) {
      const pt = this.map.shadeSpawns[this.prng.int(0, this.map.shadeSpawns.length - 1)];
      this.drifters.push({
        id: this.allocDrifterId(),
        pos: [pt[0], pt[1] + 1.0, pt[2]],
        state: 'idle',
        stolen: 0,
        hasStolen: false,
        fleeTicksLeft: 0,
        wanderAngle: this.prng.range(0, Math.PI * 2),
        justSpawned: true,
      });
    }

    // 11. Win/Loss evaluation (no_flames > all_lit > dawn)
    if (this.player.flames <= 0) {
      this.state = 'lost';
      this.winOrLoseReason = 'no_flames';
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'game_over',
        data: { result: 'lost', reason: 'no_flames' },
      });
      return events;
    }

    if (this.lanterns.every((l) => l.lit)) {
      const timeBonus = Math.floor(this.timeLeftS) * TUNING.score.per_second_left;
      const flameBonus = this.player.flames * TUNING.score.per_flame_left;
      this.score += timeBonus + flameBonus;
      this.state = 'won';
      this.winOrLoseReason = 'all_lit';
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'game_over',
        data: { result: 'won', reason: 'all_lit' },
      });
      return events;
    }

    if (this.simTick >= this.maxTicks) {
      this.state = 'lost';
      this.winOrLoseReason = 'dawn';
      this.timeLeftS = 0;
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'game_over',
        data: { result: 'lost', reason: 'dawn' },
      });
      return events;
    }

    return events;
  }

  private projectOutsideLitSafeZones(pos: Vec3): void {
    const litLanterns = this.lanterns.filter((l) => l.lit);
    if (litLanterns.length === 0) return;

    const minSafe = TUNING.safe_radius + 0.01;
    for (let pass = 0; pass < 3; pass++) {
      let adjusted = false;
      for (const lantern of litLanterns) {
        let dx = pos[0] - lantern.pos[0];
        let dz = pos[2] - lantern.pos[2];
        const d = Math.hypot(dx, dz);
        if (d <= TUNING.safe_radius) {
          if (d > 1e-6) {
            dx /= d;
            dz /= d;
          } else {
            dx = 1;
            dz = 0;
          }
          pos[0] = lantern.pos[0] + dx * minSafe;
          pos[2] = lantern.pos[2] + dz * minSafe;
          adjusted = true;
        }
      }
      if (!adjusted) break;
    }
  }

  getSnapshot(): SnapshotRecord {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      night: this.night,
      state: this.state,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      wind: {
        active: this.wind.active,
        dir_deg: round3(this.wind.dirDeg),
      },
      player: {
        pos: roundVec3(this.player.pos),
        vel: roundVec3(this.player.vel),
        grounded: this.player.grounded,
        flames: this.player.flames,
        carried: this.player.carried,
        invuln: this.player.invulnTicks > 0,
        dash_cd_s: round3(this.player.dashCdTicks / TICK_RATE),
        pulse_cd_s: round3(this.player.pulseCdTicks / TICK_RATE),
        charm_s: round3(this.player.charmTicks / TICK_RATE),
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: roundVec3(l.pos),
        lit: l.lit,
        deposited: l.deposited,
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: roundVec3(s.pos),
        state: s.state,
      })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: roundVec3(m.pos),
        kind: m.kind,
        ttl_s: m.ttlTicks === null ? null : round3(m.ttlTicks / TICK_RATE),
      })),
      drifters: this.drifters.map((d) => ({
        id: d.id,
        pos: roundVec3(d.pos),
        state: d.state,
        stolen: d.stolen,
      })),
      charms: this.charms.map((c) => ({
        id: c.id,
        available: c.available,
        respawn_s: round3(c.respawnTicks / TICK_RATE),
      })),
    };
  }

  getEndRecord(): EndRecord {
    return {
      type: 'end',
      ticks: this.tick,
      state: this.state,
      score: this.score,
    };
  }
}
