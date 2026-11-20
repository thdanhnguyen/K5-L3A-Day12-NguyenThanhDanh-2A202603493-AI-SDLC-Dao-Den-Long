import { TUNING, round3 } from './config';
import type { Vec3 } from './types';

export interface JumpPadDef {
  id: string;
  pos: Vec3;
  radius: number;
  vy: number;
  vh: number;
  dir: [number, number];
}

export interface RampDef {
  angleDeg: number;
  rStart: number;
  rEnd: number;
  yStart: number;
  yEnd: number;
  halfWidth: number;
}

export interface NightMapDef {
  night: 1 | 2 | 3;
  name: string;
  elderQuote: string;
  durationS: number;
  shadeSpeed: number;
  shadeIntervalTicks: number;
  maxShades: number;
  maxDrifters: number;
  windEnabled: boolean;
  lanterns: Array<{ id: string; name: string; pos: Vec3 }>;
  moteSpawns: Vec3[];
  shadeSpawns: Vec3[];
  charms: Array<{ id: string; pos: Vec3 }>;
  jumpPads: JumpPadDef[];
  ramps: RampDef[];
}

function polarXZ(r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [round3(r * Math.cos(rad)), round3(r * Math.sin(rad))];
}

function buildNight1Map(): NightMapDef {
  const moteSpawns: Vec3[] = [];
  for (let i = 0; i < 8; i++) {
    const [x, z] = polarXZ(12, i * 45);
    moteSpawns.push([x, 0, z]);
  }
  for (let i = 0; i < 16; i++) {
    const [x, z] = polarXZ(33, i * 22.5);
    moteSpawns.push([x, 0, z]);
  }

  const shadeSpawns: Vec3[] = [];
  for (let i = 0; i < 12; i++) {
    const [x, z] = polarXZ(37, 15 + i * 30);
    shadeSpawns.push([x, 0, z]);
  }

  return {
    night: 1,
    name: 'Đảo Bến',
    elderQuote: 'Ông Đăng: "Sương đen đã phủ kín bến thuyền. Hãy thắp lại 5 ngọn đèn để giữ lối về."',
    durationS: TUNING.night1_duration_s,
    shadeSpeed: TUNING.shade_speed,
    shadeIntervalTicks: 480,
    maxShades: 6,
    maxDrifters: 0,
    windEnabled: false,
    lanterns: [
      { id: 'L1', name: 'Đèn Bến Nam', pos: [0, 0, 25] },
      { id: 'L2', name: 'Đèn Rừng Trúc', pos: [23.8, 0, 7.7] },
      { id: 'L3', name: 'Đèn Mũi Đông', pos: [14.7, 0, -20.2] },
      { id: 'L4', name: 'Đèn Vịnh Tây', pos: [-14.7, 0, -20.2] },
      { id: 'L5', name: 'Đèn Gió Mây', pos: [-23.8, 0, 7.7] },
    ],
    moteSpawns,
    shadeSpawns,
    charms: [],
    jumpPads: [],
    ramps: [],
  };
}

function buildNight2Map(): NightMapDef {
  const moteSpawns: Vec3[] = [];
  const shadeSpawns: Vec3[] = [];
  for (const cx of [0, 70]) {
    for (let i = 0; i < 4; i++) {
      const [x, z] = polarXZ(10, i * 90);
      moteSpawns.push([cx + x, 0, z]);
    }
    for (let i = 0; i < 8; i++) {
      const [x, z] = polarXZ(22, i * 45);
      moteSpawns.push([cx + x, 0, z]);
    }
    for (let i = 0; i < 8; i++) {
      const [x, z] = polarXZ(26, 22.5 + i * 45);
      shadeSpawns.push([cx + x, 0, z]);
    }
  }

  const d1x = 70 - 20;
  const d1z = 0 - 18;
  const d1Len = Math.hypot(d1x, d1z);

  const d2x = 0 - 50;
  const d2z = 0 - -18;
  const d2Len = Math.hypot(d2x, d2z);

  return {
    night: 2,
    name: 'Đảo Cau',
    elderQuote:
      'Ông Đăng: "Cầu tre nối hai bờ đảo Cau không có lan can, hãy coi chừng gió lạc và bước chân mình!"',
    durationS: TUNING.night2_duration_s,
    shadeSpeed: TUNING.shade_speed,
    shadeIntervalTicks: 420,
    maxShades: 8,
    maxDrifters: 2,
    windEnabled: false,
    lanterns: [
      { id: 'L1', name: 'Đèn Bờ Tây', pos: [0, 0, 20] },
      { id: 'L2', name: 'Đèn Rặng Cau Đông', pos: [17, 0, -10] },
      { id: 'L3', name: 'Đèn Vách Đá Tây', pos: [-17, 0, -10] },
      { id: 'L4', name: 'Đèn Đồi Cau', pos: [70, 0, 20] },
      { id: 'L5', name: 'Đèn Mũi Nam', pos: [87, 0, -10] },
      { id: 'L6', name: 'Đèn Đầu Cầu Đông', pos: [53, 0, -10] },
    ],
    moteSpawns,
    shadeSpawns,
    charms: [{ id: 'C1', pos: [35, 0, 0] }],
    jumpPads: [
      {
        id: 'JP1',
        pos: [20, 0, 18],
        radius: 1.0,
        vy: 14,
        vh: 24,
        dir: [d1x / d1Len, d1z / d1Len],
      },
      {
        id: 'JP2',
        pos: [50, 0, -18],
        radius: 1.0,
        vy: 14,
        vh: 24,
        dir: [d2x / d2Len, d2z / d2Len],
      },
    ],
    ramps: [],
  };
}

