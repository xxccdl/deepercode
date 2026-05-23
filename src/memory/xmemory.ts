import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEEPER_HOME } from '../core/constants.js';

export interface MemoryEntry {
  id: string;
  type: 'working' | 'episodic' | 'semantic' | 'procedural';
  content: string;
  tags: string[];
  importance: number;
  accuracy: number;
  createdAt: number;
  accessedAt: number;
  accessCount: number;
  sessionId: string;
  source: string;
  references: string[];
}

interface XMemStats {
  totalEntries: number;
  byType: Record<string, number>;
  totalTokens: number;
  lastCleanup: number;
  lastConsolidate: number;
}

const MEM_DIR = join(DEEPER_HOME, 'xmemory');
const STATS_FILE = join(MEM_DIR, 'stats.json');
const MAX_WORKING_MEM = 100;
const MAX_TOTAL_MEM = 3000;
const CLEANUP_THRESHOLD = 2000;
const DEDUP_SIMILARITY_THRESHOLD = 0.85;
const CONSOLIDATE_THRESHOLD = 5;
const SAVE_DEBOUNCE_MS = 3000;

let currentSessionId = '';

export function setSessionId(id: string) { currentSessionId = id; }

function uid(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureDir(): void {
  if (!existsSync(MEM_DIR)) mkdirSync(MEM_DIR, { recursive: true });
  if (!existsSync(STATS_FILE)) {
    writeFileSync(STATS_FILE, JSON.stringify({ totalEntries: 0, byType: {}, totalTokens: 0, lastCleanup: Date.now(), lastConsolidate: Date.now() }, null, 2), 'utf-8');
  }
}

function loadStats(): XMemStats {
  try {
    return JSON.parse(readFileSync(STATS_FILE, 'utf-8')) as XMemStats;
  } catch { return { totalEntries: 0, byType: {}, totalTokens: 0, lastCleanup: 0, lastConsolidate: 0 }; }
}

function saveStats(s: XMemStats): void {
  writeFileSync(STATS_FILE, JSON.stringify(s, null, 2), 'utf-8');
}

function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const words = lower.split(/[\s\p{Z}\p{P}]+/u).filter(w => w.length >= 2);
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) bigrams.push(words[i] + '_' + words[i + 1]);
  return [...new Set([...words, ...bigrams])];
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const sa = new Set(ta);
  const sb = new Set(tb);
  let intersection = 0;
  for (const t of sa) if (sb.has(t)) intersection++;
  const union = Math.max(sa.size, sb.size);
  return union > 0 ? intersection / union : 0;
}

class TFIDFIndexer {
  private docFreq: Map<string, number> = new Map();
  private numDocs = 0;

  build(entries: Iterable<MemoryEntry>): void {
    this.docFreq.clear();
    this.numDocs = 0;
    for (const entry of entries) {
      this.numDocs++;
      const tokens = new Set(tokenize(entry.content));
      for (const t of tokens) this.docFreq.set(t, (this.docFreq.get(t) || 0) + 1);
    }
  }

  idf(term: string): number {
    const df = this.docFreq.get(term) || 0;
    if (df === 0 || df >= this.numDocs) return 0;
    return Math.log((this.numDocs + 0.5) / (df + 0.5)) + 1;
  }

  tfidfScore(content: string, queryTerms: string[]): number {
    const tokens = tokenize(content);
    const tfMap = new Map<string, number>();
    for (const t of tokens) tfMap.set(t, (tfMap.get(t) || 0) + 1);
    const maxTf = Math.max(...tfMap.values(), 1);
    let score = 0;
    for (const qt of queryTerms) {
      const tf = ((tfMap.get(qt) || 0) / maxTf) * (1 + Math.log(tokens.length));
      score += tf * this.idf(qt);
    }
    return score;
  }
}

export class XMemory {
  private working: MemoryEntry[] = [];
  private index: Map<string, MemoryEntry> = new Map();
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private tfidf: TFIDFIndexer = new TFIDFIndexer();

  constructor() {
    ensureDir();
  }

