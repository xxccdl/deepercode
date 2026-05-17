import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { DEEPER_HOME } from './constants.js';

export class Storage {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? join(DEEPER_HOME, 'storage');
    this.ensureDir(this.baseDir);
  }

  get<T = unknown>(key: string): T | null {
    const filePath = this.getFilePath(key);
    try {
      if (!existsSync(filePath)) {
        return null;
      }
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  set<T = unknown>(key: string, value: T): void {
    const filePath = this.getFilePath(key);
    this.ensureDir(dirname(filePath));
    writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
  }

  delete(key: string): boolean {
    const filePath = this.getFilePath(key);
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        return true;
      }
    } catch {
    }
    return false;
  }

  has(key: string): boolean {
    return existsSync(this.getFilePath(key));
  }

  keys(): string[] {
    const result: string[] = [];
    try {
      if (existsSync(this.baseDir)) {
        const files = readdirSync(this.baseDir, { recursive: true });
        for (const file of files) {
          const fileName = typeof file === 'string' ? file : file.toString('utf-8');
          if (fileName.endsWith('.json')) {
            result.push(fileName.replace(/\.json$/, '').replace(/\\/g, '/'));
          }
        }
      }
    } catch {
    }
    return result;
  }

  clear(): void {
    try {
      const files = readdirSync(this.baseDir, { recursive: true });
      for (const file of files) {
        const fullPath = join(this.baseDir, typeof file === 'string' ? file : file.toString('utf-8'));
        try {
          unlinkSync(fullPath);
        } catch {
        }
      }
    } catch {
    }
  }

  setBaseDir(dir: string): void {
    this.baseDir = dir;
    this.ensureDir(dir);
  }

  private getFilePath(key: string): string {
    const safeKey = key.replace(/[<>:"/\\|?*]/g, '_');
    return join(this.baseDir, `${safeKey}.json`);
  }

  private ensureDir(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

export const storage = new Storage();
