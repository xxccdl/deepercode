export class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled = true;

  init() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.1) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playAttack() {
    this.playTone(440, 0.1, 'square', 0.08);
    setTimeout(() => this.playTone(660, 0.1, 'square', 0.08), 50);
  }

  playHit() {
    this.playTone(200, 0.15, 'sawtooth', 0.12);
    setTimeout(() => this.playTone(150, 0.2, 'sawtooth', 0.1), 80);
  }

  playJump() {
    this.playTone(330, 0.1, 'square', 0.06);
    setTimeout(() => this.playTone(440, 0.1, 'square', 0.06), 60);
  }

  playSkill() {
    this.playTone(523, 0.15, 'square', 0.1);
    setTimeout(() => this.playTone(659, 0.15, 'square', 0.1), 100);
    setTimeout(() => this.playTone(784, 0.2, 'square', 0.1), 200);
  }

  playDefend() {
    this.playTone(600, 0.08, 'triangle', 0.05);
  }

  playWin() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 0.3, 'square', 0.1), i * 150);
    });
  }

  playLose() {
    const notes = [440, 370, 311, 247];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 0.4, 'sawtooth', 0.08), i * 200);
    });
  }

  playCountdown() {
    this.playTone(880, 0.2, 'square', 0.1);
  }

  playStart() {
    this.playTone(523, 0.1, 'square', 0.12);
    setTimeout(() => this.playTone(784, 0.3, 'square', 0.12), 100);
  }
}

export const audioManager = new AudioManager();
