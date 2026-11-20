import { TUNING, distXZ } from './config';
import type { Mulberry32 } from './prng';
import type {
  CreativeBuffs,
  MoteColor,
  PlayerState,
  ShadeVariant,
  WanderingGirlState,
} from './types';

export function pickCreativeMoteColor(prng: Mulberry32): MoteColor {
  const roll = prng.next();
  if (roll < 0.55) return 'gold';
  if (roll < 0.7) return 'red';
  if (roll < 0.85) return 'blue';
  return 'green';
}

export function pickCreativeShadeVariant(prng: Mulberry32): ShadeVariant {
  return prng.next() < 0.35 ? 'large' : 'small';
}

export function createWanderingGirl(
  creative: boolean,
  night: 1 | 2 | 3,
  prng: Mulberry32
): WanderingGirlState {
  if (!creative) {
    return {
      active: false,
      found: false,
      pos: [0, 0, 0],
      homePos: [0, 0, 0],
      angle: 0,
      celebrationTimer: 0,
    };
  }
  const base =
    night === 1 ? [-14, 0, -11] : night === 2 ? [10, 0, -12] : [-24, 0, -18];
  const homeX = base[0] + prng.range(-1.2, 1.2);
  const homeZ = base[2] + prng.range(-1.2, 1.2);
  const angle = prng.range(0, Math.PI * 2);
  return {
    active: true,
    found: false,
    pos: [homeX + Math.cos(angle) * 3.0, 0, homeZ + Math.sin(angle) * 3.0],
    homePos: [homeX, 0, homeZ],
    angle,
    celebrationTimer: 0,
  };
}

export function stepWanderingGirl(
  girl: WanderingGirlState,
  player: PlayerState,
  buffs: CreativeBuffs,
  dt: number
): void {
  if (!girl.active) return;

  if (girl.found) {
    if (girl.celebrationTimer > 0) {
      girl.celebrationTimer = Math.max(0, girl.celebrationTimer - dt);
    }
    return;
  }

  girl.angle = (girl.angle + dt * 0.55) % (Math.PI * 2);
  girl.pos[0] = girl.homePos[0] + Math.cos(girl.angle) * 3.0;
  girl.pos[2] = girl.homePos[2] + Math.sin(girl.angle) * 3.0;

  if (distXZ(girl.pos, player.pos) <= 2.2) {
    girl.found = true;
    girl.celebrationTimer = 3.0;
    const before = player.carried;
    player.carried = Math.min(player.capacity, player.carried + 5);
    const gained = player.carried - before;
    buffs.lastNotice =
      gained > 0
        ? `Tìm thấy Bé Lạc trong rừng! Cô bé tặng Mây +${gained} ánh sáng!`
        : 'Tìm thấy Bé Lạc! Túi ánh sáng đã đầy, cô bé chúc Mây bình an!';
  }
}

export function applyCreativeMoteBuff(
  color: MoteColor,
  player: PlayerState,
  buffs: CreativeBuffs
): void {
  if (color === 'red') {
    buffs.powerTimer = 8.0;
    buffs.lastNotice = 'Đom đóm Đỏ: Tăng sức mạnh Tỏa Sáng trong 8s!';
  } else if (color === 'blue') {
    buffs.speedTimer = 6.0;
    buffs.lastNotice = 'Đom đóm Xanh Dương: Tăng tốc độ di chuyển trong 6s!';
  } else if (color === 'green') {
    player.pulseCdTicks = 0;
    if (player.flames < TUNING.flames) {
      player.flames += 1;
      buffs.lastNotice = 'Đom đóm Xanh Lá: Hồi năng lượng Tỏa Sáng & +1 ngọn lửa!';
    } else if (player.carried < player.capacity) {
      player.carried += 1;
      buffs.lastNotice = 'Đom đóm Xanh Lá: Hồi ngay Tỏa Sáng & +1 ánh sáng!';
    } else {
      buffs.lastNotice = 'Đom đóm Xanh Lá: Hồi ngay năng lượng Tỏa Sáng!';
    }
  }
}
