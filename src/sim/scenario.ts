import { DEFAULT_NIGHT1_LANTERNS } from './config';
import {
  FormatError,
  type ScenarioData,
  type ScenarioLantern,
  type ScenarioMote,
  type ScenarioPlayer,
  type ScenarioShade,
  type Vec3,
} from './types';

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

export function validateAndParseScenario(rawJson: string): ScenarioData {
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
    scenario.player = player;
  }

  if ('random_motes' in parsed && parsed.random_motes !== undefined) {
    if (typeof parsed.random_motes !== 'boolean') {
      throw new FormatError('scenario.random_motes must be a boolean');
    }
    scenario.random_motes = parsed.random_motes;
  }

  if ('random_shades' in parsed && parsed.random_shades !== undefined) {
    if (typeof parsed.random_shades !== 'boolean') {
      throw new FormatError('scenario.random_shades must be a boolean');
    }
    scenario.random_shades = parsed.random_shades;
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
        motes.push([pos[0], 0, pos[2]]);
      } else if (isPlainObject(item)) {
        const pos = parseVec3(item.pos, `scenario.motes[${i}].pos`);
        if ('id' in item && item.id !== undefined && typeof item.id !== 'string') {
          throw new FormatError(`scenario.motes[${i}].id must be a string`);
        }
        motes.push({
          id: typeof item.id === 'string' ? item.id : undefined,
          pos: [pos[0], 0, pos[2]],
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
      shades.push({
        id: typeof item.id === 'string' ? item.id : undefined,
        pos,
      });
    }
    scenario.shades = shades;
  }

  if ('lanterns' in parsed && parsed.lanterns !== undefined) {
    if (!Array.isArray(parsed.lanterns)) {
      throw new FormatError('scenario.lanterns must be an array');
    }
    const validIds = new Set(DEFAULT_NIGHT1_LANTERNS.map((l) => l.id));
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
        const pos = parseVec3(item.pos, `scenario.lanterns[${i}].pos`);
        entry.pos = [pos[0], 0, pos[2]];
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
      lanterns.push(entry);
    }
    scenario.lanterns = lanterns;
  }

  return scenario;
}
