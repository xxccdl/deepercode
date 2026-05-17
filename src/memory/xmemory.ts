import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEEPER_HOME } from '../core/constants.js';

export interface MemoryEntry {
  id: string;
  type: 'working' | 'episodic' | 'semantic' | 'procedural';
  content: string;
  tags: string[];
  importance: number;     // 0-10
  accuracy: number;       // 0-10, 自评置信度
  createdAt: number;
  accessedAt: number;
  accessCount: number;
  sessionId: string;
  source: string;         // 'user' | 'agent' | 'tool' | 'system'
  references: string[];   // 关联条目 ID
}

interface XMemStats {
  totalEntries: number;
  byType: Record<string, number>;
  totalTokens: number;
  lastCleanup: number;
}

const MEM_DIR = join(DEEPER_HOME, 'xmemory');
const STATS_FILE = join(MEM_DIR, 'stats.json');
const MAX_WORKING_MEM = 50;
const MAX_TOTAL_MEM = 2000;
const CLEANUP_THRESHOLD = 1500;

let currentSessionId = '';

export function setSessionId(id: string) { currentSessionId = id; }

function uid(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureDir(): void {
  if (!existsSync(MEM_DIR)) mkdirSync(MEM_DIR, { recursive: true });
  if (!existsSync(STATS_FILE)) {
    writeFileSync(STATS_FILE, JSON.stringify({ totalEntries: 0, byType: {}, totalTokens: 0, lastCleanup: Date.now() }), 'utf-8');
  }
}

function loadStats(): XMemStats {
  try {
    return JSON.parse(readFileSync(STATS_FILE, 'utf-8')) as XMemStats;
  } catch { return { totalEntries: 0, byType: {}, totalTokens: 0, lastCleanup: 0 }; }
}

function saveStats(s: XMemStats): void {
  writeFileSync(STATS_FILE, JSON.stringify(s, null, 2), 'utf-8');
}

export class XMemory {
  private working: MemoryEntry[] = [];
  private index: Map<string, MemoryEntry> = new Map();
  private dirty = false;

  constructor() {
    ensureDir();
  }

  // ============ 写入 ============
  store(
    type: MemoryEntry['type'],
    content: string,
    tags: string[] = [],
    importance = 5,
    accuracy = 7,
    source: MemoryEntry['source'] = 'agent',
    references: string[] = [],
  ): string {
    const id = uid();
    const entry: MemoryEntry = {
      id, type, content: content.slice(0, 2000), tags,
      importance: Math.min(10, Math.max(0, importance)),
      accuracy: Math.min(10, Math.max(0, accuracy)),
      createdAt: Date.now(), accessedAt: Date.now(),
      accessCount: 1, sessionId: currentSessionId,
      source, references,
    };

    if (type === 'working') {
      this.working.push(entry);
      if (this.working.length > MAX_WORKING_MEM) {
        this.working.shift();
      }
    }

    this.index.set(id, entry);
    this.dirty = true;

    if (this.index.size > CLEANUP_THRESHOLD) {
      this.autoCleanup();
    }

    return id;
  }

  storeEpisodic(content: string, tags: string[] = [], importance = 5): string {
    return this.store('episodic', content, tags, importance, 7, 'agent');
  }

  storeSemantic(content: string, tags: string[] = [], importance = 7): string {
    return this.store('semantic', content, tags, importance, 9, 'agent');
  }

  storeProcedural(content: string, tags: string[] = [], importance = 8): string {
    return this.store('procedural', content, tags, importance, 9, 'agent');
  }

  storeWorking(content: string, tags: string[] = []): string {
    return this.store('working', content, tags, 3, 5, 'agent');
  }

  // ============ 检索 ============
  recall(query: string, limit = 5, minImportance = 0): MemoryEntry[] {
    const keywords = query.toLowerCase().split(/[\s,，。]+/).filter(w => w.length > 1);
    if (keywords.length === 0) return [];

    const scored: Array<{ entry: MemoryEntry; score: number }> = [];
    const now = Date.now();

    for (const entry of this.index.values()) {
      if (entry.importance < minImportance) continue;
      let score = 0;
      const c = (entry.content || '').toLowerCase();
      const t = entry.tags.join(' ').toLowerCase();

      for (const kw of keywords) {
        if (c.includes(kw)) score += 3;
        if (t.includes(kw)) score += 2;
        if (entry.type === 'procedural' && c.includes(kw)) score += 1;
      }

      // 衰减: 重要度高 + 最近访问 权重高
      const age = (now - entry.accessedAt) / (1000 * 60 * 60);
      score += entry.importance * 0.5;
      score -= Math.min(age / 24, 5); // 每 24 小时衰减 max 5

      if (score > 0) scored.push({ entry, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => {
      s.entry.accessedAt = now;
      s.entry.accessCount++;
      return s.entry;
    });
  }

  getByType(type: MemoryEntry['type'], limit = 20): MemoryEntry[] {
    const res: MemoryEntry[] = [];
    for (const entry of this.index.values()) {
      if (entry.type === type) res.push(entry);
    }
    res.sort((a, b) => b.createdAt - a.createdAt);
    return res.slice(0, limit);
  }

  getWorking(): MemoryEntry[] {
    return this.working;
  }

  getWorkingContext(maxTokens = 2000): string {
    if (this.working.length === 0) return '';
    const lines = this.working.map(e => `[工作记忆] ${e.content.slice(0, 300)}`);
    let result = '';
    for (const line of lines) {
      if ((result + line).length > maxTokens * 4) break;
      result += line + '\n';
    }
    return result;
  }

  getProceduralHints(task: string, limit = 5): string {
    const recalled = this.recall(task, limit, 3);
    const proc = recalled.filter(r => r.type === 'procedural' || r.type === 'semantic');
    if (proc.length === 0) return '';
    return '[记忆提示]\n' + proc.map(p => `- ${p.content.slice(0, 250)}`).join('\n');
  }

  getSessionSummary(): string {
    const entries = [...this.index.values()].filter(e => e.sessionId === currentSessionId);
    if (entries.length === 0) return '';
    const key = entries
      .filter(e => e.importance >= 5)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 8);
    return `[XMemory·本会话]\n` + key.map(e => {
      const t = e.type === 'semantic' ? '知识' : e.type === 'procedural' ? '技能' : e.type === 'episodic' ? '经历' : '工作';
      return `[${t}] ${e.content.slice(0, 200)}`;
    }).join('\n');
  }

  // ============ 持久化 ============
  async save(): Promise<void> {
    if (!this.dirty) return;
    ensureDir();

    // 分批写入：每个 type 一个文件
    const byType: Record<string, MemoryEntry[]> = {};
    for (const entry of this.index.values()) {
      if (!byType[entry.type]) byType[entry.type] = [];
      byType[entry.type].push(entry);
    }

    for (const [type, entries] of Object.entries(byType)) {
      const file = join(MEM_DIR, `${type}.json`);
      writeFileSync(file, JSON.stringify(entries.slice(-500)), 'utf-8'); // 每个类型最多 500 条
    }

    const stats = loadStats();
    stats.totalEntries = this.index.size;
    stats.byType = {};
    for (const entry of this.index.values()) {
      stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
    }
    stats.totalTokens = [...this.index.values()].reduce((s, e) => s + e.content.length, 0);
    saveStats(stats);

    this.dirty = false;
  }

  async load(): Promise<void> {
    ensureDir();
    let total = 0;

    for (const type of ['working', 'episodic', 'semantic', 'procedural']) {
      const file = join(MEM_DIR, `${type}.json`);
      if (!existsSync(file)) continue;
      try {
        const entries = JSON.parse(readFileSync(file, 'utf-8')) as MemoryEntry[];
        for (const entry of entries) {
          if (total > MAX_TOTAL_MEM) break;
          this.index.set(entry.id, entry);
          if (entry.type === 'working') this.working.push(entry);
          total++;
        }
      } catch { /* skip corrupt files */ }
    }

    if (this.working.length > MAX_WORKING_MEM) {
      this.working = this.working.slice(-MAX_WORKING_MEM);
    }
  }

  // ============ 维护 ============
  private autoCleanup(): void {
    const entries = [...this.index.values()];
    entries.sort((a, b) => {
      const scoreA = a.importance * 2 + a.accessCount - (Date.now() - a.accessedAt) / (1000 * 60 * 60 * 24);
      const scoreB = b.importance * 2 + b.accessCount - (Date.now() - b.accessedAt) / (1000 * 60 * 60 * 24);
      return scoreA - scoreB;
    });

    const toKeep = entries.slice(-500);
    this.index.clear();
    this.working = [];
    for (const entry of toKeep) {
      this.index.set(entry.id, entry);
      if (entry.type === 'working') this.working.push(entry);
    }
    this.dirty = true;
  }

  get totalEntries(): number { return this.index.size; }
  get dirtyState(): boolean { return this.dirty; }
}

export const xmemory = new XMemory();
