import './style.css';
import { SoundEngine } from './audio/sound';
import { FollowCamera } from './render/camera';
import { EntityVisuals } from './render/entities';
import { IslandWorld } from './render/scene';
import { DT } from './sim/config';
import { Simulation } from './sim/engine';
import type { StepInput } from './sim/types';
import { HudController } from './ui/hud';

const SETTINGS_KEY = 'dao_den_long_settings_v1';

interface SavedSettings {
  volume: number;
  mouseSens: number;
}

function loadSettings(): SavedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedSettings>;
      return {
        volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.75,
        mouseSens:
          typeof parsed.mouseSens === 'number' ? Math.max(0.2, Math.min(2.0, parsed.mouseSens)) : 1.0,
      };
    }
  } catch {
    // ignore storage errors
  }
  return { volume: 0.75, mouseSens: 1.0 };
}

const settings = loadSettings();
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

let currentNight: 1 | 2 | 3 = 1;
let totalCampaignScore = 0;
let runSeed = 20261120;
let sim = new Simulation(runSeed, currentNight, {}, { creative: true });

const world = new IslandWorld(canvas, sim.map, sim.lanterns);
const entities = new EntityVisuals(world.scene);
const followCam = new FollowCamera();
const sound = new SoundEngine();
sound.setVolume(settings.volume);

let isStarted = false;
let endShown = false;
let lastCountdownSec = -1;
let prevWindTelegraph = false;

const heldKeys = new Set<string>();
let queuedJump = false;
let queuedInteract = false;
let queuedPulse = false;
let queuedDash = false;
let queuedPause = false;
let isDragging = false;
let lastPointerX = 0;

function prepareNight(night: 1 | 2 | 3, showIntroFirst: boolean): void {
  currentNight = night;
  runSeed = (runSeed + 1) | 0;
  sim = new Simulation(runSeed, currentNight, {}, { creative: true });
  world.loadNight(sim.map, sim.lanterns);
  entities.reset();
  followCam.reset();
  queuedJump = false;
  queuedInteract = false;
  queuedPulse = false;
  queuedDash = false;
  queuedPause = false;
  endShown = false;
  lastCountdownSec = -1;
  prevWindTelegraph = false;

  if (showIntroFirst) {
    isStarted = false;
    hud.showIntro(sim.map);
  } else {
    isStarted = true;
    sound.unlock();
    sound.startAmbient();
    hud.showPlaying();
  }
}

const hud = new HudController(
  {
    onPlayCampaign: () => {
      totalCampaignScore = 0;
      prepareNight(1, true);
    },
    onSelectNight: (night) => {
      totalCampaignScore = 0;
      prepareNight(night, true);
    },
    onIntroStart: () => {
      sound.unlock();
      sound.startAmbient();
      isStarted = true;
      hud.showPlaying();
    },
    onTogglePause: () => {
      if (isStarted && (sim.state === 'playing' || sim.state === 'paused')) {
        queuedPause = true;
      }
    },
    onRestartNight: () => {
      prepareNight(currentNight, false);
    },
    onNextNight: () => {
      const next = (Math.min(3, currentNight + 1) as 1 | 2 | 3);
      prepareNight(next, true);
    },
    onBackToMenu: () => {
      isStarted = false;
      sound.stopAmbient();
      hud.showStart();
    },
    onSettingsChange: (volume, mouseSens) => {
      settings.volume = volume;
      settings.mouseSens = mouseSens;
      sound.setVolume(volume);
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        // ignore storage errors
      }
    },
  },
  settings.volume,
  settings.mouseSens
);

hud.showStart();

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
    if (code === 'ShiftLeft' || code === 'ShiftRight') queuedDash = true;
    if (code === 'Escape' || code === 'KeyP') {
      if (isStarted && (sim.state === 'playing' || sim.state === 'paused')) {
        queuedPause = true;
      }
    }
    if (code === 'KeyH' && isStarted && sim.state === 'playing') {
      entities.triggerManualBirdGuide();
      sound.playBirdGuide();
      hud.showToast('Chim Giấy Đèn Lồng đang bay chỉ đường tới đèn gần nhất!', 2.6);
    }
    if (code === 'KeyM') {
      sound.unlock();
      sound.toggleMute();
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

canvas.addEventListener('pointerdown', (e) => {
  sound.unlock();
  isDragging = true;
  lastPointerX = e.clientX;
});

window.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - lastPointerX;
  lastPointerX = e.clientX;
  followCam.rotateBy(-dx * 0.35 * settings.mouseSens);
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
  if (heldKeys.has('KeyJ')) followCam.rotateBy(95 * settings.mouseSens * dt);
  if (heldKeys.has('KeyL')) followCam.rotateBy(-95 * settings.mouseSens * dt);

  let mx = 0;
  let mz = 0;
  if (heldKeys.has('KeyW') || heldKeys.has('ArrowUp')) mz += 1;
  if (heldKeys.has('KeyS') || heldKeys.has('ArrowDown')) mz -= 1;
  if (heldKeys.has('KeyD') || heldKeys.has('ArrowRight')) mx -= 1;
  if (heldKeys.has('KeyA') || heldKeys.has('ArrowLeft')) mx += 1;

  const input: StepInput = {
    move: [mx, mz],
    camYawDeg: followCam.yawDeg,
    jumpPressed: queuedJump,
    interactPressed: queuedInteract,
    pulsePressed: queuedPulse,
    dashPressed: queuedDash,
    pausePressed: queuedPause,
  };

  queuedJump = false;
  queuedInteract = false;
  queuedPulse = false;
  queuedDash = false;
  queuedPause = false;

  return input;
}