function buildNight3Map(): NightMapDef {
  const moteSpawns: Vec3[] = [];
  for (let i = 0; i < 18; i++) {
    const [x, z] = polarXZ(34, i * 20);
    moteSpawns.push([x, 0, z]);
  }
  for (let i = 0; i < 8; i++) {
    const [x, z] = polarXZ(18, 20 + i * 20);
    moteSpawns.push([x, 3, z]);
  }
  for (const deg of [45, 135, 225, 315]) {
    const [x, z] = polarXZ(5, deg);
    moteSpawns.push([x, 6, z]);
  }

  const shadeSpawns: Vec3[] = [];
  for (let i = 0; i < 16; i++) {
    const [x, z] = polarXZ(43, i * 22.5);
    shadeSpawns.push([x, 0, z]);
  }

  return {
    night: 3,
    name: 'Đảo Chuông',
    elderQuote:
      'Ông Đăng: "Đêm cuối rồi, Mây ơi. Gió lớn sắp nổi lên quanh Tháp Chuông — hãy thắp sáng cả ba tầng đảo!"',
    durationS: TUNING.night3_duration_s,
    shadeSpeed: 4.5,
    shadeIntervalTicks: 360,
    maxShades: 10,
    maxDrifters: 2,
    windEnabled: true,
    lanterns: [
      { id: 'L1', name: 'Đèn Tháp Chuông', pos: [0, 6, 6] },
      { id: 'L2', name: 'Đèn Vành Đông', pos: [18, 3, 10] },
      { id: 'L3', name: 'Đèn Vành Tây', pos: [-18, 3, 10] },
      { id: 'L4', name: 'Đèn Bãi Đông', pos: [35, 0, -10] },
      { id: 'L5', name: 'Đèn Bãi Tây', pos: [-35, 0, -10] },
      { id: 'L6', name: 'Đèn Ghềnh Nam', pos: [20, 0, -35] },
      { id: 'L7', name: 'Đèn Ghềnh Bắc', pos: [-20, 0, -35] },
    ],
    moteSpawns,
    shadeSpawns,
    charms: [
      { id: 'C1', pos: [30, 0, 25] },
      { id: 'C2', pos: [-30, 0, 25] },
    ],
    jumpPads: [
      {
        id: 'JP1',
        pos: [0, 3, 13],
        radius: 1.0,
        vy: 12,
        vh: 8,
        dir: [0, -1],
      },
    ],
    ramps: [
      { angleDeg: 30, rStart: 30, rEnd: 24, yStart: 0, yEnd: 3, halfWidth: 1.5 },
      { angleDeg: 150, rStart: 30, rEnd: 24, yStart: 0, yEnd: 3, halfWidth: 1.5 },
    ],
  };
}

const NIGHT_MAPS: Record<1 | 2 | 3, NightMapDef> = {
  1: buildNight1Map(),
  2: buildNight2Map(),
  3: buildNight3Map(),
};

export function getNightMap(night: 1 | 2 | 3): NightMapDef {
  return NIGHT_MAPS[night];
}

