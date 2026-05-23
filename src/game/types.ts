export type MechState = 'idle' | 'walk' | 'jump' | 'attack' | 'defend' | 'hit' | 'skill' | 'dead';
export type GamePhase = 'menu' | 'countdown' | 'fighting' | 'paused' | 'ended';
export type Team = 'blue' | 'red';

export interface Mech {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
  velocityY: number;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  facing: 'left' | 'right';
  state: MechState;
  team: Team;
  stateTimer: number;
  animFrame: number;
  animTimer: number;
  onGround: boolean;
  invincible: boolean;
  invincibleTimer: number;
  combo: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface AttackBox {
  x: number;
  y: number;
  width: number;
  height: number;
  ownerId: string;
  damage: number;
  active: boolean;
  lifetime: number;
}

export interface GameConfig {
  gravity: number;
  groundY: number;
  canvasWidth: number;
  canvasHeight: number;
  moveSpeed: number;
  jumpForce: number;
  attackDamage: number;
  skillDamage: number;
  defendReduction: number;
  friction: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  gravity: 0.6,
  groundY: 400,
  canvasWidth: 960,
  canvasHeight: 540,
  moveSpeed: 4,
  jumpForce: -12,
  attackDamage: 10,
  skillDamage: 25,
  defendReduction: 0.5,
  friction: 0.85,
};

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  attack: boolean;
  defend: boolean;
  skill: boolean;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  brightness: number;
}
