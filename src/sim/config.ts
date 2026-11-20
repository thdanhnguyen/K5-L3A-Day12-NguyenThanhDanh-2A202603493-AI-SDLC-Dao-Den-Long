import contractJson from '../../game.contract.json';
import type { ContractConfig, Tuning, Vec3 } from './types';

export const CONTRACT: ContractConfig = contractJson as ContractConfig;
export const TUNING: Tuning = CONTRACT.tuning;

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const ISLAND_RADIUS = 40.0;
export const DEFAULT_LANTERN_RING_RADIUS = 22.0;

export const DEFAULT_NIGHT1_LANTERN_NAMES = [
  'Đèn Bến Thuyền',
  'Đèn Rừng Trúc',
  'Đèn Gió Biển',
  'Đèn Chuông Mây',
  'Đèn Đỉnh Sao',
];

export const DEFAULT_NIGHT1_LANTERNS: Array<{ id: string; name: string; pos: Vec3 }> = Array.from(
  { length: TUNING.lantern_count_night1 },
  (_, index) => {
    const angle = (index * 2 * Math.PI) / TUNING.lantern_count_night1;
    const x = round3(DEFAULT_LANTERN_RING_RADIUS * Math.sin(angle));
    const z = round3(DEFAULT_LANTERN_RING_RADIUS * Math.cos(angle));
    return {
      id: `L${index + 1}`,
      name: DEFAULT_NIGHT1_LANTERN_NAMES[index] ?? `Đèn ${index + 1}`,
      pos: [x, 0, z],
    };
  }
);

export function round3(value: number): number {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function roundVec3(v: Vec3): Vec3 {
  return [round3(v[0]), round3(v[1]), round3(v[2])];
}

export function distXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}
