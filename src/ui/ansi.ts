import process from 'node:process';

// ---- output buffer ----
let writeBuf = '';
let writeTimer: ReturnType<typeof setTimeout> | null = null;
export const O = (s: string) => { writeBuf += s; if (!writeTimer) writeTimer = setTimeout(() => { const b = writeBuf; writeBuf = ''; writeTimer = null; if (b) process.stdout.write(b); }, 16); };
export function Oflush() { if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; } if (writeBuf) { const b = writeBuf; writeBuf = ''; process.stdout.write(b); } }

// ---- ANSI colors ----
export const A = {
  R: '\x1b[0m',  d: '\x1b[2m',  b: '\x1b[1m',
  c: '\x1b[36m', g: '\x1b[32m', y: '\x1b[33m',
  r: '\x1b[31m', B: '\x1b[34m', m: '\x1b[35m',
  G: '\x1b[90m',
};
export function d(s: string) { return A.d + s + A.R; }
export function b(s: string) { return A.b + s + A.R; }
export function c(s: string) { return A.c + s + A.R; }
export function g(s: string) { return A.g + s + A.R; }
export function y(s: string) { return A.y + s + A.R; }
export function r(s: string) { return A.r + s + A.R; }
export function B(s: string) { return A.B + s + A.R; }
export function G(s: string) { return A.G + s + A.R; }

// ---- thinking animation ----
let stepTs = Date.now();
const WAVE_CHARS = '▁▂▃▄▅▆▇█';
const BRAILLE = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';

export function resetTimer() { stepTs = Date.now(); }
export function elapsedSec() { return (Date.now() - stepTs) / 1000; }

export function thinkingAnim(label: string): string {
  return thinkingAnimAt(label, stepTs);
}
export function thinkingAnimAt(label: string, start: number): string {
  const t = (Date.now() - start) / 1000;
  let wave = '';
  for (let i = 0; i < 9; i++) {
    const v = Math.sin((i / 9) * Math.PI * 2 + t * 2.5) * 0.5 + 0.5;
    const ch = WAVE_CHARS[Math.floor(v * 7)] || '█';
    if (v > 0.67) wave += A.c + ch + A.R;
    else if (v > 0.33) wave += A.m + ch + A.R;
    else wave += A.G + ch + A.R;
  }
  const spin = A.c + A.b + BRAILLE[Math.floor((t * 10) % 8)] + A.R;
  const orb = ['◜', '◝', '◞', '◟'];
  const pulse = Math.sin(t * 4) > 0 ? A.c + orb[Math.floor((t * 7) % 4)] + A.R : A.G + orb[Math.floor((t * 7) % 4)] + A.R;
  return A.d + '  ' + A.R + wave + ' ' + spin + ' ' + pulse + '  ' + A.d + label + A.R + ' ' + A.G + t.toFixed(1) + 's' + A.R;
}
