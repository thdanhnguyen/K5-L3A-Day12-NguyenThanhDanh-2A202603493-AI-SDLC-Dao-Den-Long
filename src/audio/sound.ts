import type { MoteColor } from '../sim/types';

const PENTATONIC_HZ = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
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
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playPickup(carried: number, color: MoteColor = 'gold'): void {
    const idx = Math.max(0, Math.min(PENTATONIC_HZ.length - 1, carried - 1));
    const base = PENTATONIC_HZ[idx];
    this.tone(base, 0.22, 'sine', 0.075);
    if (color !== 'gold') {
      this.tone(base * 1.5, 0.28, 'triangle', 0.06, 0.06);
    }
  }

  playDeposit(): void {
    this.tone(440, 0.16, 'triangle', 0.07);
    this.tone(659.25, 0.22, 'sine', 0.06, 0.05);
  }

  playLanternLit(): void {
    this.tone(392.0, 0.55, 'triangle', 0.08, 0);
    this.tone(523.25, 0.65, 'sine', 0.08, 0.07);
    this.tone(783.99, 0.85, 'sine', 0.085, 0.14);
  }

  playPulse(empowered: boolean): void {
    this.tone(empowered ? 240 : 190, 0.45, 'triangle', 0.1, 0, empowered ? 720 : 520);
    this.tone(empowered ? 660 : 523.25, 0.35, 'sine', 0.07, 0.04);
  }

  playHit(): void {
    this.tone(180, 0.3, 'sawtooth', 0.075, 0, 75);
  }

  playGirlFound(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => this.tone(n, 0.35, 'sine', 0.075, idx * 0.07));
  }

  playBirdGuide(): void {
    this.tone(880, 0.18, 'sine', 0.055, 0);
    this.tone(1174.66, 0.22, 'sine', 0.055, 0.08);
  }

  playGameOver(won: boolean): void {
    if (won) {
      [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) =>
        this.tone(f, 0.55, 'triangle', 0.08, i * 0.09)
      );
    } else {
      [392.0, 329.63, 261.63].forEach((f, i) =>
        this.tone(f, 0.5, 'sine', 0.07, i * 0.14)
      );
    }
  }
}
