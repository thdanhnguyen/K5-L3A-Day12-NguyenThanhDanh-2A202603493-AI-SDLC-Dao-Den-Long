import type { IslandWorld } from '../render/scene';
import { TICK_RATE, TUNING, distXZ } from '../sim/config';
import type { Simulation } from '../sim/engine';
import type { NightMapDef } from '../sim/maps';

export interface HudCallbacks {
  onPlayCampaign: () => void;
  onSelectNight: (night: 1 | 2 | 3) => void;
  onIntroStart: () => void;
  onTogglePause: () => void;
  onRestartNight: () => void;
  onNextNight: () => void;
  onBackToMenu: () => void;
  onSettingsChange: (volume: number, mouseSens: number, colorblind: boolean) => void;
}

export class HudController {
  private readonly hudEl = document.getElementById('hud')!;
  private readonly startScreen = document.getElementById('start-screen')!;
  private readonly introScreen = document.getElementById('intro-screen')!;
  private readonly pauseScreen = document.getElementById('pause-screen')!;
  private readonly settingsScreen = document.getElementById('settings-screen')!;
  private readonly endScreen = document.getElementById('end-screen')!;

  private readonly flamesEl = document.getElementById('hud-flames')!;
  private readonly nightNameEl = document.getElementById('hud-night-name')!;
  private readonly girlEl = document.getElementById('hud-girl')!;
  private readonly timerEl = document.getElementById('hud-timer')!;
  private readonly windBadgeEl = document.getElementById('hud-wind-badge')!;
  private readonly lanternsEl = document.getElementById('hud-lanterns')!;
  private readonly scoreEl = document.getElementById('hud-score')!;
  private readonly buffsEl = document.getElementById('hud-buffs')!;
  private readonly toastEl = document.getElementById('hud-toast')!;
  private readonly arrowEl = document.getElementById('offscreen-arrow')!;
  private readonly promptEl = document.getElementById('hud-prompt')!;
  private readonly carriedEl = document.getElementById('hud-carried')!;
  private readonly moteSlotsEl = document.getElementById('hud-mote-slots')!;
  private readonly dashCdEl = document.getElementById('hud-dash-cd')!;
  private readonly pulseCdEl = document.getElementById('hud-pulse-cd')!;

  private readonly introBadge = document.getElementById('intro-badge')!;
  private readonly introTitle = document.getElementById('intro-title')!;
  private readonly introQuote = document.getElementById('intro-quote')!;

  private readonly endBadge = document.getElementById('end-badge')!;
  private readonly endTitle = document.getElementById('end-title')!;
  private readonly endReason = document.getElementById('end-reason')!;
  private readonly endBreakdown = document.getElementById('end-breakdown')!;
  private readonly btnNextNight = document.getElementById('btn-next-night')!;

  private readonly volInput = document.getElementById('input-volume') as HTMLInputElement;
  private readonly sensInput = document.getElementById('input-sens') as HTMLInputElement;
  private readonly cbInput = document.getElementById('input-colorblind') as HTMLInputElement;
  private readonly volVal = document.getElementById('val-volume')!;
  private readonly sensVal = document.getElementById('val-sens')!;

  private settingsReturnTo: 'start' | 'pause' = 'start';
  private toastTimer = 0;

