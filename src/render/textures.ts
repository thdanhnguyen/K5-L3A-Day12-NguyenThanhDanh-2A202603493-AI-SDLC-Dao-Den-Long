import * as THREE from 'three';

function makeDeterministicRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createGlowSpriteTexture(
  innerColor = 'rgba(255, 245, 200, 1)',
  midColor = 'rgba(255, 196, 86, 0.55)',
  outerColor = 'rgba(255, 160, 60, 0)'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(0.35, midColor);
  grad.addColorStop(1, outerColor);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createIslandGroundTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = makeDeterministicRand(9001);

  const cx = size / 2;
  const cy = size / 2;

  // Base lush moonlit meadow gradient
  const baseGrad = ctx.createRadialGradient(cx, cy, 24, cx, cy, size * 0.5);
  baseGrad.addColorStop(0, '#365c59');
  baseGrad.addColorStop(0.55, '#2b4a52');
  baseGrad.addColorStop(0.88, '#283c4c');
  baseGrad.addColorStop(1, '#3b3f57');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Soft mossy patches & dappled meadow shading
  for (let i = 0; i < 240; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = Math.sqrt(rand()) * (size * 0.45);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const r = 6 + rand() * 20;
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(84, 145, 126, 0.14)'
        : i % 3 === 1
          ? 'rgba(32, 54, 72, 0.16)'
          : 'rgba(130, 168, 122, 0.1)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Painted stone concentric ring around lantern orbit radius (22/40 * 256 ≈ 141px)
  ctx.strokeStyle = 'rgba(176, 166, 200, 0.16)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, 141, 0, Math.PI * 2);
  ctx.stroke();

  // Tiny painted wildflower & clover flecks
  for (let i = 0; i < 320; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 28 + rand() * (size * 0.42);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    ctx.fillStyle =
      i % 4 === 0
        ? 'rgba(255, 218, 125, 0.45)'
        : i % 4 === 1
          ? 'rgba(198, 178, 255, 0.4)'
          : 'rgba(130, 224, 175, 0.32)';
    ctx.fillRect(x, y, 2.2, 2.2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createNonLaTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#efd083';
  ctx.fillRect(0, 0, size, size);

  // Fine woven bamboo horizontal rings
  for (let y = 0; y < size; y += 6) {
    ctx.fillStyle = y % 12 === 0 ? 'rgba(178, 126, 48, 0.28)' : 'rgba(255, 244, 205, 0.28)';
    ctx.fillRect(0, y, size, 2.5);
  }

  // Subtle vertical ribs
  for (let x = 0; x < size; x += 10) {
    ctx.fillStyle = 'rgba(160, 110, 40, 0.14)';
    ctx.fillRect(x, 0, 2, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
