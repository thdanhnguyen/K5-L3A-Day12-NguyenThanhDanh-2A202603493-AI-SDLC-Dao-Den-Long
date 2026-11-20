import {
  DEFAULT_NIGHT1_LANTERNS,
  DT,
  ISLAND_RADIUS,
  TICK_RATE,
  TUNING,
  distXZ,
  round3,
  roundVec3,
} from './config';
import {
  applyCreativeMoteBuff,
  createWanderingGirl,
  pickCreativeMoteColor,
  pickCreativeShadeVariant,
  stepWanderingGirl,
} from './creative';
import { transformMoveToWorld } from './input';
import { Mulberry32 } from './prng';
import type {
  CreativeBuffs,
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
} from './types';

const GRAVITY = 20.0;
const JUMP_VELOCITY = 7.5;
const INITIAL_RANDOM_MOTES = 18;
const MAX_RANDOM_MOTES = 20;
const MOTE_RESPAWN_TICKS = 360;
const INITIAL_RANDOM_SHADES = 3;
const MAX_RANDOM_SHADES = 6;
const SHADE_RESPAWN_TICKS = 1080;

export class Simulation {
  readonly seed: number;
  readonly night: number;
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
  wanderingGirl: WanderingGirlState;
  creativeBuffs: CreativeBuffs = {
    powerTimer: 0,
    speedTimer: 0,
    lastNotice: null,
  };

  private randomMotesEnabled: boolean;
  private randomShadesEnabled: boolean;
  private nextMoteNum = 1;
  private nextShadeNum = 1;
  private playRadius: number;

