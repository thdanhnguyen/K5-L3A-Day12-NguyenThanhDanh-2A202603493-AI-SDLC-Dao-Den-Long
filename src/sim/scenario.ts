import { getNightMap } from './maps';
import {
  FormatError,
  type DrifterBehaviorState,
  type MoteKind,
  type ScenarioCharm,
  type ScenarioData,
  type ScenarioDrifter,
  type ScenarioLantern,
  type ScenarioMote,
  type ScenarioPlayer,
  type ScenarioShade,
  type ShadeBehaviorState,
  type Vec3,
} from './types';

const VALID_SHADE_STATES = new Set<ShadeBehaviorState>([
  'spawning',
  'wander',
  'chase',
  'recoil',
  'stunned',
  'drain',
]);

const VALID_DRIFTER_STATES = new Set<DrifterBehaviorState>([
  'idle',
  'chase',
  'flee',
  'removed',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseVec3(value: unknown, fieldPath: string): Vec3 {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new FormatError(`${fieldPath} must be a [x, y, z] array`);
  }
  const nums = value.map((item, idx) => {
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      throw new FormatError(`${fieldPath}[${idx}] must be a finite number`);
    }
    return item;
  });
  return [nums[0], nums[1], nums[2]];
}

function parseNonNegNumber(value: unknown, fieldPath: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new FormatError(`${fieldPath} must be a finite number >= 0`);
  }
  return value;
}

function parseNonNegInt(value: unknown, fieldPath: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new FormatError(`${fieldPath} must be a non-negative integer`);
  }
  return value;
}