// FPS tracker & 60Hz loop
let lastTimeMs = performance.now();
let accumulator = 0;
let visualTimeS = 0;
let fpsFrames = 0;
let fpsLastSampleMs = performance.now();
let currentFps = 60;

function frame(nowMs: number): void {
  const frameDt = Math.min(0.1, Math.max(0, (nowMs - lastTimeMs) / 1000));
  lastTimeMs = nowMs;

  fpsFrames++;
  if (nowMs - fpsLastSampleMs >= 1000) {
    currentFps = Math.round((fpsFrames * 1000) / (nowMs - fpsLastSampleMs));
    fpsFrames = 0;
    fpsLastSampleMs = nowMs;
  }

  if (sim.state !== 'paused') {
    visualTimeS += frameDt;
  }

  if (isStarted && (sim.state === 'playing' || sim.state === 'paused')) {
    accumulator += frameDt;
    while (accumulator >= DT && (sim.state === 'playing' || sim.state === 'paused')) {
      const wasGirlFound = sim.wanderingGirl.found;
      const wasGrounded = sim.player.grounded;
      const stepInput = sampleRealtimeInput(DT);
      const events = sim.step(stepInput);
      accumulator -= DT;

      if (!wasGirlFound && sim.wanderingGirl.found) {
        sound.playGirlFound();
      }
      if (wasGrounded && !sim.player.grounded && sim.player.vel[1] > 0) {
        sound.playJump();
      }
      if (!prevWindTelegraph && sim.wind.telegraph) {
        sound.playWindWarn();
      }
      prevWindTelegraph = sim.wind.telegraph;

      for (const ev of events) {
        if (ev.name === 'paused') {
          hud.showPause();
        } else if (ev.name === 'resumed') {
          hud.hidePause();
        } else if (ev.name === 'mote_picked') {
          sound.playPickup(ev.data.carried);
        } else if (ev.name === 'deposit') {
          sound.playDeposit();
        } else if (ev.name === 'lantern_lit') {
          sound.playLanternLit();
          const lantern = sim.lanterns.find((l) => l.id === ev.data.lantern_id);
          if (lantern) hud.showToast(`Đã thắp sáng ${lantern.name}!`, 3.0);
        } else if (ev.name === 'pulse') {
          const empowered = sim.creativeBuffs.powerTimer > 0;
          entities.triggerPulseEffect(sim.player.pos, empowered);
          sound.playPulse(empowered);
        } else if (ev.name === 'dash') {
          sound.playDash();
        } else if (ev.name === 'charm_picked') {
          sound.playCharmPicked();
          hud.showToast('Nhặt được Bùa Gió! Chạy nhanh & Lướt không hồi chiêu!', 3.2);
        } else if (ev.name === 'drifter_steal') {
          sound.playDrifterSteal();
          hud.showToast(`Gió Lạc vừa cướp ${ev.data.amount} đom đóm! Dùng Tỏa Sáng để lấy lại!`, 3.2);
        } else if (ev.name === 'shade_spawned') {
          sound.playShadeSpawn();
        } else if (ev.name === 'player_hit') {
          sound.playHit();
          hud.showToast(
            ev.data.by === 'fall' ? 'Mây bị rơi khỏi đảo!' : 'Cẩn thận! Bóng Mực vừa chạm vào Mây!',
            2.4
          );
        } else if (ev.name === 'game_over') {
          sound.playGameOver(ev.data.result === 'won');
          sound.stopAmbient();
          if (ev.data.result === 'won') {
            totalCampaignScore += sim.score;
          }
        }
      }

      if (sim.state === 'playing') {
        const ceilSec = Math.ceil(sim.timeLeftS);
        if (ceilSec <= 10 && ceilSec > 0 && ceilSec !== lastCountdownSec) {
          lastCountdownSec = ceilSec;
          sound.playCountdownTick();
        }
      }
    }

    hud.update(sim, world, totalCampaignScore, frameDt);

    const finalState: string = sim.state;
    if ((finalState === 'won' || finalState === 'lost') && !endShown) {
      endShown = true;
      hud.showEnd(sim, totalCampaignScore);
    }
  } else if (!isStarted) {
    followCam.rotateBy(10 * frameDt);
  }

  world.syncLanterns(sim.lanterns, sim.wind, visualTimeS, frameDt);
  entities.sync(
    sim.player,
    sim.lanterns,
    sim.motes,
    sim.shades,
    sim.drifters,
    sim.charms,
    sim.wanderingGirl,
    sim.creativeBuffs,
    visualTimeS,
    frameDt
  );
  followCam.update(world.camera, sim.player.pos, frameDt);
  world.render();

  requestAnimationFrame(frame);
}

(window as unknown as { __DAO_DEN_LONG__?: () => unknown }).__DAO_DEN_LONG__ = () => ({
  started: isStarted,
  fps: currentFps,
  totalCampaignScore,
  snapshot: sim.getSnapshot(),
  girl: sim.wanderingGirl,
});

requestAnimationFrame(frame);
