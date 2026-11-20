export type Vec3 = [number, number, number];

export type GameState = 'playing' | 'paused' | 'won' | 'lost';

export type MoteColor = 'gold' | 'red' | 'blue' | 'green';

export type MoteKind = 'random' | 'dropped';

export type ShadeVariant = 'standard' | 'small' | 'large';

export type ShadeBehaviorState =
  | 'spawning'
  | 'wander'
  | 'chase'
  | 'recoil'
  | 'stunned'
  | 'drain';

export type DrifterBehaviorState = 'idle' | 'chase' | 'flee' | 'removed';

export interface ScoreTuning {
  per_mote: number;
  per_lantern: number;
  per_stun: number;
  per_second_left: number;
  per_flame_left: number;
}

export interface Tuning {
  player_speed: number;
  dash_speed: number;
  dash_duration_s: number;
  dash_cooldown_s: number;
  carry_capacity: number;
  capacity_max: number;
  lantern_cost: number;
  relight_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  night2_duration_s: number;
  night3_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  fall_enabled: boolean;
  fuel_max: number;
  fuel_decay_per_s: number;
  fuel_per_mote: number;
  win_ratio: number;
  drain_per_s: number;
  low_fuel_threshold: number;
  score: ScoreTuning;
}

export interface ContractConfig {
  contract_version: string;
  team: string;
  build_cmd: string;
  run_cmd: string;
  headless_cmd: string;
  tuning: Tuning;
}

export interface InputFrame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}