export function validateAndParseScenario(
  rawJson: string,
  night: 1 | 2 | 3 = 1
): ScenarioData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new FormatError(`Invalid JSON in scenario file: ${(err as Error).message}`);
  }

  if (!isPlainObject(parsed)) {
    throw new FormatError('Scenario root must be a JSON object');
  }

  const scenario: ScenarioData = {};

  if ('player' in parsed && parsed.player !== undefined) {
    if (!isPlainObject(parsed.player)) {
      throw new FormatError('scenario.player must be an object');
    }
    const player: ScenarioPlayer = {};
    if ('pos' in parsed.player && parsed.player.pos !== undefined) {
      player.pos = parseVec3(parsed.player.pos, 'scenario.player.pos');
    }
    if ('carried' in parsed.player && parsed.player.carried !== undefined) {
      player.carried = parseNonNegInt(parsed.player.carried, 'scenario.player.carried');
    }
    if ('flames' in parsed.player && parsed.player.flames !== undefined) {
      player.flames = parseNonNegInt(parsed.player.flames, 'scenario.player.flames');
    }
    if ('invuln_ticks' in parsed.player && parsed.player.invuln_ticks !== undefined) {
      player.invuln_ticks = parseNonNegInt(
        parsed.player.invuln_ticks,
        'scenario.player.invuln_ticks'
      );
    }
    if ('dash_cd_ticks' in parsed.player && parsed.player.dash_cd_ticks !== undefined) {
      player.dash_cd_ticks = parseNonNegInt(
        parsed.player.dash_cd_ticks,
        'scenario.player.dash_cd_ticks'
      );
    }
    if ('pulse_cd_ticks' in parsed.player && parsed.player.pulse_cd_ticks !== undefined) {
      player.pulse_cd_ticks = parseNonNegInt(
        parsed.player.pulse_cd_ticks,
        'scenario.player.pulse_cd_ticks'
      );
    }
    if ('charm_ticks' in parsed.player && parsed.player.charm_ticks !== undefined) {
      player.charm_ticks = parseNonNegInt(
        parsed.player.charm_ticks,
        'scenario.player.charm_ticks'
      );
    }
    if ('successful_lights' in parsed.player && parsed.player.successful_lights !== undefined) {
      player.successful_lights = parseNonNegInt(
        parsed.player.successful_lights,
        'scenario.player.successful_lights'
      );
    }
    scenario.player = player;
  }

  for (const flag of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'] as const) {
    if (flag in parsed && parsed[flag] !== undefined) {
      if (typeof parsed[flag] !== 'boolean') {
        throw new FormatError(`scenario.${flag} must be a boolean`);
      }
      scenario[flag] = parsed[flag];
    }
  }

  if ('time_left_s' in parsed && parsed.time_left_s !== undefined) {
    scenario.time_left_s = parseNonNegNumber(parsed.time_left_s, 'scenario.time_left_s');
  }

  if ('motes' in parsed && parsed.motes !== undefined) {
    if (!Array.isArray(parsed.motes)) {
      throw new FormatError('scenario.motes must be an array');
    }
    const motes: ScenarioMote[] = [];
    for (let i = 0; i < parsed.motes.length; i++) {
      const item = parsed.motes[i];
      if (Array.isArray(item)) {
        const pos = parseVec3(item, `scenario.motes[${i}]`);
        motes.push([pos[0], pos[1], pos[2]]);
      } else if (isPlainObject(item)) {
        const pos = parseVec3(item.pos, `scenario.motes[${i}].pos`);
        if ('id' in item && item.id !== undefined && typeof item.id !== 'string') {
          throw new FormatError(`scenario.motes[${i}].id must be a string`);
        }
        let kind: MoteKind | undefined;
        if ('kind' in item && item.kind !== undefined) {
          if (item.kind !== 'random' && item.kind !== 'dropped') {
            throw new FormatError(`scenario.motes[${i}].kind must be "random" or "dropped"`);
          }
          kind = item.kind;
        }
        let ttl_s: number | undefined;
        if ('ttl_s' in item && item.ttl_s !== undefined) {
          ttl_s = parseNonNegNumber(item.ttl_s, `scenario.motes[${i}].ttl_s`);
        }
        motes.push({
          id: typeof item.id === 'string' ? item.id : undefined,
          pos,
          kind,
          ttl_s,
        });
      } else {
        throw new FormatError(`scenario.motes[${i}] must be [x,y,z] or {pos:[x,y,z]}`);
      }
    }
    scenario.motes = motes;
  }

  if ('shades' in parsed && parsed.shades !== undefined) {
    if (!Array.isArray(parsed.shades)) {
      throw new FormatError('scenario.shades must be an array');
    }
    const shades: ScenarioShade[] = [];
    for (let i = 0; i < parsed.shades.length; i++) {
      const item = parsed.shades[i];
      if (!isPlainObject(item)) {
        throw new FormatError(`scenario.shades[${i}] must be an object`);
      }
      if ('id' in item && item.id !== undefined && typeof item.id !== 'string') {
        throw new FormatError(`scenario.shades[${i}].id must be a string`);
      }
      const pos = parseVec3(item.pos, `scenario.shades[${i}].pos`);
      let state: ShadeBehaviorState | undefined;
      if ('state' in item && item.state !== undefined) {
        if (typeof item.state !== 'string' || !VALID_SHADE_STATES.has(item.state as ShadeBehaviorState)) {
          throw new FormatError(`scenario.shades[${i}].state is invalid`);
        }
        state = item.state as ShadeBehaviorState;
      }
      let state_ticks_left: number | undefined;
      if ('state_ticks_left' in item && item.state_ticks_left !== undefined) {
        state_ticks_left = parseNonNegInt(
          item.state_ticks_left,
          `scenario.shades[${i}].state_ticks_left`
        );
      }
      let target_lantern_id: string | undefined;
      if ('target_lantern_id' in item && item.target_lantern_id !== undefined) {
        if (typeof item.target_lantern_id !== 'string') {
          throw new FormatError(`scenario.shades[${i}].target_lantern_id must be a string`);
        }
        target_lantern_id = item.target_lantern_id;
      }
      shades.push({
        id: typeof item.id === 'string' ? item.id : undefined,
        pos,
        state,
        state_ticks_left,
        target_lantern_id,
      });
    }
    scenario.shades = shades;
  }

  if ('drifters' in parsed && parsed.drifters !== undefined) {
    if (!Array.isArray(parsed.drifters)) {
      throw new FormatError('scenario.drifters must be an array');
    }
    const drifters: ScenarioDrifter[] = [];
    for (let i = 0; i < parsed.drifters.length; i++) {
      const item = parsed.drifters[i];
      if (!isPlainObject(item)) {
        throw new FormatError(`scenario.drifters[${i}] must be an object`);
      }
      const pos = parseVec3(item.pos, `scenario.drifters[${i}].pos`);
      let state: DrifterBehaviorState | undefined;
      if ('state' in item && item.state !== undefined) {
        if (typeof item.state !== 'string' || !VALID_DRIFTER_STATES.has(item.state as DrifterBehaviorState)) {
          throw new FormatError(`scenario.drifters[${i}].state is invalid`);
        }
        state = item.state as DrifterBehaviorState;
      }
      let stolen: number | undefined;
      if ('stolen' in item && item.stolen !== undefined) {
        stolen = parseNonNegInt(item.stolen, `scenario.drifters[${i}].stolen`);
      }
      drifters.push({
        id: typeof item.id === 'string' ? item.id : undefined,
        pos,
        state,
        stolen,
      });
    }
    scenario.drifters = drifters;
  }

  if ('charms' in parsed && parsed.charms !== undefined) {
    if (!Array.isArray(parsed.charms)) {
      throw new FormatError('scenario.charms must be an array');
    }
    const charms: ScenarioCharm[] = [];
    for (let i = 0; i < parsed.charms.length; i++) {
      const item = parsed.charms[i];
      if (!isPlainObject(item) || typeof item.id !== 'string' || item.id.length === 0) {
        throw new FormatError(`scenario.charms[${i}].id must be a non-empty string`);
      }
      const entry: ScenarioCharm = { id: item.id };
      if ('pos' in item && item.pos !== undefined) {
        entry.pos = parseVec3(item.pos, `scenario.charms[${i}].pos`);
      }
      if ('available' in item && item.available !== undefined) {
        if (typeof item.available !== 'boolean') {
          throw new FormatError(`scenario.charms[${i}].available must be a boolean`);
        }
        entry.available = item.available;
      }
      if ('respawn_s' in item && item.respawn_s !== undefined) {
        entry.respawn_s = parseNonNegNumber(item.respawn_s, `scenario.charms[${i}].respawn_s`);
      }
      charms.push(entry);
    }
    scenario.charms = charms;
  }

  if ('lanterns' in parsed && parsed.lanterns !== undefined) {
    if (!Array.isArray(parsed.lanterns)) {
      throw new FormatError('scenario.lanterns must be an array');
    }
    const map = getNightMap(night);
    const validIds = new Set(map.lanterns.map((l) => l.id));
    const lanterns: ScenarioLantern[] = [];
    for (let i = 0; i < parsed.lanterns.length; i++) {
      const item = parsed.lanterns[i];
      if (!isPlainObject(item) || typeof item.id !== 'string' || !validIds.has(item.id)) {
        throw new FormatError(
          `scenario.lanterns[${i}].id must be a valid lantern id (${Array.from(validIds).join(', ')})`
        );
      }
      const entry: ScenarioLantern = { id: item.id };
      if ('pos' in item && item.pos !== undefined) {
        entry.pos = parseVec3(item.pos, `scenario.lanterns[${i}].pos`);
      }
      if ('deposited' in item && item.deposited !== undefined) {
        entry.deposited = parseNonNegInt(item.deposited, `scenario.lanterns[${i}].deposited`);
      }
      if ('lit' in item && item.lit !== undefined) {
        if (typeof item.lit !== 'boolean') {
          throw new FormatError(`scenario.lanterns[${i}].lit must be a boolean`);
        }
        entry.lit = item.lit;
      }
      if ('fuel' in item && item.fuel !== undefined) {
        entry.fuel = parseNonNegNumber(item.fuel, `scenario.lanterns[${i}].fuel`);
      }
      if ('ever_lit' in item && item.ever_lit !== undefined) {
        if (typeof item.ever_lit !== 'boolean') {
          throw new FormatError(`scenario.lanterns[${i}].ever_lit must be a boolean`);
        }
        entry.ever_lit = item.ever_lit;
      }
      lanterns.push(entry);
    }
    scenario.lanterns = lanterns;
  }

  return scenario;
}
