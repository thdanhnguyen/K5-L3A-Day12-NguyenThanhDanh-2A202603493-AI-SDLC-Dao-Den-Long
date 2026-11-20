import contractJson from '../../game.contract.json';
import type { ContractConfig, Tuning, Vec3 } from './types';

export const CONTRACT: ContractConfig = contractJson as ContractConfig;
export const TUNING: Tuning = CONTRACT.tuning;

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

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

export function dist3D(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