export interface InputState {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export interface StepInput {
  move: [number, number];
  camYawDeg: number;
  jumpPressed: boolean;
  interactPressed: boolean;
  pulsePressed: boolean;
  dashPressed: boolean;
  pausePressed: boolean;
}

export interface ScenarioPlayer {
  pos?: Vec3;
  carried?: number;
  flames?: number;
  invuln_ticks?: number;
  dash_cd_ticks?: number;
  pulse_cd_ticks?: number;
  charm_ticks?: number;
  successful_lights?: number;
}

export interface ScenarioShade {
  id?: string;
  pos: Vec3;
  state?: ShadeBehaviorState;
  state_ticks_left?: number;
  target_lantern_id?: string;
}

export interface ScenarioLantern {
  id: string;
  pos?: Vec3;
  deposited?: number;
  lit?: boolean;
  fuel?: number;
  ever_lit?: boolean;
}

export type ScenarioMote = Vec3 | { id?: string; pos: Vec3; kind?: MoteKind; ttl_s?: number };

export interface ScenarioDrifter {
  id?: string;
  pos: Vec3;
  state?: DrifterBehaviorState;
  stolen?: number;
}

export interface ScenarioCharm {
  id: string;
  pos?: Vec3;
  available?: boolean;
  respawn_s?: number;
}

export interface ScenarioData {
  player?: ScenarioPlayer;
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: ScenarioMote[];
  shades?: ScenarioShade[];
  lanterns?: ScenarioLantern[];
  drifters?: ScenarioDrifter[];
  charms?: ScenarioCharm[];
  time_left_s?: number;
}

export interface PlayerState {
  pos: Vec3;
  vel: Vec3;
  grounded: boolean;
  flames: number;
  carried: number;
  successfulLights: number;
  capacity: number;
  facing: [number, number];
  invulnTicks: number;
  dashTicksLeft: number;
  dashCdTicks: number;
  dashDir: [number, number];
  pulseCdTicks: number;
  charmTicks: number;
  respawnWaitTicks: number;
  launchActive: boolean;
  launchVel: [number, number];
}

export interface LanternState {
  id: string;
  name: string;
  pos: Vec3;
  lit: boolean;
  deposited: number;
  fuelUnits: number;
  everLit: boolean;
  relitCount: number;
}

export interface MoteState {
  id: string;
  pos: Vec3;
  color: MoteColor;
  kind: MoteKind;
  ttlTicks: number | null;
  justSpawned: boolean;
}

export interface ShadeState {
  id: string;
  pos: Vec3;
  state: ShadeBehaviorState;
  stateTicksLeft: number;
  pushTicksLeft: number;
  pushStep: [number, number];
  recoilDir: [number, number];
  safePushTicks: number;
  targetLanternId: string | null;
  drainTicks: number;
  wanderAngle: number;
  justSpawned: boolean;
  variant: ShadeVariant;
}

export interface DrifterState {
  id: string;
  pos: Vec3;
  state: DrifterBehaviorState;
  stolen: number;
  hasStolen: boolean;
  fleeTicksLeft: number;
  wanderAngle: number;
  justSpawned: boolean;
}

export interface CharmState {
  id: string;
  pos: Vec3;
  available: boolean;
  respawnTicks: number;
}

export interface WindState {
  enabled: boolean;
  active: boolean;
  telegraph: boolean;
  dirDeg: number;
  ticksLeft: number;
}

export interface WanderingGirlState {
  active: boolean;
  found: boolean;
  pos: Vec3;
  homePos: Vec3;
  angle: number;
  celebrationTimer: number;
}

export interface CreativeBuffs {
  powerTimer: number;
  speedTimer: number;
  lastNotice: string | null;
}

export interface SimOptions {
  creative?: boolean;
}

export type SimEvent =
  | { type: 'event'; tick: number; name: 'night_start'; data: { night: number } }
  | { type: 'event'; tick: number; name: 'mote_picked'; data: { carried: number } }
  | {
      type: 'event';
      tick: number;
      name: 'deposit';
      data: { lantern_id: string; amount: number; deposited: number };
    }
  | {
      type: 'event';
      tick: number;
      name: 'lantern_lit';
      data: { lantern_id: string; relight: boolean };
    }
  | {
      type: 'event';
      tick: number;
      name: 'refuel';
      data: { lantern_id: string; amount: number; fuel: number };
    }
  | { type: 'event'; tick: number; name: 'lantern_out'; data: { lantern_id: string } }
  | {
      type: 'event';
      tick: number;
      name: 'fuel_drain';
      data: { lantern_id: string; shade_id: string; fuel: number };
    }
  | { type: 'event'; tick: number; name: 'pulse'; data: { stunned_ids: string[] } }
  | { type: 'event'; tick: number; name: 'dash'; data: Record<string, never> }
  | {
      type: 'event';
      tick: number;
      name: 'charm_picked';
      data: { charm_id: string; charm_ticks: number };
    }
  | {
      type: 'event';
      tick: number;
      name: 'drifter_steal';
      data: { drifter_id: string; amount: number; carried: number };
    }
  | {
      type: 'event';
      tick: number;
      name: 'drifter_drop';
      data: { drifter_id: string; amount: number };
    }
  | {
      type: 'event';
      tick: number;
      name: 'player_hit';
      data: { by: 'shade' | 'fall'; flames: number; dropped: number; lost?: number };
    }
  | { type: 'event'; tick: number; name: 'shade_spawned'; data: { id: string } }
  | { type: 'event'; tick: number; name: 'paused'; data: Record<string, never> }
  | { type: 'event'; tick: number; name: 'resumed'; data: Record<string, never> }
  | {
      type: 'event';
      tick: number;
      name: 'game_over';
      data: { result: 'won' | 'lost'; reason: 'dawn_survived' | 'dawn' | 'no_flames' };
    };

export interface SnapshotRecord {
  type: 'snapshot';
  tick: number;
  sim_tick: number;
  night: number;
  state: GameState;
  time_left_s: number;
  score: number;
  wind: {
    active: boolean;
    dir_deg: number;
  };
  player: {
    pos: Vec3;
    vel: Vec3;
    grounded: boolean;
    flames: number;
    carried: number;
    capacity: number;
    invuln: boolean;
    dash_cd_s: number;
    pulse_cd_s: number;
    charm_s: number;
  };
  lanterns: Array<{
    id: string;
    pos: Vec3;
    lit: boolean;
    deposited: number;
    fuel: number;
    ever_lit: boolean;
    relit_count: number;
  }>;
  shades: Array<{
    id: string;
    pos: Vec3;
    state: ShadeBehaviorState;
  }>;
  motes_active: number;
  motes: Array<{
    id: string;
    pos: Vec3;
    kind: MoteKind;
    ttl_s: number | null;
  }>;
  drifters: Array<{
    id: string;
    pos: Vec3;
    state: DrifterBehaviorState;
    stolen: number;
  }>;
  charms: Array<{
    id: string;
    available: boolean;
    respawn_s: number;
  }>;
}

export interface EndRecord {
  type: 'end';
  ticks: number;
  state: GameState;
  score: number;
}

export class FormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormatError';
  }
}
