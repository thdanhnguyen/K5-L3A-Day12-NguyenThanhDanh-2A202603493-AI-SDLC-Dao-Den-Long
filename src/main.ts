import './style.css';
import { SoundEngine } from './audio/sound';
import { FollowCamera } from './render/camera';
import { EntityVisuals } from './render/entities';
import { IslandWorld } from './render/scene';
import { DT } from './sim/config';
import { Simulation } from './sim/engine';
import type { StepInput } from './sim/types';
import { HudController } from './ui/hud';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

let runSeed = 20261120;
let sim = new Simulation(runSeed, 1, {}, { creative: true });

const world = new IslandWorld(canvas, sim.lanterns);
const entities = new EntityVisuals(world.scene);
const followCam = new FollowCamera();
const sound = new SoundEngine();

let isStarted = false;
let endShown = false;

const heldKeys = new Set<string>();
let queuedJump = false;
let queuedInteract = false;
let queuedPulse = false;
let isDragging = false;
let lastPointerX = 0;

function startNewRun(): void {
  sound.unlock();
  runSeed = (runSeed + 1) | 0;
  sim = new Simulation(runSeed, 1, {}, { creative: true });
  entities.reset();
  followCam.reset();
  queuedJump = false;
  queuedInteract = false;
  queuedPulse = false;
  isStarted = true;
  endShown = false;
  hud.showPlaying();
  hud.showToast('Chào Mây! Hãy nhặt đom đóm, tìm Bé Lạc trong rừng và thắp sáng 5 Đèn Lồng Lớn!', 4.5);
}

const hud = new HudController(
  startNewRun,
  startNewRun,
  () => {
    sound.unlock();
    hud.setMuted(sound.toggleMute());
  }
);

hud.showStart();

// Keyboard listeners
window.addEventListener('keydown', (e) => {
  const code = e.code;
  if (
    code === 'Space' ||
    code === 'ArrowUp' ||
    code === 'ArrowDown' ||
    code === 'ArrowLeft' ||
    code === 'ArrowRight'
  ) {
    e.preventDefault();
  }
  if (!e.repeat) {
    if (code === 'Space') queuedJump = true;
    if (code === 'KeyE') queuedInteract = true;
    if (code === 'KeyQ' || code === 'KeyF') queuedPulse = true;
    if (code === 'KeyH' && isStarted && sim.state === 'playing') {
      entities.triggerManualBirdGuide();
      sound.playBirdGuide();
      hud.showToast('Chim Giấy Đèn Lồng đang bay chỉ đường tới đèn gần nhất!', 2.8);
    }
    if (code === 'KeyM') {
      sound.unlock();
      hud.setMuted(sound.toggleMute());
    }
  }
  heldKeys.add(code);
});

window.addEventListener('keyup', (e) => {
  heldKeys.delete(e.code);
});

window.addEventListener('blur', () => {
  heldKeys.clear();
});

// Mouse drag & scroll wheel for 3D camera
canvas.addEventListener('pointerdown', (e) => {
  sound.unlock();
  isDragging = true;
  lastPointerX = e.clientX;
});

window.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - lastPointerX;
  lastPointerX = e.clientX;
  followCam.rotateBy(-dx * 0.35);
});

window.addEventListener('pointerup', () => {
  isDragging = false;
});

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    followCam.zoomBy(e.deltaY * 0.008);
  },
  { passive: false }
);

window.addEventListener('resize', () => {
  world.resize();
});

function sampleRealtimeInput(dt: number): StepInput {
  if (heldKeys.has('KeyJ')) followCam.rotateBy(95 * dt);
  if (heldKeys.has('KeyL')) followCam.rotateBy(-95 * dt);

  let mx = 0;
  let mz = 0;
  if (heldKeys.has('KeyW') || heldKeys.has('ArrowUp')) mz += 1;
  if (heldKeys.has('KeyS') || heldKeys.has('ArrowDown')) mz -= 1;
  // With camera behind Mây looking along forward=(sin θ, cos θ), screen-right corresponds to move_x = -1
  if (heldKeys.has('KeyD') || heldKeys.has('ArrowRight')) mx -= 1;
  if (heldKeys.has('KeyA') || heldKeys.has('ArrowLeft')) mx += 1;

  const input: StepInput = {
    move: [mx, mz],
    camYawDeg: followCam.yawDeg,
    jumpPressed: queuedJump,
    interactPressed: queuedInteract,
    pulsePressed: queuedPulse,
    dashPressed: false,
  };

  queuedJump = false;
  queuedInteract = false;
  queuedPulse = false;

  return input;
}

// Fixed 60Hz loop
let lastTimeMs = performance.now();
let accumulator = 0;
let visualTimeS = 0;

function frame(nowMs: number): void {
  const frameDt = Math.min(0.1, Math.max(0, (nowMs - lastTimeMs) / 1000));
  lastTimeMs = nowMs;
  visualTimeS += frameDt;

  if (isStarted && sim.state === 'playing') {
    accumulator += frameDt;
    while (accumulator >= DT && sim.state === 'playing') {
      const wasGirlFound = sim.wanderingGirl.found;
      const stepInput = sampleRealtimeInput(DT);
      const events = sim.step(stepInput);
      accumulator -= DT;

      if (!wasGirlFound && sim.wanderingGirl.found) {
        sound.playGirlFound();
      }

      for (const ev of events) {
        if (ev.name === 'mote_picked') {
          sound.playPickup(ev.data.carried);
        } else if (ev.name === 'deposit') {
          sound.playDeposit();
        } else if (ev.name === 'lantern_lit') {
          sound.playLanternLit();
          const lantern = sim.lanterns.find((l) => l.id === ev.data.lantern_id);
          if (lantern) {
            hud.showToast(`Đã thắp sáng ${lantern.name}! Đảo Bến ấm áp hơn rồi!`, 3.2);
          }
        } else if (ev.name === 'pulse') {
          const empowered = sim.creativeBuffs.powerTimer > 0;
          entities.triggerPulseEffect(sim.player.pos, empowered);
          sound.playPulse(empowered);
        } else if (ev.name === 'player_hit') {
          sound.playHit();
          hud.showToast('Cẩn thận! Bóng Mực vừa chạm vào Mây!', 2.2);
        } else if (ev.name === 'game_over') {
          sound.playGameOver(ev.data.result === 'won');
        }
      }
    }

    hud.update(sim, frameDt);

    if (sim.state !== 'playing' && !endShown) {
      endShown = true;
      hud.showEnd(sim);
    }
  } else {
    // Gentle camera showcase rotation on start/end screens
    if (!isStarted) {
      followCam.rotateBy(12 * frameDt);
    }
  }

  world.syncLanterns(sim.lanterns, visualTimeS, frameDt);
  entities.sync(
    sim.player,
    sim.lanterns,
    sim.motes,
    sim.shades,
    sim.wanderingGirl,
    sim.creativeBuffs,
    visualTimeS,
    frameDt
  );
  followCam.update(world.camera, sim.player.pos, frameDt);
  world.render();

  requestAnimationFrame(frame);
}

// Read-only diagnostic hook for browser verification
(window as unknown as { __DAO_DEN_LONG__?: () => unknown }).__DAO_DEN_LONG__ = () => ({
  started: isStarted,
  snapshot: sim.getSnapshot(),
  girl: sim.wanderingGirl,
  buffs: sim.creativeBuffs,
});

requestAnimationFrame(frame);
