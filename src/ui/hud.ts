import { TUNING, distXZ } from '../sim/config';
import type { Simulation } from '../sim/engine';

export class HudController {
  private readonly hudEl = document.getElementById('hud')!;
  private readonly startScreen = document.getElementById('start-screen')!;
  private readonly endScreen = document.getElementById('end-screen')!;
  private readonly flamesEl = document.getElementById('hud-flames')!;
  private readonly carriedEl = document.getElementById('hud-carried')!;
  private readonly lanternsEl = document.getElementById('hud-lanterns')!;
  private readonly timerEl = document.getElementById('hud-timer')!;
  private readonly pillsEl = document.getElementById('hud-lantern-pills')!;
  private readonly scoreEl = document.getElementById('hud-score')!;
  private readonly pulseEl = document.getElementById('hud-pulse')!;
  private readonly girlEl = document.getElementById('hud-girl')!;
  private readonly buffsEl = document.getElementById('hud-buffs')!;
  private readonly toastEl = document.getElementById('hud-toast')!;
  private readonly promptEl = document.getElementById('hud-prompt')!;
  private readonly btnMute = document.getElementById('btn-mute')!;
  private readonly endBadge = document.getElementById('end-badge')!;
  private readonly endTitle = document.getElementById('end-title')!;
  private readonly endReason = document.getElementById('end-reason')!;
  private readonly endBreakdown = document.getElementById('end-breakdown')!;

  private toastTimer = 0;
  private lastToastText = '';

  constructor(onStart: () => void, onReplay: () => void, onToggleMute: () => void) {
    document.getElementById('btn-start')!.addEventListener('click', onStart);
    document.getElementById('btn-replay')!.addEventListener('click', onReplay);
    this.btnMute.addEventListener('click', onToggleMute);
  }

  showStart(): void {
    this.startScreen.classList.remove('hidden');
    this.hudEl.classList.add('hidden');
    this.endScreen.classList.add('hidden');
  }

  showPlaying(): void {
    this.startScreen.classList.add('hidden');
    this.endScreen.classList.add('hidden');
    this.hudEl.classList.remove('hidden');
  }

  setMuted(muted: boolean): void {
    this.btnMute.textContent = `[M] Âm thanh: ${muted ? 'Tắt' : 'Bật'}`;
  }

  showToast(text: string, durationS = 3.5): void {
    this.lastToastText = text;
    this.toastTimer = durationS;
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
  }