  constructor(callbacks: HudCallbacks, initialVol: number, initialSens: number, initialColorblind: boolean) {
    this.volInput.value = String(Math.round(initialVol * 100));
    this.sensInput.value = String(Math.round(initialSens * 100));
    this.cbInput.checked = initialColorblind;
    this.volVal.textContent = `${this.volInput.value}%`;
    this.sensVal.textContent = `${(Number(this.sensInput.value) / 100).toFixed(1)}×`;

    document.getElementById('btn-play-campaign')!.addEventListener('click', callbacks.onPlayCampaign);
    document.querySelectorAll('.night-pick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = Number((btn as HTMLElement).dataset.night) as 1 | 2 | 3;
        callbacks.onSelectNight(n);
      });
    });

    document.getElementById('btn-intro-go')!.addEventListener('click', callbacks.onIntroStart);
    document.getElementById('btn-pause-hud')!.addEventListener('click', callbacks.onTogglePause);
    document.getElementById('btn-resume')!.addEventListener('click', callbacks.onTogglePause);
    document.getElementById('btn-restart-night')!.addEventListener('click', callbacks.onRestartNight);
    document.getElementById('btn-replay')!.addEventListener('click', callbacks.onRestartNight);
    document.getElementById('btn-next-night')!.addEventListener('click', callbacks.onNextNight);
    document.getElementById('btn-back-menu')!.addEventListener('click', callbacks.onBackToMenu);
    document.getElementById('btn-end-menu')!.addEventListener('click', callbacks.onBackToMenu);

    document.getElementById('btn-open-settings-main')!.addEventListener('click', () => {
      this.settingsReturnTo = 'start';
      this.startScreen.classList.add('hidden');
      this.settingsScreen.classList.remove('hidden');
    });
    document.getElementById('btn-pause-settings')!.addEventListener('click', () => {
      this.settingsReturnTo = 'pause';
      this.pauseScreen.classList.add('hidden');
      this.settingsScreen.classList.remove('hidden');
    });
    document.getElementById('btn-close-settings')!.addEventListener('click', () => {
      this.settingsScreen.classList.add('hidden');
      if (this.settingsReturnTo === 'start') {
        this.startScreen.classList.remove('hidden');
      } else {
        this.pauseScreen.classList.remove('hidden');
      }
    });

    const emitSettings = () => {
      const v = Number(this.volInput.value) / 100;
      const s = Number(this.sensInput.value) / 100;
      const cb = this.cbInput.checked;
      this.volVal.textContent = `${this.volInput.value}%`;
      this.sensVal.textContent = `${s.toFixed(1)}×`;
      callbacks.onSettingsChange(v, s, cb);
    };
    this.volInput.addEventListener('input', emitSettings);
    this.sensInput.addEventListener('input', emitSettings);
    this.cbInput.addEventListener('change', emitSettings);
  }

  private hideAllScreens(): void {
    this.startScreen.classList.add('hidden');
    this.introScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.settingsScreen.classList.add('hidden');
    this.endScreen.classList.add('hidden');
    this.hudEl.classList.add('hidden');
  }

  showStart(): void {
    this.hideAllScreens();
    this.startScreen.classList.remove('hidden');
  }

  showIntro(map: NightMapDef): void {
    this.hideAllScreens();
    this.introBadge.textContent = `ĐÊM ${map.night}`;
    this.introTitle.textContent = map.name;
    this.introQuote.textContent = map.elderQuote;
    this.introScreen.classList.remove('hidden');
  }

  showPlaying(): void {
    this.hideAllScreens();
    this.hudEl.classList.remove('hidden');
  }

  showPause(): void {
    this.pauseScreen.classList.remove('hidden');
  }

  hidePause(): void {
    this.pauseScreen.classList.add('hidden');
    this.settingsScreen.classList.add('hidden');
  }

  showToast(text: string, durationS = 3.2): void {
    this.toastTimer = durationS;
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
  }

  update(sim: Simulation, world: IslandWorld, totalCampaignScore: number, dt: number): void {
    if (sim.creativeBuffs.lastNotice) {
      this.showToast(sim.creativeBuffs.lastNotice, 3.8);
      sim.creativeBuffs.lastNotice = null;
    }
    if (this.toastTimer > 0) {
      this.toastTimer = Math.max(0, this.toastTimer - dt);
      if (this.toastTimer === 0) this.toastEl.classList.add('hidden');
    }

    // Flames
    let flamesHtml = '';
    for (let i = 0; i < TUNING.flames; i++) {
      flamesHtml += `<span class="flame-pip ${i < sim.player.flames ? '' : 'lost'}"></span>`;
    }
    this.flamesEl.innerHTML = flamesHtml;

    this.nightNameEl.textContent = `Đêm ${sim.night} · ${sim.map.name}`;
    this.girlEl.textContent = sim.wanderingGirl.found ? 'Bé Lạc: Đã cứu (+5)' : 'Bé Lạc: Trong rừng';

    // Timer mm:ss
    const secs = Math.ceil(sim.timeLeftS);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    this.timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    this.timerEl.classList.toggle('urgent', secs <= 30);

    if (sim.wind.enabled && (sim.wind.telegraph || sim.wind.active)) {
      this.windBadgeEl.textContent = sim.wind.active ? 'Gió mạnh đang thổi!' : 'Gió mạnh sắp tới!';
      this.windBadgeEl.classList.remove('hidden');
    } else {
      this.windBadgeEl.classList.add('hidden');
    }

    const litCount = sim.lanterns.filter((l) => l.lit).length;
    const needed = Math.ceil(TUNING.win_ratio * sim.lanterns.length);
    this.lanternsEl.textContent = `${litCount} / ${sim.lanterns.length} (cần ≥ ${needed})`;
    this.scoreEl.textContent = String(totalCampaignScore + sim.score);

    // Dynamic mote bar (10..20 slots)
    this.carriedEl.textContent = `${sim.player.carried} / ${sim.player.capacity}`;
    let slotsHtml = '';
    for (let i = 0; i < sim.player.capacity; i++) {
      slotsHtml += `<span class="mote-slot ${i < sim.player.carried ? 'filled' : ''}"></span>`;
    }
    this.moteSlotsEl.innerHTML = slotsHtml;

    // Dash & Pulse cooldowns
    const dashCdS = sim.player.dashCdTicks / TICK_RATE;
    if (dashCdS > 0) {
      this.dashCdEl.textContent = `${dashCdS.toFixed(1)}s`;
      this.dashCdEl.classList.remove('ready');
    } else {
      this.dashCdEl.textContent = 'Sẵn sàng';
      this.dashCdEl.classList.add('ready');
    }

    const pulseCdS = sim.player.pulseCdTicks / TICK_RATE;
    if (pulseCdS > 0) {
      this.pulseCdEl.textContent = `${pulseCdS.toFixed(1)}s`;
      this.pulseCdEl.classList.remove('ready');
    } else if (sim.player.carried < TUNING.pulse_cost) {
      this.pulseCdEl.textContent = `Cần ${TUNING.pulse_cost} đom đóm`;
      this.pulseCdEl.classList.remove('ready');
    } else {
      this.pulseCdEl.textContent = 'Sẵn sàng';
      this.pulseCdEl.classList.add('ready');
    }

    // Buff badges
    const badges: string[] = [];
    if (sim.player.charmTicks > 0) {
      badges.push(`<span class="buff-badge charm">Bùa Gió ${(sim.player.charmTicks / TICK_RATE).toFixed(1)}s</span>`);
    }
    if (sim.creativeBuffs.powerTimer > 0) {
      badges.push(`<span class="buff-badge power">Tỏa Sáng Mạnh ${sim.creativeBuffs.powerTimer.toFixed(1)}s</span>`);
    }
    if (sim.creativeBuffs.speedTimer > 0) {
      badges.push(`<span class="buff-badge speed">Tăng Tốc ${sim.creativeBuffs.speedTimer.toFixed(1)}s</span>`);
    }
    this.buffsEl.innerHTML = badges.join('');

    // Interact prompt (unlit OR lit-below-100-fuel)
    const nearLantern = sim.lanterns.find(
      (l) =>
        (!l.lit || l.fuelUnits < TUNING.fuel_max * TICK_RATE) &&
        distXZ(sim.player.pos, l.pos) <= TUNING.interact_radius &&
        Math.abs(sim.player.pos[1] - l.pos[1]) <= 2.5
    );
    if (nearLantern) {
      if (!nearLantern.lit) {
        const cost = nearLantern.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
        this.promptEl.textContent = `E — Nạp ánh sáng (${nearLantern.deposited}/${cost})`;
      } else {
        const fuelPct = Math.round(nearLantern.fuelUnits / TICK_RATE);
        this.promptEl.textContent = `E — Châm dầu đèn (còn ${fuelPct}%)`;
      }
      this.promptEl.classList.remove('hidden');
    } else {
      this.promptEl.classList.add('hidden');
    }

    // Off-screen arrow to nearest unlit lantern
    let nearestUnlit = null as (typeof sim.lanterns)[number] | null;
    let bestD = Infinity;
    for (const l of sim.lanterns) {
      if (l.lit) continue;
      const d = distXZ(sim.player.pos, l.pos);
      if (d < bestD) {
        bestD = d;
        nearestUnlit = l;
      }
    }

    if (nearestUnlit) {
      const proj = world.projectToScreen(nearestUnlit.pos);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const margin = 44;
      const onScreen =
        proj.inFront && proj.x >= margin && proj.x <= w - margin && proj.y >= margin && proj.y <= h - margin;

      if (onScreen) {
        this.arrowEl.classList.add('hidden');
      } else {
        const cx = w / 2;
        const cy = h / 2;
        let dx = proj.x - cx;
        let dy = proj.y - cy;
        if (!proj.inFront) {
          dx = -dx;
          dy = -dy;
        }
        const angle = Math.atan2(dy, dx);
        const rx = w / 2 - margin;
        const ry = h / 2 - margin;
        const scale = Math.min(
          rx / Math.max(1e-4, Math.abs(Math.cos(angle))),
          ry / Math.max(1e-4, Math.abs(Math.sin(angle)))
        );
        this.arrowEl.style.left = `${cx + Math.cos(angle) * scale}px`;
        this.arrowEl.style.top = `${cy + Math.sin(angle) * scale}px`;
        this.arrowEl.style.transform = `translate(-50%, -50%) rotate(${(angle * 180) / Math.PI + 90}deg)`;
        this.arrowEl.classList.remove('hidden');
      }
    } else {
      this.arrowEl.classList.add('hidden');
    }
  }

  showEnd(sim: Simulation, totalCampaignScore: number): void {
    this.hideAllScreens();
    this.endScreen.classList.remove('hidden');

    const won = sim.state === 'won';
    const isFinalDawn = won && sim.night === 3;

    if (isFinalDawn) {
      this.endBadge.textContent = 'BÌNH MINH RẠNG RỠ';
      this.endTitle.textContent = 'Ba Hòn Đảo Đã Sáng!';
      this.endReason.textContent =
        'Mây đã thắp sáng trọn vẹn Đảo Bến, Đảo Cau và Đảo Chuông trước khi mặt trời ló rạng!';
    } else if (won) {
      this.endBadge.textContent = `HOÀN THÀNH ĐÊM ${sim.night}`;
      this.endTitle.textContent = `${sim.map.name} Rực Sáng!`;
      this.endReason.textContent =
        'Các Đèn Lồng Lớn đã sáng bừng, sẵn sàng bước sang hòn đảo tiếp theo.';
    } else {
      this.endBadge.textContent = `THẤT BẠI ĐÊM ${sim.night}`;
      this.endTitle.textContent = 'Ánh Sáng Đã Tắt...';
      this.endReason.textContent =
        sim.winOrLoseReason === 'no_flames'
          ? 'Mây đã mất hết Ngọn Lửa sinh mệnh.'
          : 'Bình minh đã lên khi các Đèn Lồng Lớn chưa kịp thắp sáng đủ.';
    }

    this.btnNextNight.classList.toggle('hidden', !won || sim.night >= 3);

    let dawnLanternBonus = 0;
    if (won) {
      for (const l of sim.lanterns) {
        if (l.lit) dawnLanternBonus += 50 + Math.floor(l.fuelUnits / TICK_RATE);
      }
    }
    const flameBonus = won ? sim.player.flames * TUNING.score.per_flame_left : 0;
    const actionScore = sim.score - dawnLanternBonus - flameBonus;
    const litCount = sim.lanterns.filter((l) => l.lit).length;

    this.endBreakdown.innerHTML = `
      <div class="score-line"><span>Đèn sáng lúc bình minh</span><span>${litCount} / ${sim.lanterns.length}</span></div>
      <div class="score-line"><span>Điểm hành động (nạp/thắp/pulse)</span><span>${actionScore}</span></div>
      <div class="score-line"><span>Thưởng đèn giữ sáng bình minh</span><span>+${dawnLanternBonus}</span></div>
      <div class="score-line"><span>Thưởng Ngọn Lửa (${sim.player.flames})</span><span>+${flameBonus}</span></div>
      <div class="score-line total"><span>Tổng điểm hành trình</span><span>${totalCampaignScore + (won ? sim.score : 0)}</span></div>
    `;
  }
}
