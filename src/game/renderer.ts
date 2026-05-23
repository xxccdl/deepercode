import type { Mech, Particle, AttackBox, Star } from './types';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private stars: Star[] = [];
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private flashTimer = 0;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.initStars();
  }

  private initStars() {
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height * 0.7,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 0.3 + 0.1,
        brightness: Math.random(),
      });
    }
  }

  triggerShake(intensity: number, duration: number) {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  triggerFlash(duration: number) {
    this.flashTimer = duration;
  }

  private applyShake() {
    if (this.shakeTimer > 0) {
      const dx = (Math.random() - 0.5) * this.shakeIntensity;
      const dy = (Math.random() - 0.5) * this.shakeIntensity;
      this.ctx.translate(dx, dy);
      this.shakeTimer--;
      if (this.shakeTimer <= 0) {
        this.shakeIntensity = 0;
      }
    }
  }

  render(
    mechs: Mech[],
    particles: Particle[],
    attackBoxes: AttackBox[],
    countdown: number,
    gameTime: number
  ) {
    this.ctx.save();

    this.ctx.fillStyle = '#0a0a1a';
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.renderStars();
    this.renderBackground();
    this.applyShake();

    for (const mech of mechs) {
      this.renderMech(mech);
    }

    for (const box of attackBoxes) {
      if (box.active) {
        this.renderAttackBox(box);
      }
    }

    for (const p of particles) {
      this.renderParticle(p);
    }

    if (this.flashTimer > 0) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${this.flashTimer / 20 * 0.5})`;
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.flashTimer--;
    }

    if (countdown > 0) {
      this.renderCountdown(countdown);
    }

    this.renderUI(mechs, gameTime);

    this.ctx.restore();
  }

  private renderStars() {
    for (const star of this.stars) {
      star.x -= star.speed;
      if (star.x < 0) star.x = this.width;
      const alpha = 0.3 + star.brightness * 0.7;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      this.ctx.fillRect(star.x, star.y, star.size, star.size);
    }
  }

  private renderBackground() {
    const groundY = 400;

    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, groundY, this.width, this.height - groundY);

    this.ctx.fillStyle = '#2a2a4a';
    for (let x = 0; x < this.width; x += 32) {
      const offset = (x % 64 === 0) ? 0 : 4;
      this.ctx.fillRect(x, groundY + offset, 30, 140);
    }

    this.ctx.fillStyle = '#3a3a5a';
    for (let x = 0; x < this.width; x += 64) {
      this.ctx.fillRect(x + 8, groundY + 20, 48, 8);
      this.ctx.fillRect(x + 16, groundY + 40, 32, 6);
    }

    this.ctx.fillStyle = '#0d5c3b';
    this.ctx.fillRect(0, groundY - 8, this.width, 8);
    this.ctx.fillStyle = '#1a7a4a';
    for (let x = 0; x < this.width; x += 16) {
      this.ctx.fillRect(x, groundY - 10, 8, 4);
    }

    const moonX = this.width - 100;
    const moonY = 60;
    this.ctx.fillStyle = '#c4a35a';
    this.ctx.beginPath();
    this.ctx.arc(moonX, moonY, 30, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#0a0a1a';
    this.ctx.beginPath();
    this.ctx.arc(moonX - 10, moonY - 5, 25, 0, Math.PI * 2);
    this.ctx.fill();

    for (let i = 0; i < 5; i++) {
      const mx = moonX - 25 + Math.random() * 50;
      const my = moonY - 25 + Math.random() * 50;
      this.ctx.fillStyle = 'rgba(255, 255, 200, 0.3)';
      this.ctx.fillRect(mx, my, 2, 2);
    }
  }

  private renderMech(mech: Mech) {
    const x = Math.floor(mech.x);
    const y = Math.floor(mech.y);
    const w = mech.width;
    const h = mech.height;
    const facing = mech.facing === 'right' ? 1 : -1;

    this.ctx.save();
    this.ctx.translate(x + w / 2, y + h / 2);
    this.ctx.scale(facing, 1);

    if (mech.invincible && Math.floor(Date.now() / 50) % 2 === 0) {
      this.ctx.globalAlpha = 0.4;
    }

    const isBlue = mech.team === 'blue';
    const primaryColor = isBlue ? '#00d4ff' : '#ff2a6d';
    const secondaryColor = isBlue ? '#0088aa' : '#aa0044';
    const darkColor = isBlue ? '#004466' : '#660022';
    const glowColor = isBlue ? 'rgba(0, 212, 255, 0.3)' : 'rgba(255, 42, 109, 0.3)';

    const bobOffset = mech.state === 'idle' ? Math.sin(Date.now() / 300) * 2 : 0;

    this.ctx.shadowColor = glowColor;
    this.ctx.shadowBlur = 10;

    this.ctx.fillStyle = darkColor;
    this.ctx.fillRect(-16, -20 + bobOffset, 32, 8);

    this.ctx.fillStyle = primaryColor;
    this.ctx.fillRect(-14, -18 + bobOffset, 28, 6);

    this.ctx.fillStyle = secondaryColor;
    this.ctx.fillRect(-12, -16 + bobOffset, 8, 4);
    this.ctx.fillRect(4, -16 + bobOffset, 8, 4);

    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(-18, -12 + bobOffset, 36, 20);

    this.ctx.fillStyle = primaryColor;
    this.ctx.fillRect(-16, -10 + bobOffset, 32, 16);

    this.ctx.fillStyle = secondaryColor;
    this.ctx.fillRect(-12, -6 + bobOffset, 24, 8);

    this.ctx.fillStyle = '#222';
    this.ctx.fillRect(-6, -14 + bobOffset, 12, 8);

    this.ctx.fillStyle = '#00ff88';
    this.ctx.fillRect(-4, -12 + bobOffset, 3, 3);
    this.ctx.fillRect(1, -12 + bobOffset, 3, 3);

    this.ctx.fillStyle = darkColor;
    this.ctx.fillRect(-14, 8 + bobOffset, 10, 12);
    this.ctx.fillRect(4, 8 + bobOffset, 10, 12);

    this.ctx.fillStyle = primaryColor;
    this.ctx.fillRect(-12, 10 + bobOffset, 6, 8);
    this.ctx.fillRect(6, 10 + bobOffset, 6, 8);

    this.ctx.fillStyle = '#444';
    this.ctx.fillRect(-16, 20 + bobOffset, 12, 4);
    this.ctx.fillRect(4, 20 + bobOffset, 12, 4);

    if (mech.state === 'attack') {
      this.renderAttackEffect(mech);
    } else if (mech.state === 'defend') {
      this.renderDefendEffect(mech);
    } else if (mech.state === 'skill') {
      this.renderSkillEffect(mech);
    } else if (mech.state === 'hit') {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      this.ctx.fillRect(-20, -24, 40, 48);
    }

    this.ctx.shadowBlur = 0;
    this.ctx.restore();
  }

  private renderAttackEffect(mech: Mech) {
    const progress = mech.stateTimer / 15;
    const reach = 20 + progress * 30;
    const alpha = 1 - progress;

    this.ctx.strokeStyle = `rgba(255, 255, 100, ${alpha})`;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(18, -5);
    this.ctx.lineTo(18 + reach, -5 + Math.sin(progress * Math.PI) * 10);
    this.ctx.stroke();

    this.ctx.fillStyle = `rgba(255, 200, 50, ${alpha * 0.5})`;
    this.ctx.fillRect(16, -10, reach, 20);
  }

  private renderDefendEffect(mech: Mech) {
    this.ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 28, -Math.PI / 3, Math.PI / 3);
    this.ctx.stroke();

    this.ctx.fillStyle = 'rgba(100, 200, 255, 0.15)';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 26, -Math.PI / 3, Math.PI / 3);
    this.ctx.fill();
  }

  private renderSkillEffect(mech: Mech) {
    const time = Date.now() / 100;
    const radius = 30 + Math.sin(time) * 5;

    this.ctx.strokeStyle = mech.team === 'blue' ? 'rgba(0, 212, 255, 0.8)' : 'rgba(255, 42, 109, 0.8)';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.fillStyle = mech.team === 'blue' ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 42, 109, 0.2)';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius - 5, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private renderAttackBox(box: AttackBox) {
    this.ctx.fillStyle = 'rgba(255, 255, 100, 0.3)';
    this.ctx.fillRect(box.x, box.y, box.width, box.height);
    this.ctx.strokeStyle = 'rgba(255, 255, 100, 0.6)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(box.x, box.y, box.width, box.height);
  }

  private renderParticle(p: Particle) {
    const alpha = p.life / p.maxLife;
    this.ctx.fillStyle = p.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
    this.ctx.fillRect(p.x, p.y, p.size, p.size);
  }

  private renderCountdown(countdown: number) {
    const num = Math.ceil(countdown / 60);
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.fillStyle = '#ffd700';
    this.ctx.font = 'bold 80px "Press Start 2P", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.shadowColor = '#ffd700';
    this.ctx.shadowBlur = 20;

    if (num > 0) {
      this.ctx.fillText(String(num), this.width / 2, this.height / 2);
    } else {
      this.ctx.fillText('FIGHT!', this.width / 2, this.height / 2);
    }

    this.ctx.shadowBlur = 0;
  }

  private renderUI(mechs: Mech[], gameTime: number) {
    const barWidth = 280;
    const barHeight = 20;
    const padding = 20;

    for (let i = 0; i < mechs.length; i++) {
      const mech = mechs[i];
      const isLeft = i === 0;
      const x = isLeft ? padding : this.width - padding - barWidth;
      const y = 20;

      const hpRatio = mech.hp / mech.maxHp;
      const energyRatio = mech.energy / mech.maxEnergy;

      this.ctx.fillStyle = '#222';
      this.ctx.fillRect(x, y, barWidth, barHeight);

      const hpColor = mech.team === 'blue' ? '#00d4ff' : '#ff2a6d';
      this.ctx.fillStyle = hpColor;
      this.ctx.fillRect(x + 2, y + 2, (barWidth - 4) * hpRatio, barHeight - 4);

      this.ctx.fillStyle = '#222';
      this.ctx.fillRect(x, y + barHeight + 4, barWidth, 8);

      this.ctx.fillStyle = '#ffd700';
      this.ctx.fillRect(x + 2, y + barHeight + 6, (barWidth - 4) * energyRatio, 4);

      this.ctx.strokeStyle = '#4a4a6a';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, barWidth, barHeight);

      this.ctx.fillStyle = '#fff';
      this.ctx.font = '10px "Press Start 2P", monospace';
      this.ctx.textAlign = isLeft ? 'left' : 'right';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(
        `${mech.hp}/${mech.maxHp}`,
        isLeft ? x + 6 : x + barWidth - 6,
        y + barHeight + 16
      );

      this.ctx.fillStyle = mech.team === 'blue' ? '#00d4ff' : '#ff2a6d';
      this.ctx.font = '12px "Press Start 2P", monospace';
      this.ctx.textAlign = isLeft ? 'left' : 'right';
      this.ctx.fillText(mech.name, isLeft ? x : x + barWidth, y - 16);
    }

    const minutes = Math.floor(gameTime / 3600);
    const seconds = Math.floor((gameTime % 3600) / 60);
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '16px "Press Start 2P", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(timeStr, this.width / 2, 24);

    if (mechs[0].combo >= 2) {
      this.ctx.fillStyle = '#ffd700';
      this.ctx.font = '14px "Press Start 2P", monospace';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`${mechs[0].combo} HIT!`, padding, 80);
    }
    if (mechs[1].combo >= 2) {
      this.ctx.fillStyle = '#ffd700';
      this.ctx.font = '14px "Press Start 2P", monospace';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(`${mechs[1].combo} HIT!`, this.width - padding, 80);
    }
  }
}
