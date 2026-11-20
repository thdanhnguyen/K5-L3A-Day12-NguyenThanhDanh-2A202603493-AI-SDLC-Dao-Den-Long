export type Vec3 = [number, number, number];

export type GameState = 'playing' | 'won' | 'lost';

export type MoteColor = 'gold' | 'red' | 'blue' | 'green';

export type ShadeVariant = 'standard' | 'small' | 'large';

export type ShadeBehaviorState = 'chase' | 'stunned' | 'flee';

export interface ScoreTuning {
  per_mote: number;
  per_lantern: number;
  per_stun: number;
  per_second_left: number;
  per_flame_left: number;
}

export interface Tuning {
  player_speed: number;
  carry_capacity: number;
  lantern_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
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
}

export interface InputState {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
}

export interface StepInput {
  move: [number, number];
  camYawDeg: number;
  jumpPressed: boolean;
  interactPressed: boolean;
  pulsePressed: boolean;
  dashPressed: boolean;
}

export interface ScenarioPlayer {
  pos?: Vec3;
  carried?: number;
  flames?: number;
}

export interface ScenarioShade {
  id?: string;
  pos: Vec3;
}

export interface ScenarioLantern {
  id: string;
  pos?: Vec3;
  deposited?: number;
  lit?: boolean;
}

export type ScenarioMote = Vec3 | { id?: string; pos: Vec3 };

export interface ScenarioData {
  player?: ScenarioPlayer;
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: ScenarioMote[];
  shades?: ScenarioShade[];
  lanterns?: ScenarioLantern[];
  time_left_s?: number;
}

export interface PlayerState {
  pos: Vec3;
  vy: number;
  grounded: boolean;
  flames: number;
  carried: number;
  invulnTimer: number;
  pulseCooldown: number;
}

export interface LanternState {
  id: string;
  name: string;
  pos: Vec3;
  lit: boolean;
  deposited: number;
}

export interface MoteState {
  id: string;
  pos: Vec3;
  color: MoteColor;
}

export interface ShadeState {
  id: string;
  pos: Vec3;
  state: ShadeBehaviorState;
  stunTimer: number;
  variant: ShadeVariant;
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
  | { type: 'event'; tick: number; name: 'mote_picked'; data: { carried: number } }
  | {
      type: 'event';
      tick: number;
      name: 'deposit';
      data: { lantern_id: string; amount: number; deposited: number };
    }
  | { type: 'event'; tick: number; name: 'lantern_lit'; data: { lantern_id: string } }
  | { type: 'event'; tick: number; name: 'pulse'; data: { stunned_ids: string[] } }
  | {
      type: 'event';
      tick: number;
      name: 'player_hit';
      data: { by: 'shade' | 'fall'; flames: number; dropped: number };
    }
  | { type: 'event'; tick: number; name: 'shade_spawned'; data: { id: string } }
  | {
      type: 'event';
      tick: number;
      name: 'game_over';
      data: { result: 'won' | 'lost'; reason: 'all_lit' | 'dawn' | 'no_flames' };
    };

export interface SnapshotRecord {
  type: 'snapshot';
  tick: number;
  sim_tick: number;
  state: GameState;
  time_left_s: number;
  score: number;
  player: {
    pos: Vec3;
    flames: number;
    carried: number;
  };
  lanterns: Array<{
    id: string;
    pos: Vec3;
    lit: boolean;
    deposited: number;
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