  constructor(
    seed: number,
    night = 1,
    scenario: ScenarioData = {},
    options: SimOptions = {}
  ) {
    this.seed = seed | 0;
    this.night = night;
    this.creative = Boolean(options.creative);
    this.prng = new Mulberry32(this.seed ^ (night * 0x9e3779b9));

    this.initialTimeLeftS = scenario.time_left_s ?? TUNING.night1_duration_s;
    this.timeLeftS = this.initialTimeLeftS;
    this.maxTicks = Math.round(this.initialTimeLeftS * TICK_RATE);

    const pPos: Vec3 = scenario.player?.pos
      ? [scenario.player.pos[0], Math.max(0, scenario.player.pos[1]), scenario.player.pos[2]]
      : [0, 0, 0];

    this.player = {
      pos: pPos,
      vy: 0,
      grounded: pPos[1] <= 0,
      flames: scenario.player?.flames ?? TUNING.flames,
      carried: scenario.player?.carried ?? 0,
      invulnTimer: 0,
      pulseCooldown: 0,
    };

    // Initialize default 5 lanterns then merge scenario overrides (no events, no score).
    this.lanterns = DEFAULT_NIGHT1_LANTERNS.map((def) => ({
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
          target.pos = [patch.pos[0], 0, patch.pos[2]];
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

    // Initialize motes
    this.motes = [];
    if (scenario.motes !== undefined) {
      for (const entry of scenario.motes) {
        const pos: Vec3 = Array.isArray(entry)
          ? [entry[0], 0, entry[2]]
          : [entry.pos[0], 0, entry.pos[2]];
        const id = !Array.isArray(entry) && entry.id ? entry.id : this.allocMoteId();
        this.syncMoteIdCounter(id);
        this.motes.push({
          id,
          pos,
          color: this.creative ? pickCreativeMoteColor(this.prng) : 'gold',
        });
      }
    } else if (this.randomMotesEnabled) {
      for (let i = 0; i < INITIAL_RANDOM_MOTES; i++) {
        this.motes.push(this.spawnRandomMote());
      }
    }

    // Initialize shades
    this.shades = [];
    if (scenario.shades !== undefined) {
      for (const entry of scenario.shades) {
        const id = entry.id ?? this.allocShadeId();
        this.syncShadeIdCounter(id);
        this.shades.push({
          id,
          pos: [entry.pos[0], entry.pos[1], entry.pos[2]],
          state: 'chase',
          stunTimer: 0,
          variant: this.creative ? pickCreativeShadeVariant(this.prng) : 'standard',
        });
      }
    } else if (this.randomShadesEnabled) {
      for (let i = 0; i < INITIAL_RANDOM_SHADES; i++) {
        this.shades.push(this.spawnRandomShade(22, 35));
      }
    }

    // Determine effective play radius (at least ISLAND_RADIUS, expanded if scenario places far entities)
    let maxScenarioR = ISLAND_RADIUS;
    const consider = (p: Vec3) => {
      const r = Math.hypot(p[0], p[2]);
      if (r + 10 > maxScenarioR) maxScenarioR = r + 10;
    };
    consider(this.player.pos);
    for (const l of this.lanterns) consider(l.pos);
    for (const m of this.motes) consider(m.pos);
    for (const s of this.shades) consider(s.pos);
    this.playRadius = maxScenarioR;

    this.wanderingGirl = createWanderingGirl(this.creative, this.prng);
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

  private spawnRandomMote(): MoteState {
    let pos: Vec3 = [10, 0, 10];
    for (let attempt = 0; attempt < 16; attempt++) {
      const angle = this.prng.range(0, Math.PI * 2);
      const radius = Math.sqrt(this.prng.next()) * 32 + 4;
      const clampedR = Math.min(35, radius);
      const candidate: Vec3 = [
        round3(Math.cos(angle) * clampedR),
        0,
        round3(Math.sin(angle) * clampedR),
      ];
      const tooCloseToLantern = this.lanterns.some((l) => distXZ(candidate, l.pos) < 3.0);
      if (!tooCloseToLantern && distXZ(candidate, this.player.pos) > 3.5) {
        pos = candidate;
        break;
      }
      pos = candidate;
    }
    return {
      id: this.allocMoteId(),
      pos,
      color: this.creative ? pickCreativeMoteColor(this.prng) : 'gold',
    };
  }

  private spawnRandomShade(minDistFromPlayer: number, maxRadius: number): ShadeState {
    let pos: Vec3 = [26, 1.0, 0];
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = this.prng.range(0, Math.PI * 2);
      const radius = this.prng.range(18, maxRadius);
      const candidate: Vec3 = [
        round3(Math.cos(angle) * radius),
        1.0,
        round3(Math.sin(angle) * radius),
      ];
      const inSafe = this.lanterns.some(
        (l) => l.lit && distXZ(candidate, l.pos) <= TUNING.safe_radius + 1.0
      );
      if (!inSafe && distXZ(candidate, this.player.pos) >= minDistFromPlayer) {
        pos = candidate;
        break;
      }
    }
    return {
      id: this.allocShadeId(),
      pos,
      state: 'chase',
      stunTimer: 0,
      variant: this.creative ? pickCreativeShadeVariant(this.prng) : 'standard',
    };
  }

  step(input: StepInput): SimEvent[] {
    if (this.state !== 'playing') {
      return [];
    }

    const events: SimEvent[] = [];
    this.tick += 1;
    this.simTick += 1;
    this.timeLeftS = Math.max(0, this.initialTimeLeftS - this.simTick * DT);

    // 1. Update timers
    this.player.invulnTimer = Math.max(0, this.player.invulnTimer - DT);
    this.player.pulseCooldown = Math.max(0, this.player.pulseCooldown - DT);
    if (this.creative) {
      this.creativeBuffs.powerTimer = Math.max(0, this.creativeBuffs.powerTimer - DT);
      this.creativeBuffs.speedTimer = Math.max(0, this.creativeBuffs.speedTimer - DT);
    }

    for (const shade of this.shades) {
      if (shade.state === 'stunned') {
        shade.stunTimer = Math.max(0, shade.stunTimer - DT);
        if (shade.stunTimer === 0) {
          shade.state = 'chase';
        }
      }
    }

    // 2. Player movement & jumping
    const speedMultiplier =
      this.creative && this.creativeBuffs.speedTimer > 0 ? 1.35 : 1.0;
    const effectiveSpeed = TUNING.player_speed * speedMultiplier;
    const [wx, wz] = transformMoveToWorld(input.move, input.camYawDeg);
    this.player.pos[0] += wx * effectiveSpeed * DT;
    this.player.pos[2] += wz * effectiveSpeed * DT;

    if (!TUNING.fall_enabled) {
      const r = Math.hypot(this.player.pos[0], this.player.pos[2]);
      if (r > this.playRadius) {
        const scale = this.playRadius / r;
        this.player.pos[0] *= scale;
        this.player.pos[2] *= scale;
      }
    }

    if (input.jumpPressed && this.player.grounded) {
      this.player.vy = JUMP_VELOCITY;
      this.player.grounded = false;
    }
    if (!this.player.grounded) {
      this.player.vy -= GRAVITY * DT;
      this.player.pos[1] += this.player.vy * DT;
      if (this.player.pos[1] <= 0) {
        this.player.pos[1] = 0;
        this.player.vy = 0;
        this.player.grounded = true;
      }
    }

    // 3. Pulse (rising edge)
    if (
      input.pulsePressed &&
      this.player.carried >= TUNING.pulse_cost &&
      this.player.pulseCooldown <= 0
    ) {
      const powerMult =
        this.creative && this.creativeBuffs.powerTimer > 0 ? 1.4 : 1.0;
      const effectiveRadius = TUNING.pulse_radius * powerMult;
      const effectiveStun = TUNING.pulse_stun_s * powerMult;

      this.player.carried -= TUNING.pulse_cost;
      this.player.pulseCooldown = TUNING.pulse_cooldown_s;

      const stunnedIds: string[] = [];
      for (const shade of this.shades) {
        if (distXZ(this.player.pos, shade.pos) <= effectiveRadius) {
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
          const pushDist = TUNING.pulse_push_m * pushScale;
          shade.pos[0] += dx * pushDist;
          shade.pos[2] += dz * pushDist;
          this.projectOutsideLitSafeZones(shade.pos);
          this.clampToPlayRadius(shade.pos);
          shade.state = 'stunned';
          shade.stunTimer = effectiveStun;
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
    }

    // 4. Interact / deposit into nearest unlit lantern within interact_radius
    if (input.interactPressed && this.player.carried > 0) {
      let bestLantern: LanternState | null = null;
      let bestDist = Infinity;

      for (const lantern of this.lanterns) {
        if (lantern.lit) continue;
        const d = distXZ(this.player.pos, lantern.pos);
        if (d <= TUNING.interact_radius) {
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

            if (this.lanterns.every((l) => l.lit)) {
              const timeBonus =
                Math.floor(this.timeLeftS) * TUNING.score.per_second_left;
              const flameBonus =
                this.player.flames * TUNING.score.per_flame_left;
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
          }
        }
      }
    }

    // 5. Auto-pickup motes within pickup_radius
    if (this.player.carried < TUNING.carry_capacity) {
      for (let i = 0; i < this.motes.length; i++) {
        if (this.player.carried >= TUNING.carry_capacity) break;
        const mote = this.motes[i];
        if (distXZ(this.player.pos, mote.pos) <= TUNING.pickup_radius) {
          this.motes.splice(i, 1);
          i--;
          this.player.carried += 1;
          this.score += TUNING.score.per_mote;
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

    // 6. Creative wandering girl (strictly creative-only)
    if (this.creative) {
      stepWanderingGirl(this.wanderingGirl, this.player, this.creativeBuffs, DT);
    }

    // 7. Random spawners (if enabled)
    if (
      this.randomMotesEnabled &&
      this.simTick % MOTE_RESPAWN_TICKS === 0 &&
      this.motes.length < MAX_RANDOM_MOTES
    ) {
      this.motes.push(this.spawnRandomMote());
    }

    if (
      this.randomShadesEnabled &&
      this.simTick % SHADE_RESPAWN_TICKS === 0 &&
      this.shades.length < MAX_RANDOM_SHADES
    ) {
      const shade = this.spawnRandomShade(18, 36);
      this.shades.push(shade);
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'shade_spawned',
        data: { id: shade.id },
      });
    }

    // 8. Shade movement & safe_radius enforcement
    const litLanterns = this.lanterns.filter((l) => l.lit);
    for (const shade of this.shades) {
      if (shade.state === 'stunned') continue;

      const variantSpeedScale = this.creative
        ? shade.variant === 'large'
          ? 0.82
          : shade.variant === 'small'
            ? 1.15
            : 1.0
        : 1.0;
      const moveSpeed = TUNING.shade_speed * variantSpeedScale;

      // Check if currently inside any lit lantern's safe_radius
      let insideLantern: LanternState | null = null;
      let nearestLanternDist = Infinity;
      for (const lantern of litLanterns) {
        const d = distXZ(shade.pos, lantern.pos);
        if (d <= TUNING.safe_radius && d < nearestLanternDist) {
          nearestLanternDist = d;
          insideLantern = lantern;
        }
      }

      if (insideLantern !== null) {
        shade.state = 'flee';
        let dx = shade.pos[0] - insideLantern.pos[0];
        let dz = shade.pos[2] - insideLantern.pos[2];
        const d = Math.hypot(dx, dz);
        if (d > 1e-6) {
          dx /= d;
          dz /= d;
        } else {
          dx = 1;
          dz = 0;
        }
        shade.pos[0] += dx * moveSpeed * DT;
        shade.pos[2] += dz * moveSpeed * DT;
        this.projectOutsideLitSafeZones(shade.pos);
      } else {
        shade.state = 'chase';
        const dx = this.player.pos[0] - shade.pos[0];
        const dz = this.player.pos[2] - shade.pos[2];
        const dist = Math.hypot(dx, dz);
        if (dist > 1e-6) {
          const stepLen = Math.min(dist, moveSpeed * DT);
          shade.pos[0] += (dx / dist) * stepLen;
          shade.pos[2] += (dz / dist) * stepLen;
        }
        this.projectOutsideLitSafeZones(shade.pos);
      }

      this.clampToPlayRadius(shade.pos);
    }

    // 9. Shade contact / player_hit check
    if (this.player.invulnTimer <= 0) {
      for (const shade of this.shades) {
        if (shade.state === 'stunned') continue;
        const hitRadius =
          TUNING.shade_hit_radius *
          (this.creative && shade.variant === 'large' ? 1.25 : 1.0);
        if (distXZ(this.player.pos, shade.pos) <= hitRadius) {
          this.player.flames = Math.max(0, this.player.flames - 1);
          const dropped = Math.floor(
            this.player.carried * TUNING.hit_drop_ratio
          );
          this.player.carried = Math.max(0, this.player.carried - dropped);
          this.player.invulnTimer = TUNING.invuln_s;

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
          break;
        }
      }
    }

    // 10. Dawn timeout check
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

  private clampToPlayRadius(pos: Vec3): void {
    const r = Math.hypot(pos[0], pos[2]);
    if (r > this.playRadius) {
      const scale = this.playRadius / r;
      pos[0] *= scale;
      pos[2] *= scale;
    }
  }

  getSnapshot(): SnapshotRecord {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      state: this.state,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      player: {
        pos: roundVec3(this.player.pos),
        flames: this.player.flames,
        carried: this.player.carried,
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
      })),
    };
  }

  getEndRecord(): EndRecord {
    return {
      type: 'end',
      ticks: this.simTick,
      state: this.state,
      score: this.score,
    };
  }
}