export function getSurfacesAt(map: NightMapDef, x: number, z: number): number[] {
  const surfaces: number[] = [];

  if (map.night === 1) {
    if (Math.hypot(x, z) <= 40) surfaces.push(0);
    return surfaces;
  }

  if (map.night === 2) {
    const onA = Math.hypot(x, z) <= 28;
    const onB = Math.hypot(x - 70, z) <= 28;
    const onBridge = x >= 26 && x <= 44 && Math.abs(z) <= 2;
    if (onA || onB || onBridge) surfaces.push(0);
    return surfaces;
  }

  // Night 3: Tier 0 (R=45, Y=0), Tier 1 (r in [12, 24], z > 0, Y=3), Tier 2 (R=8, Y=6), 2 ramps
  const r = Math.hypot(x, z);
  if (r <= 45) surfaces.push(0);
  if (r >= 12 && r <= 24 && z > 0) surfaces.push(3);
  if (r <= 8) surfaces.push(6);

  for (const ramp of map.ramps) {
    const rad = (ramp.angleDeg * Math.PI) / 180;
    const ux = Math.cos(rad);
    const uz = Math.sin(rad);
    const along = x * ux + z * uz;
    const perp = Math.abs(-x * uz + z * ux);
    if (along >= ramp.rEnd && along <= ramp.rStart && perp <= ramp.halfWidth) {
      const t = (ramp.rStart - along) / (ramp.rStart - ramp.rEnd);
      surfaces.push(ramp.yStart + t * (ramp.yEnd - ramp.yStart));
    }
  }

  return surfaces;
}

export function isOnWalkableGround(map: NightMapDef, x: number, z: number): boolean {
  return getSurfacesAt(map, x, z).length > 0;
}

export function getGroundHeightAt(map: NightMapDef, x: number, z: number): number {
  const surfaces = getSurfacesAt(map, x, z);
  if (surfaces.length === 0) return -Infinity;
  return Math.max(...surfaces);
}

export function getReachableGroundY(map: NightMapDef, x: number, z: number, currentY: number): number {
  const surfaces = getSurfacesAt(map, x, z);
  let best = -Infinity;
  for (const sy of surfaces) {
    if (sy <= currentY + 0.55 && sy > best) {
      best = sy;
    }
  }
  return best;
}

export function resolveHorizontalObstacles(
  map: NightMapDef,
  oldX: number,
  oldZ: number,
  newX: number,
  newZ: number,
  y: number
): [number, number, boolean] {
  if (map.night !== 3) {
    return [newX, newZ, false];
  }

  let rx = newX;
  let rz = newZ;
  let blocked = false;

  // 1. Bell Tower solid cylinder at center: R = 2m, Y in [6, 14]
  if (y >= 5.0 && y < 14.0) {
    const r = Math.hypot(rx, rz);
    if (r < 2.0) {
      blocked = true;
      if (r > 1e-6) {
        rx = (rx / r) * 2.01;
        rz = (rz / r) * 2.01;
      } else {
        rx = 2.01;
        rz = 0;
      }
    }
  }

  // 2. Vertical cliffs: cannot walk laterally onto a surface higher than y + 0.55
  const surfaces = getSurfacesAt(map, rx, rz);
  const oldSurfaces = getSurfacesAt(map, oldX, oldZ);
  const highestNew = surfaces.length > 0 ? Math.max(...surfaces) : -Infinity;
  const highestOld = oldSurfaces.length > 0 ? Math.max(...oldSurfaces) : -Infinity;
  const hasLowerReachable = surfaces.some((s) => s <= y + 0.55);

  if (highestNew > y + 0.55 && highestNew > highestOld + 0.55 && !hasLowerReachable) {
    return [oldX, oldZ, true];
  }

  // Also block stepping horizontally from Tier 0 into Tier 1 wall (r in [12,24], z > 0) when y < 2.45 unless on ramp
  if (y < 2.45) {
    const rNew = Math.hypot(rx, rz);
    if (rNew >= 12 && rNew <= 24 && rz > 0) {
      const onRamp = map.ramps.some((ramp) => {
        const rad = (ramp.angleDeg * Math.PI) / 180;
        const ux = Math.cos(rad);
        const uz = Math.sin(rad);
        const along = rx * ux + rz * uz;
        const perp = Math.abs(-rx * uz + rz * ux);
        return along >= ramp.rEnd && along <= ramp.rStart && perp <= ramp.halfWidth;
      });
      if (!onRamp) {
        return [oldX, oldZ, true];
      }
    }
    if (rNew <= 8 && y >= 2.5 && y < 5.45) {
      // Tier 2 cliff when on Tier 1 level
      return [oldX, oldZ, true];
    }
  } else if (y < 5.45) {
    // On Tier 1 (Y=3): block walking straight into Tier 2 vertical cliff (r <= 8)
    const rNew = Math.hypot(rx, rz);
    if (rNew <= 8) {
      return [oldX, oldZ, true];
    }
  }

  return [rx, rz, blocked];
}
