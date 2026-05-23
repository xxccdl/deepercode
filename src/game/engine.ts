import type { Mech, Particle, AttackBox, InputState, GameConfig } from './types';
import { DEFAULT_CONFIG } from './types';
import { Renderer } from './renderer';
import { audioManager } from './audio';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer: Renderer;
  private config: GameConfig;

  private mechs: Mech[] = [];
  private particles: Particle[] = [];
  private attackBoxes: AttackBox[] = [];

  private p1Input: InputState = { left: false, right: false, jump: false, attack: false, defend: false, skill: false };
  private p2Input: InputState = { left: false, right: false, jump: false, attack: false, defend: false, skill: false };

  private gameTime = 0;
  private countdown = 180;
  private phase: 'countdown' | 'fighting' | 'ended' = 'countdown';
  private winner: Mech | null = null;
  private animId = 0;
  private onEndCallback?: (winner: Mech | null) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.config = DEFAULT_CONFIG;
    this.renderer = new Renderer(this.ctx, this.config.canvasWidth, this.config.canvasHeight);
    this.initMechs();
    this.setupInputs();
  }

  private initMechs() {
    this.mechs = [
      {
        id: 'p1', name: '蓝影', x: 150, y: this.config.groundY - 48,
        width: 36, height: 48, velocityX: 0, velocityY: 0,
        hp: 100, maxHp: 100, energy: 0, maxEnergy: 100,
        facing: 'right', state: 'idle', team: 'blue',
        stateTimer: 0, animFrame: 0, animTimer: 0,
        onGround: true, invincible: false, invincibleTimer: 0, combo: 0,
      },
      {
        id: 'p2', name: '赤焰', x: this.config.canvasWidth - 186, y: this.config.groundY - 48,
        width: 36, height: 48, velocityX: 0, velocityY: 0,
        hp: 100, maxHp: 100, energy: 0, maxEnergy: 100,
        facing: 'left', state: 'idle', team: 'red',
        stateTimer: 0, animFrame: 0, animTimer: 0,
        onGround: true, invincible: false, invincibleTimer: 0, combo: 0,
      },
    ];
  }

  private setupInputs() {
    const keyMap: Record<string, { player: number; action: keyof InputState }> = {
      'KeyA': { player: 0, action: 'left' },
      'KeyD': { player: 0, action: 'right' },
      'KeyW': { player: 0, action: 'jump' },
      'KeyJ': { player: 0, action: 'attack' },
      'KeyK': { player: 0, action: 'defend' },
      'KeyL': { player: 0, action: 'skill' },
      'ArrowLeft': { player: 1, action: 'left' },
      'ArrowRight': { player: 1, action: 'right' },
      'ArrowUp': { player: 1, action: 'jump' },
      'Numpad1': { player: 1, action: 'attack' },
      'Digit1': { player: 1, action: 'attack' },
      'Numpad2': { player: 1, action: 'defend' },
      'Digit2': { player: 1, action: 'defend' },
      'Numpad3': { player: 1, action: 'skill' },
      'Digit3': { player: 1, action: 'skill' },
    };

    const handleKey = (e: KeyboardEvent, pressed: boolean) => {
      const mapping = keyMap[e.code];
      if (mapping) {
        e.preventDefault();
        const input = mapping.player === 0 ? this.p1Input : this.p2Input;
        input[mapping.action] = pressed;
      }
    };

    this.canvas.tabIndex = 0;
    this.canvas.focus();

    const keydown = (e: KeyboardEvent) => handleKey(e, true);
    const keyup = (e: KeyboardEvent) => handleKey(e, false);

    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);

    this.canvas.addEventListener('click', () => this.canvas.focus());

    const originalDestroy = this.destroy.bind(this);
    this.destroy = () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      originalDestroy();
    };
  }

  start(onEnd?: (winner: Mech | null) => void) {
    this.onEndCallback = onEnd;
    this.phase = 'countdown';
    this.countdown = 180;
    this.gameTime = 0;
    this.winner = null;
    this.particles = [];
    this.attackBoxes = [];
    this.initMechs();
    this.loop();
  }

  private loop = () => {
    this.update();
    this.renderer.render(this.mechs, this.particles, this.attackBoxes, this.countdown, this.gameTime);

    if (this.phase !== 'ended') {
      this.animId = requestAnimationFrame(this.loop);
    }
  };

  private update() {
    if (this.phase === 'countdown') {
      this.countdown--;
      if (this.countdown === 120 || this.countdown === 60) {
        audioManager.playCountdown();
      }
      if (this.countdown <= 0) {
        this.phase = 'fighting';
        audioManager.playStart();
      }
      return;
    }

    if (this.phase === 'ended') return;

    this.gameTime++;

    for (const mech of this.mechs) {
      const input = mech.id === 'p1' ? this.p1Input : this.p2Input;
      this.updateMech(mech, input);
    }

    this.updateAttackBoxes();
    this.updateParticles();
    this.checkCollisions();
    this.checkEnd();
  }

  private updateMech(mech: Mech, input: InputState) {
    if (mech.state === 'dead') return;

    if (mech.invincible) {
      mech.invincibleTimer--;
      if (mech.invincibleTimer <= 0) {
        mech.invincible = false;
      }
    }

    if (mech.state === 'hit') {
      mech.stateTimer--;
      mech.velocityX *= this.config.friction;
      mech.x += mech.velocityX;
      mech.y += mech.velocityY;
      mech.velocityY += this.config.gravity;

      if (mech.y + mech.height >= this.config.groundY) {
        mech.y = this.config.groundY - mech.height;
        mech.velocityY = 0;
        mech.onGround = true;
      }

      if (mech.stateTimer <= 0) {
        mech.state = 'idle';
      }
      this.clampPosition(mech);
      return;
    }

    if (mech.state === 'attack' || mech.state === 'skill') {
      mech.stateTimer--;
      mech.velocityX *= this.config.friction;
      mech.x += mech.velocityX;

      if (mech.state === 'attack' && mech.stateTimer === 10) {
        this.createAttackBox(mech);
      }
      if (mech.state === 'skill' && mech.stateTimer === 20) {
        this.createSkillAttackBox(mech);
      }

      if (mech.stateTimer <= 0) {
        mech.state = 'idle';
      }
      this.clampPosition(mech);
      return;
    }

    if (mech.state === 'defend') {
      if (!input.defend) {
        mech.state = 'idle';
      }
      mech.velocityX *= this.config.friction;
      mech.x += mech.velocityX;
      this.clampPosition(mech);
      return;
    }

    if (input.attack) {
      mech.state = 'attack';
      mech.stateTimer = 15;
      mech.velocityX = 0;
      audioManager.playAttack();
      this.clampPosition(mech);
      return;
    }

    if (input.skill && mech.energy >= 50) {
      mech.state = 'skill';
      mech.stateTimer = 40;
      mech.energy -= 50;
      mech.velocityX = 0;
      audioManager.playSkill();
      this.renderer.triggerFlash(15);
      this.clampPosition(mech);
      return;
    }

    if (input.defend) {
      mech.state = 'defend';
      mech.velocityX = 0;
      audioManager.playDefend();
      this.clampPosition(mech);
      return;
    }

    if (input.jump && mech.onGround) {
      mech.velocityY = this.config.jumpForce;
      mech.onGround = false;
      mech.state = 'jump';
      audioManager.playJump();
    }

    if (input.left) {
      mech.velocityX = -this.config.moveSpeed;
      mech.facing = 'left';
      if (mech.onGround) mech.state = 'walk';
    } else if (input.right) {
      mech.velocityX = this.config.moveSpeed;
      mech.facing = 'right';
      if (mech.onGround) mech.state = 'walk';
    } else {
      mech.velocityX *= this.config.friction;
      if (Math.abs(mech.velocityX) < 0.1) mech.velocityX = 0;
      if (mech.onGround && Math.abs(mech.velocityX) < 0.5) mech.state = 'idle';
    }

    mech.x += mech.velocityX;
    mech.y += mech.velocityY;
    mech.velocityY += this.config.gravity;

    if (mech.y + mech.height >= this.config.groundY) {
      mech.y = this.config.groundY - mech.height;
      mech.velocityY = 0;
      mech.onGround = true;
      if (mech.state === 'jump') mech.state = 'idle';
    } else {
      mech.onGround = false;
    }

    mech.energy = Math.min(mech.maxEnergy, mech.energy + 0.1);
    this.clampPosition(mech);
  }

  private clampPosition(mech: Mech) {
    mech.x = Math.max(0, Math.min(this.config.canvasWidth - mech.width, mech.x));
  }

  private createAttackBox(mech: Mech) {
    const facing = mech.facing === 'right' ? 1 : -1;
    this.attackBoxes.push({
      x: mech.x + (facing === 1 ? mech.width : -30),
      y: mech.y + 8,
      width: 30,
      height: 32,
      ownerId: mech.id,
      damage: this.config.attackDamage,
      active: true,
      lifetime: 8,
    });
  }

  private createSkillAttackBox(mech: Mech) {
    const facing = mech.facing === 'right' ? 1 : -1;
    this.attackBoxes.push({
      x: mech.x + (facing === 1 ? mech.width : -60),
      y: mech.y - 10,
      width: 60,
      height: 60,
      ownerId: mech.id,
      damage: this.config.skillDamage,
      active: true,
      lifetime: 20,
    });
  }

  private updateAttackBoxes() {
    for (const box of this.attackBoxes) {
      box.lifetime--;
      if (box.lifetime <= 0) box.active = false;
    }
    this.attackBoxes = this.attackBoxes.filter(b => b.active);
  }

  private updateParticles() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life--;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  private spawnParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 2,
        life: 20 + Math.random() * 20,
        maxLife: 40,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  private checkCollisions() {
    for (const box of this.attackBoxes) {
      if (!box.active) continue;
      const target = this.mechs.find(m => m.id !== box.ownerId);
      if (!target || target.state === 'dead') continue;

      if (
        box.x < target.x + target.width &&
        box.x + box.width > target.x &&
        box.y < target.y + target.height &&
        box.y + box.height > target.y
      ) {
        if (target.invincible) continue;

        let damage = box.damage;
        const attacker = this.mechs.find(m => m.id === box.ownerId);

        if (target.state === 'defend') {
          damage = Math.floor(damage * (1 - this.config.defendReduction));
          audioManager.playDefend();
          this.spawnParticles(target.x + target.width / 2, target.y + target.height / 2, 'rgb(100, 200, 255)', 8);
        } else {
          target.state = 'hit';
          target.stateTimer = 20;
          target.invincible = true;
          target.invincibleTimer = 30;
          target.velocityX = attacker && attacker.facing === 'right' ? 5 : -5;
          target.velocityY = -4;
          target.combo = 0;

          if (attacker) {
            attacker.combo++;
            attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + 10);
          }

          audioManager.playHit();
          this.renderer.triggerShake(6, 10);
          this.spawnParticles(target.x + target.width / 2, target.y + target.height / 2, 'rgb(255, 100, 50)', 15);
        }

        target.hp = Math.max(0, target.hp - damage);
        box.active = false;
      }
    }
  }

  private checkEnd() {
    for (const mech of this.mechs) {
      if (mech.hp <= 0 && mech.state !== 'dead') {
        mech.state = 'dead';
        mech.hp = 0;
        this.winner = this.mechs.find(m => m.id !== mech.id) || null;
        this.phase = 'ended';

        if (this.winner) {
          audioManager.playWin();
        }

        setTimeout(() => {
          if (this.onEndCallback) {
            this.onEndCallback(this.winner);
          }
        }, 1500);

        return;
      }
    }
  }

  destroy() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
    }
  }
}