  store(
    type: MemoryEntry['type'],
    content: string,
    tags: string[] = [],
    importance = 5,
    accuracy = 7,
    source: MemoryEntry['source'] = 'agent',
    references: string[] = [],
  ): string {
    const deduped = this.deduplicate(type, content, importance);
    if (deduped !== null) return deduped;

    const id = uid();
    const entry: MemoryEntry = {
      id, type, content: content.slice(0, 4000), tags,
      importance: Math.min(10, Math.max(0, importance)),
      accuracy: Math.min(10, Math.max(0, accuracy)),
      createdAt: Date.now(), accessedAt: Date.now(),
      accessCount: 1, sessionId: currentSessionId,
      source, references,
    };

    if (type === 'working') {
      this.working.push(entry);
      this.evictWorking();
    }

    this.index.set(id, entry);
    this.dirty = true;
    this.scheduleSave();

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

  recall(query: string, limit = 5, minImportance = 0): MemoryEntry[] {
    const keywords = tokenize(query).filter(w => w.length >= 2);
    if (keywords.length === 0) return [];

    this.tfidf.build(this.index.values());
    const now = Date.now();
    const scored: Array<{ entry: MemoryEntry; score: number }> = [];

    for (const entry of this.index.values()) {
      if (entry.importance < minImportance) continue;

      const c = entry.content.toLowerCase();
      const t = entry.tags.join(' ').toLowerCase();

      let keywordScore = 0;
      let exactMatchBonus = 0;
      for (const kw of keywords) {
        if (c.includes(kw)) { keywordScore += 3; exactMatchBonus += 1; }
        if (t.includes(kw)) keywordScore += 2;
        if (entry.type === 'procedural' && c.includes(kw)) keywordScore += 1;
        if (entry.type === 'semantic' && c.includes(kw)) keywordScore += 1.5;
      }

      const tfidfScore = this.tfidf.tfidfScore(entry.content, keywords);

      const recencyBoost = Math.max(0, 3 - (now - entry.accessedAt) / (1000 * 60 * 30));
      const frequencyBoost = Math.min(entry.accessCount * 0.3, 4);
      const importanceWeight = entry.importance * 0.6;
      const ageHours = (now - entry.createdAt) / (1000 * 60 * 60);
      const ageDecay = Math.min(ageHours / 48, 6);

      const totalScore =
        keywordScore * 1.0 +
        tfidfScore * 2.0 +
        importanceWeight +
        recencyBoost +
        frequencyBoost -
        ageDecay +
        (exactMatchBonus >= 3 ? 3 : 0);

      if (totalScore > 0) scored.push({ entry, score: totalScore });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => {
      s.entry.accessedAt = now;
      s.entry.accessCount++;
      s.entry.importance = Math.min(10, s.entry.importance + 0.1);
      return s.entry;
    });
  }

  getByType(type: MemoryEntry['type'], limit = 20): MemoryEntry[] {
    const res: MemoryEntry[] = [];
    for (const entry of this.index.values()) {
      if (entry.type === type) res.push(entry);
    }
    res.sort((a, b) => (b.importance * 2 + b.accessCount) - (a.importance * 2 + a.accessCount));
    return res.slice(0, limit);
  }

  getWorking(): MemoryEntry[] {
    return this.working.sort((a, b) =>
      (b.importance * 2 + b.accessCount) - (a.importance * 2 + a.accessCount)
    );
  }

  getWorkingContext(maxTokens = 4000): string {
    if (this.working.length === 0) return '';
    const sorted = this.getWorking();
    const lines = sorted.map(e => `[${e.source}] ${e.content.slice(0, 500)}`);
    let result = '';
    for (const line of lines) {
      if ((result + line).length > maxTokens * 3) break;
      result += line + '\n';
    }
    return result;
  }

  getProceduralHints(task: string, limit = 5): string {
    const recalled = this.recall(task, limit, 3);
    const proc = recalled.filter(r => r.type === 'procedural' || r.type === 'semantic');
    if (proc.length === 0) return '';
    return '[记忆提示]\n' + proc.map(p => `- [${p.type === 'procedural' ? '技能' : '知识'}] ${p.content.slice(0, 350)}`).join('\n');
  }

  getSessionSummary(): string {
    const entries = [...this.index.values()].filter(e => e.sessionId === currentSessionId);
    if (entries.length === 0) return '';

    const byType: Record<string, MemoryEntry[]> = { semantic: [], procedural: [], episodic: [], working: [] };
    for (const e of entries) {
      if (byType[e.type]) byType[e.type].push(e);
    }

    const parts: string[] = [];

    const keySemantic = byType.semantic
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);
    if (keySemantic.length > 0) {
      parts.push(`[知识记忆·${keySemantic.length}条]\n` +
        keySemantic.map(e => `• ${e.content.slice(0, 250)}`).join('\n'));
    }

    const keyProcedural = byType.procedural
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);
    if (keyProcedural.length > 0) {
      parts.push(`[技能记忆·${keyProcedural.length}条]\n` +
        keyProcedural.map(e => `• ${e.content.slice(0, 250)}`).join('\n'));
    }

