import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { DEEPER_LOGS_DIR } from './constants.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private level: LogLevel;
  private logDir: string;
  private currentLogFile: string;

  constructor(level: LogLevel = 'info', logDir?: string) {
    this.level = level;
    this.logDir = logDir ?? DEEPER_LOGS_DIR;
    this.currentLogFile = this.generateLogFileName();
    this.ensureLogDir();
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (LOG_LEVEL_RANK[level] < LOG_LEVEL_RANK[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const formatted = this.formatMessage(level, timestamp, message, data);

    switch (level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
        break;
    }

    try {
      appendFileSync(this.currentLogFile, this.stripAnsi(formatted) + '\n', 'utf-8');
    } catch {
    }
  }

  private formatMessage(level: LogLevel, timestamp: string, message: string, data?: unknown): string {
    const levelUpper = level.toUpperCase();
    const base = `[${timestamp}] [${levelUpper}] ${message}`;
    if (data !== undefined) {
      if (typeof data === 'string') {
        return `${base} ${data}`;
      }
      if (data instanceof Error) {
        return `${base} ${data.message}\n${data.stack ?? ''}`;
      }
      try {
        return `${base} ${JSON.stringify(data)}`;
      } catch {
        return `${base} [Unserializable data]`;
      }
    }
    return base;
  }

  private stripAnsi(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  private generateLogFileName(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    return join(this.logDir, `deeper-${dateStr}.log`);
  }

  private ensureLogDir(): void {
    const dir = dirname(this.currentLogFile);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

export const logger = new Logger();
