import type { MoteColor } from '../sim/types';

const PENTATONIC_HZ = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private masterVolume = 0.75;
  private ambientTimer: number | null = null;
  private ambientNoteIdx = 0;

  isMuted(): boolean {
    return this.muted;
  }

  getVolume(): number {
    return this.masterVolume;
  }

  setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  startAmbient(): void {
    if (this.ambientTimer !== null || typeof window === 'undefined') return;
    const notes = [261.63, 329.63, 392.0, 440.0, 523.25, 392.0];
    this.ambientTimer = window.setInterval(() => {
      if (this.muted || this.masterVolume <= 0.01) return;
      const freq = notes[this.ambientNoteIdx % notes.length];
      this.ambientNoteIdx++;
      this.tone(freq, 1.8, 'sine', 0.025, 0);
    }, 2200);
  }

  stopAmbient(): void {
    if (this.ambientTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.08,
    delay = 0,
    endFreq?: number
  ): void {
    if (this.muted || this.masterVolume <= 0 || !this.ctx || this.ctx.state !== 'running') return;
    const vol = gainPeak * this.masterVolume;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playPickup(carried: number, color: MoteColor = 'gold'): void {
    const idx = Math.max(0, Math.min(PENTATONIC_HZ.length - 1, carried - 1));
    const base = PENTATONIC_HZ[idx];
    this.tone(base, 0.22, 'sine', 0.08);
    if (color !== 'gold') {
      this.tone(base * 1.5, 0.28, 'triangle', 0.06, 0.06);
    }
  }

  playDeposit(): void {
    this.tone(440, 0.16, 'triangle', 0.075);
    this.tone(659.25, 0.22, 'sine', 0.065, 0.05);
  }

  playLanternLit(): void {
    this.tone(392.0, 0.55, 'triangle', 0.09, 0);
    this.tone(523.25, 0.65, 'sine', 0.09, 0.07);
    this.tone(783.99, 0.85, 'sine', 0.09, 0.14);
  }

  playPulse(empowered: boolean): void {
    this.tone(empowered ? 240 : 190, 0.45, 'triangle', 0.1, 0, empowered ? 720 : 520);
    this.tone(empowered ? 660 : 523.25, 0.35, 'sine', 0.075, 0.04);
  }

  playJump(): void {
    this.tone(280, 0.18, 'sine', 0.07, 0, 520);
  }

  playDash(): void {
    this.tone(480, 0.16, 'triangle', 0.085, 0, 220);
  }

  playHit(): void {
    this.tone(180, 0.3, 'sawtooth', 0.08, 0, 75);
  }

  playShadeSpawn(): void {
    this.tone(130, 0.45, 'triangle', 0.06, 0, 95);
  }

  playCountdownTick(): void {
    this.tone(987.77, 0.1, 'sine', 0.075, 0);
  }

  playWindWarn(): void {
    this.tone(310, 0.5, 'sine', 0.06, 0, 460);
  }

  playCharmPicked(): void {
    this.tone(659.25, 0.22, 'triangle', 0.08, 0);
    this.tone(987.77, 0.32, 'sine', 0.08, 0.07);
  }

  playDrifterSteal(): void {
    this.tone(540, 0.22, 'sine', 0.07, 0, 310);
  }

  playGirlFound(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((n, idx) =>
      this.tone(n, 0.35, 'sine', 0.08, idx * 0.07)
    );
  }

  playBirdGuide(): void {
    this.tone(880, 0.18, 'sine', 0.06, 0);
    this.tone(1174.66, 0.22, 'sine', 0.06, 0.08);
  }

  playGameOver(won: boolean): void {
    if (won) {
      [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) =>
        this.tone(f, 0.55, 'triangle', 0.09, i * 0.09)
      );
    } else {
      [392.0, 329.63, 261.63].forEach((f, i) =>
        this.tone(f, 0.5, 'sine', 0.075, i * 0.14)
      );
    }
  }
}