  update(sim: Simulation, dt: number): void {
    if (sim.creativeBuffs.lastNotice) {
      this.showToast(sim.creativeBuffs.lastNotice, 4.0);
      sim.creativeBuffs.lastNotice = null;
    }
    if (this.toastTimer > 0) {
      this.toastTimer = Math.max(0, this.toastTimer - dt);
      if (this.toastTimer === 0 && this.lastToastText) {
        this.toastEl.classList.add('hidden');
      }
    }

    // Flames pips
    let flamesHtml = '';
    for (let i = 0; i < TUNING.flames; i++) {
      flamesHtml += `<span class="flame-pip ${i < sim.player.flames ? '' : 'lost'}"></span>`;
    }
    this.flamesEl.innerHTML = flamesHtml;

    this.carriedEl.textContent = `${sim.player.carried} / ${TUNING.carry_capacity}`;

    const litCount = sim.lanterns.filter((l) => l.lit).length;
    this.lanternsEl.textContent = `${litCount} / ${sim.lanterns.length}`;

    // Lantern pills
    this.pillsEl.innerHTML = sim.lanterns
      .map((l) => `<span class="lantern-pill ${l.lit ? 'lit' : ''}" title="${l.name}"></span>`)
      .join('');

    // Timer MM:SS
    const secs = Math.ceil(sim.timeLeftS);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    this.timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    this.timerEl.classList.toggle('urgent', secs <= 30);

    this.scoreEl.textContent = String(sim.score);

    if (sim.player.pulseCooldown > 0) {
      this.pulseEl.textContent = `${sim.player.pulseCooldown.toFixed(1)}s`;
      this.pulseEl.classList.add('muted');
    } else if (sim.player.carried < TUNING.pulse_cost) {
      this.pulseEl.textContent = 'Cần ánh sáng';
      this.pulseEl.classList.add('muted');
    } else {
      this.pulseEl.textContent = 'Sẵn sàng';
      this.pulseEl.classList.remove('muted');
    }

    if (sim.wanderingGirl.found) {
      this.girlEl.textContent = 'Đã tìm thấy (+5)';
      this.girlEl.classList.remove('muted');
      this.girlEl.classList.add('gold');
    } else {
      this.girlEl.textContent = 'Trong rừng';
      this.girlEl.classList.add('muted');
      this.girlEl.classList.remove('gold');
    }

    // Buff badges
    const badges: string[] = [];
    if (sim.creativeBuffs.powerTimer > 0) {
      badges.push(
        `<span class="buff-badge power">Tỏa Sáng Mạnh ${sim.creativeBuffs.powerTimer.toFixed(1)}s</span>`
      );
    }
    if (sim.creativeBuffs.speedTimer > 0) {
      badges.push(
        `<span class="buff-badge speed">Tăng Tốc ${sim.creativeBuffs.speedTimer.toFixed(1)}s</span>`
      );
    }
    this.buffsEl.innerHTML = badges.join('');

    // Context interact prompt
    const nearUnlit = sim.lanterns.find(
      (l) => !l.lit && distXZ(sim.player.pos, l.pos) <= TUNING.interact_radius
    );
    if (nearUnlit) {
      if (sim.player.carried > 0) {
        this.promptEl.textContent = `Nhấn [E] nạp ánh sáng vào ${nearUnlit.name} (${nearUnlit.deposited}/${TUNING.lantern_cost})`;
      } else {
        this.promptEl.textContent = `${nearUnlit.name} (${nearUnlit.deposited}/${TUNING.lantern_cost}) — Hãy thu thập thêm đom đóm`;
      }
      this.promptEl.classList.remove('hidden');
    } else {
      this.promptEl.classList.add('hidden');
    }
  }

  showEnd(sim: Simulation): void {
    this.hudEl.classList.add('hidden');
    this.endScreen.classList.remove('hidden');

    const won = sim.state === 'won';
    this.endBadge.textContent = won ? 'CHIẾN THẮNG ĐÊM 1' : 'THẤT BẠI';
    this.endTitle.textContent = won
      ? 'Đảo Bến Rực Sáng!'
      : 'Ánh Sáng Đã Tắt...';

    if (won) {
      this.endReason.textContent =
        'Mây đã thắp sáng cả 5 Đèn Lồng Lớn, xua tan sương đen khỏi Đảo Bến trước bình minh.';
    } else if (sim.winOrLoseReason === 'no_flames') {
      this.endReason.textContent =
        'Mây đã bị Bóng Mực dập tắt hết ngọn lửa sinh mệnh.';
    } else {
      this.endReason.textContent =
        'Bình minh đã lên khi các Đèn Lồng Lớn chưa kịp thắp sáng đủ.';
    }

    const timeBonus = won
      ? Math.floor(sim.timeLeftS) * TUNING.score.per_second_left
      : 0;
    const flameBonus = won
      ? sim.player.flames * TUNING.score.per_flame_left
      : 0;
    const actionScore = sim.score - timeBonus - flameBonus;
    const litCount = sim.lanterns.filter((l) => l.lit).length;

    this.endBreakdown.innerHTML = `
      <div class="score-line"><span>Đèn đã thắp</span><span>${litCount} / ${sim.lanterns.length}</span></div>
      <div class="score-line"><span>Điểm hành động (đom đóm, đèn, đẩy lùi)</span><span>${actionScore}</span></div>
      <div class="score-line"><span>Thưởng thời gian còn lại (${Math.floor(sim.timeLeftS)}s)</span><span>+${timeBonus}</span></div>
      <div class="score-line"><span>Thưởng ngọn lửa còn lại (${sim.player.flames})</span><span>+${flameBonus}</span></div>
      <div class="score-line total"><span>Tổng điểm</span><span>${sim.score}</span></div>
    `;
  }
}
