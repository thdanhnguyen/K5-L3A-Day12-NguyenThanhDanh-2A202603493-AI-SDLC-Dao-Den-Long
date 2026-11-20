import * as THREE from 'three';

function makeDeterministicRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createGlowSpriteTexture(
  innerColor = 'rgba(255, 246, 194, 1)',
  midColor = 'rgba(255, 229, 138, 0.55)',
  outerColor = 'rgba(255, 179, 71, 0)'
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

  // Standardized grass (#2F5D50) transitioning to sand (#C9B48A) at the shore rim
  const baseGrad = ctx.createRadialGradient(cx, cy, 24, cx, cy, size * 0.5);
  baseGrad.addColorStop(0, '#346658');
  baseGrad.addColorStop(0.74, '#2F5D50');
  baseGrad.addColorStop(0.92, '#7c896a');
  baseGrad.addColorStop(1, '#C9B48A');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 220; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = Math.sqrt(rand()) * (size * 0.43);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const r = 6 + rand() * 18;
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(65, 118, 98, 0.16)' : 'rgba(28, 62, 54, 0.16)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 280; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 28 + rand() * (size * 0.4);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    ctx.fillStyle =
      i % 3 === 0 ? 'rgba(255, 229, 138, 0.42)' : 'rgba(201, 180, 138, 0.35)';
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

  for (let y = 0; y < size; y += 6) {
    ctx.fillStyle = y % 12 === 0 ? 'rgba(178, 126, 48, 0.28)' : 'rgba(255, 244, 205, 0.28)';
    ctx.fillRect(0, y, size, 2.5);
  }

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