    const keyEpisodic = byType.episodic
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 3);
    if (keyEpisodic.length > 0) {
      parts.push(`[经历记忆·${keyEpisodic.length}条]\n` +
        keyEpisodic.map(e => `→ ${e.content.slice(0, 150)}`).join('\n'));
    }

    return `[XMemory·本会话 ${entries.length}条]\n${parts.join('\n')}`;
  }

  async save(): Promise<void> {
    if (!this.dirty) return;
    ensureDir();

    const byType: Record<string, MemoryEntry[]> = {};
    for (const entry of this.index.values()) {
      if (!byType[entry.type]) byType[entry.type] = [];
      byType[entry.type].push(entry);
    }

    for (const [type, entries] of Object.entries(byType)) {
      const file = join(MEM_DIR, `${type}.json`);
      writeFileSync(file, JSON.stringify(entries.slice(-800)), 'utf-8');
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
      } catch {}
    }

    if (this.working.length > MAX_WORKING_MEM) {
      this.working = this.working.slice(-MAX_WORKING_MEM);
    }

    this.consolidateIfNeeded();
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save().catch(() => {});
    }, SAVE_DEBOUNCE_MS);
  }

  private deduplicate(type: MemoryEntry['type'], content: string, importance: number): string | null {
    const threshold = type === 'working' ? 0.95 : type === 'episodic' ? 0.85 : DEDUP_SIMILARITY_THRESHOLD;
    const shortContent = content.slice(0, 500);

    for (const entry of this.index.values()) {
      if (entry.type !== type) continue;
      const sim = similarity(shortContent, entry.content.slice(0, 500));
      if (sim >= threshold) {
        entry.accessedAt = Date.now();
        entry.accessCount++;
        entry.importance = Math.min(10, Math.max(entry.importance, importance));
        if (content.length > entry.content.length && content.length <= 4000) {
          entry.content = content;
          this.dirty = true;
        }
        return entry.id;
      }
    }
    return null;
  }

  private evictWorking(): void {
    while (this.working.length > MAX_WORKING_MEM) {
      let worstIdx = 0;
      let worstScore = Infinity;
      for (let i = 0; i < this.working.length; i++) {
        const e = this.working[i];
        const score = e.importance + e.accessCount * 0.3 - (Date.now() - e.accessedAt) / (1000 * 60 * 15);
        if (score < worstScore) { worstScore = score; worstIdx = i; }
      }
      this.working.splice(worstIdx, 1);
    }
  }

  private consolidateIfNeeded(): void {
    const stats = loadStats();
    const now = Date.now();
    if (now - stats.lastConsolidate < 24 * 60 * 60 * 1000) return;

    const candidates: Map<string, MemoryEntry[]> = new Map();
    for (const entry of this.index.values()) {
      if (entry.type === 'episodic' && entry.accessCount >= CONSOLIDATE_THRESHOLD) {
        const key = entry.tags.slice(0, 3).sort().join('|') || '_default_';
        if (!candidates.has(key)) candidates.set(key, []);
        candidates.get(key)!.push(entry);
      }
    }

    let consolidated = 0;
    for (const [, group] of candidates) {
      if (group.length < 2) continue;
      group.sort((a, b) => b.accessCount - a.accessCount);
      const best = group[0];

      const allContent = group.map(g => g.content).join('\n');
      const summary = `[ consolidated from ${group.length} memories ]\n${allContent.slice(0, 2000)}`;

      const newType = best.accessCount >= 10 ? 'procedural' : 'semantic';
      const existing = this.findSimilar(newType, best.content);
      if (existing) {
        existing.content = summary.slice(0, 4000);
        existing.accessCount += Math.floor(group.reduce((s, g) => s + g.accessCount, 0) / group.length);
        existing.importance = Math.min(10, existing.importance + 1);
      } else {
        this.store(newType, summary, best.tags, Math.min(10, best.importance + 2), 9, 'system');
        consolidated++;
      }

      for (const old of group) {
        if (old.id !== best.id) this.index.delete(old.id);
      }
    }

    if (consolidated > 0 || candidates.size > 0) {
      stats.lastConsolidate = now;
      saveStats(stats);
      this.dirty = true;
    }
  }

  private findSimilar(type: MemoryEntry['type'], content: string): MemoryEntry | null {
    const threshold = 0.75;
    let best: MemoryEntry | null = null;
    let bestSim = 0;
    for (const entry of this.index.values()) {
      if (entry.type !== type) continue;
      const sim = similarity(content.slice(0, 300), entry.content.slice(0, 300));
      if (sim > bestSim) { bestSim = sim; best = entry; }
    }
    return bestSim >= threshold ? best : null;
  }

  private autoCleanup(): void {
    const entries = [...this.index.values()];
    entries.sort((a, b) => {
      const scoreA = a.importance * 2 + a.accessCount + (a.type === 'semantic' ? 3 : a.type === 'procedural' ? 2 : 0) - (Date.now() - a.accessedAt) / (1000 * 60 * 60 * 24);
      const scoreB = b.importance * 2 + b.accessCount + (b.type === 'semantic' ? 3 : b.type === 'procedural' ? 2 : 0) - (Date.now() - b.accessedAt) / (1000 * 60 * 60 * 24);
      return scoreA - scoreB;
    });

    const toKeep = entries.slice(-800);
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
