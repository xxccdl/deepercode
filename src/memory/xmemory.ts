import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEEPER_HOME } from '../core/constants.js';

export interface MemoryEntry {
  id: string;
  type: 'working' | 'episodic' | 'semantic' | 'procedural' | 'preference' | 'pattern';
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
  tokenEstimate: number;
  feedback?: 'positive' | 'negative';
  successRate?: number;
}

export interface UserPreference {
  key: string;
  value: string;
  confidence: number;
  lastUpdated: number;
  evidenceCount: number;
  category: 'language' | 'framework' | 'style' | 'tool' | 'workflow' | 'naming' | 'other';
}

export interface WorkPattern {
  id: string;
  description: string;
  steps: string[];
  tools: string[];
  frequency: number;
  lastUsed: number;
  successRate: number;
  totalExecutions: number;
}

export interface XMemStats {
  totalEntries: number;
  byType: Record<string, number>;
  totalTokens: number;
  workingTokens: number;
  semanticTokens: number;
  proceduralTokens: number;
  episodicTokens: number;
  preferenceTokens: number;
  patternTokens: number;
  lastCleanup: number;
  lastConsolidate: number;
  compressCount: number;
  preferenceCount: number;
  patternCount: number;
}

const MEM_DIR = join(DEEPER_HOME, 'xmemory');
const STATS_FILE = join(MEM_DIR, 'stats.json');
const PREFS_FILE = join(MEM_DIR, 'preferences.json');
const PATTERNS_FILE = join(MEM_DIR, 'patterns.json');
const MAX_WORKING_MEM = 80;
const MAX_TOTAL_MEM = 5000;
const CLEANUP_THRESHOLD = 3000;
const DEDUP_SIMILARITY_THRESHOLD = 0.85;
const CONSOLIDATE_THRESHOLD = 5;
const SAVE_DEBOUNCE_MS = 3000;

let currentSessionId = '';

export function setSessionId(id: string) { currentSessionId = id; }
export function getSessionId(): string { return currentSessionId; }

function uid(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureDir(): void {
  if (!existsSync(MEM_DIR)) mkdirSync(MEM_DIR, { recursive: true });
  if (!existsSync(STATS_FILE)) {
    writeFileSync(STATS_FILE, JSON.stringify({
      totalEntries: 0, byType: {}, totalTokens: 0,
      workingTokens: 0, semanticTokens: 0, proceduralTokens: 0, episodicTokens: 0,
      preferenceTokens: 0, patternTokens: 0,
      lastCleanup: 0, lastConsolidate: 0, compressCount: 0,
      preferenceCount: 0, patternCount: 0,
    }, null, 2), 'utf-8');
  }
  if (!existsSync(PREFS_FILE)) writeFileSync(PREFS_FILE, '[]', 'utf-8');
  if (!existsSync(PATTERNS_FILE)) writeFileSync(PATTERNS_FILE, '[]', 'utf-8');
}

function quickTokenEstimate(text: string): number {
  if (!text) return 0;
  const cjkMatches: RegExpMatchArray | null = text.match(/[\u4e00-\u9fff]/g);
  const cjk = cjkMatches ? cjkMatches.length : 0;
  const enMatches: RegExpMatchArray | null = text.match(/[a-zA-Z]+/g);
  const en = enMatches ? enMatches.reduce((s, w) => s + Math.ceil(w.length / 3.5), 0) : 0;
  return Math.max(1, Math.floor((cjk * 1.6 + en + text.length * 0.3) * 1.1));
}

function loadStats(): XMemStats {
  try {
    return JSON.parse(readFileSync(STATS_FILE, 'utf-8')) as XMemStats;
  } catch {
    return {
      totalEntries: 0, byType: {}, totalTokens: 0,
      workingTokens: 0, semanticTokens: 0, proceduralTokens: 0, episodicTokens: 0,
      preferenceTokens: 0, patternTokens: 0,
      lastCleanup: 0, lastConsolidate: 0, compressCount: 0,
      preferenceCount: 0, patternCount: 0,
    };
  }
}

function saveStats(s: XMemStats): void {
  writeFileSync(STATS_FILE, JSON.stringify(s, null, 2), 'utf-8');
}

function loadPrefs(): UserPreference[] {
  try { return JSON.parse(readFileSync(PREFS_FILE, 'utf-8')) as UserPreference[]; }
  catch { return []; }
}

function savePrefs(prefs: UserPreference[]): void {
  writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2), 'utf-8');
}

function loadPatterns(): WorkPattern[] {
  try { return JSON.parse(readFileSync(PATTERNS_FILE, 'utf-8')) as WorkPattern[]; }
  catch { return []; }
}

function savePatterns(patterns: WorkPattern[]): void {
  writeFileSync(PATTERNS_FILE, JSON.stringify(patterns, null, 2), 'utf-8');
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
  private preferences: UserPreference[] = [];
  private patterns: WorkPattern[] = [];
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
      tokenEstimate: quickTokenEstimate(content),
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
        if (entry.type === 'preference' && c.includes(kw)) keywordScore += 2;
        if (entry.type === 'pattern' && c.includes(kw)) keywordScore += 1.5;
      }

      const tfidfScore = this.tfidf.tfidfScore(entry.content, keywords);

      const recencyBoost = Math.max(0, 3 - (now - entry.accessedAt) / (1000 * 60 * 30));
      const frequencyBoost = Math.min(entry.accessCount * 0.3, 4);
      const importanceWeight = entry.importance * 0.6;
      const ageHours = (now - entry.createdAt) / (1000 * 60 * 60);
      const ageDecay = Math.min(ageHours / 48, 6);
      const successBonus = (entry.successRate || 0.5) * 2;

      const totalScore =
        keywordScore * 1.0 +
        tfidfScore * 2.0 +
        importanceWeight +
        recencyBoost +
        frequencyBoost +
        successBonus -
        ageDecay +
        (exactMatchBonus >= 3 ? 3 : 0);

      if (totalScore > 0) scored.push({ entry, score: totalScore });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => {
      s.entry.accessedAt = now;
      s.entry.accessCount++;
      s.entry.importance = Math.min(10, s.entry.importance + 0.05);
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

  getWorkingContext(maxTokens = 2000): string {
    if (this.working.length === 0) return '';
    const sorted = this.getWorking();
    const lines: string[] = [];
    let usedTokens = 0;
    for (const e of sorted) {
      const line = `[${e.source}] ${e.content.slice(0, 300)}`;
      const lt = quickTokenEstimate(line);
      if (usedTokens + lt > maxTokens) break;
      lines.push(line);
      usedTokens += lt;
    }
    return lines.join('\n');
  }

  getProceduralHints(task: string, limit = 5): string {
    const recalled = this.recall(task, limit, 3);
    const proc = recalled.filter(r => r.type === 'procedural' || r.type === 'semantic' || r.type === 'pattern');
    if (proc.length === 0) return '';
    return '[记忆提示]\n' + proc.map(p => {
      const icons: Record<string, string> = { procedural: '技能', semantic: '知识', pattern: '模式' };
      return `- [${icons[p.type] || p.type}] ${p.content.slice(0, 350)}`;
    }).join('\n');
  }

  getSessionSummary(): string {
    const entries = [...this.index.values()].filter(e => e.sessionId === currentSessionId);
    if (entries.length === 0) return '';

    const byType: Record<string, MemoryEntry[]> = { semantic: [], procedural: [], episodic: [], working: [], preference: [], pattern: [] };
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

  learnPreference(key: string, value: string, confidence = 5, category: UserPreference['category'] = 'other'): void {
    this.preferences = loadPrefs();
    const existing = this.preferences.find(p => p.key === key);
    if (existing) {
      if (existing.value !== value && existing.confidence < 3) {
        existing.value = value;
        existing.confidence = confidence;
      } else {
        existing.confidence = Math.min(10, existing.confidence + 0.5);
      }
      existing.evidenceCount++;
      existing.lastUpdated = Date.now();
    } else {
      this.preferences.push({ key, value, confidence: Math.min(10, confidence), lastUpdated: Date.now(), evidenceCount: 1, category });
      this.preferences = this.preferences.slice(-200);
    }
    savePrefs(this.preferences);

    this.store('preference', `${key}: ${value}`, [category, 'preference', key], Math.min(10, confidence), 7, 'system');
    this.dirty = true;
  }

  getPreferences(category?: UserPreference['category']): UserPreference[] {
    this.preferences = loadPrefs();
    let prefs = this.preferences.sort((a, b) => b.confidence - a.confidence);
    if (category) prefs = prefs.filter(p => p.category === category);
    return prefs.slice(0, 20);
  }

  getPreferencesPrompt(maxTokens = 2000): string {
    const prefs = this.getPreferences().filter(p => p.confidence >= 4);
    if (prefs.length === 0) return '';

    const byCat: Record<string, UserPreference[]> = {};
    for (const p of prefs) {
      if (!byCat[p.category]) byCat[p.category] = [];
      byCat[p.category].push(p);
    }

    const parts: string[] = [];
    const catNames: Record<string, string> = { language: '语言', framework: '框架', style: '风格', tool: '工具', workflow: '工作流', naming: '命名', other: '其他' };

    let used = 0;
    const budget = maxTokens * 3;
    for (const [cat, items] of Object.entries(byCat)) {
      const lines = items.map(p => `- ${p.key}: ${p.value} (置信${p.confidence.toFixed(0)})`).join('\n');
      const text = `[用户偏好·${catNames[cat] || cat}]\n${lines}`;
      if (used + text.length > budget) break;
      parts.push(text);
      used += text.length;
    }

    return parts.join('\n');
  }

  learnPattern(description: string, steps: string[], tools: string[]): string {
    this.patterns = loadPatterns();
    const existing = this.patterns.find(p =>
      similarity(p.description, description) > 0.7
    );
    if (existing) {
      existing.frequency++;
      existing.lastUsed = Date.now();
      existing.totalExecutions++;
      existing.steps = steps.length > existing.steps.length ? steps : existing.steps;
      existing.tools = [...new Set([...existing.tools, ...tools])];
      savePatterns(this.patterns);
      this.dirty = true;
      return existing.id;
    }

    const id = uid();
    this.patterns.push({ id, description, steps, tools, frequency: 1, lastUsed: Date.now(), successRate: 1, totalExecutions: 1 });
    this.patterns = this.patterns.slice(-100);
    savePatterns(this.patterns);

    const patternContent = `工作模式: ${description} (${tools.join(', ')})\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
    this.store('pattern', patternContent, ['pattern', 'workflow', ...tools], 7, 8, 'system');

    return id;
  }

  getPatterns(): WorkPattern[] {
    this.patterns = loadPatterns();
    return this.patterns.sort((a, b) => b.frequency - a.frequency);
  }

  autoLearn(userMessages: string[], assistantResponses: string[], toolCalls: string[]): void {
    const langHints: [string, string][] = [];
    const frameworkHints: [string, string][] = [];
    const styleHints: [string, string][] = [];
    const namingHints: [string, string][] = [];

    for (const msg of userMessages) {
      if (/react/i.test(msg)) frameworkHints.push(['首选框架', 'React']);
      if (/vue/i.test(msg)) frameworkHints.push(['首选框架', 'Vue']);
      if (/next\.?js/i.test(msg)) frameworkHints.push(['首选框架', 'Next.js']);
      if (/tailwind/i.test(msg)) styleHints.push(['CSS方案', 'Tailwind CSS']);
      if (/typescript/i.test(msg)) langHints.push(['首选语言', 'TypeScript']);
      if (/python/i.test(msg)) langHints.push(['首选语言', 'Python']);
      if (/camelCase/i.test(msg)) namingHints.push(['命名风格', 'camelCase']);
      if (/snake_case/i.test(msg)) namingHints.push(['命名风格', 'snake_case']);
    }

    for (const tc of toolCalls) {
      if (/write_file.*\.tsx/i.test(tc)) langHints.push(['首选语言', 'TypeScript']);
      if (/write_file.*\.jsx/i.test(tc)) langHints.push(['首选语言', 'JavaScript']);
      if (/npm.*install/i.test(tc)) frameworkHints.push(['包管理', 'npm']);
      if (/yarn/i.test(tc)) frameworkHints.push(['包管理', 'yarn']);
      if (/pnpm/i.test(tc)) frameworkHints.push(['包管理', 'pnpm']);
    }

    const allHints = [...langHints, ...frameworkHints, ...styleHints, ...namingHints];
    for (const [key, value] of allHints) {
      this.learnPreference(key, value, 3, key.includes('语言') ? 'language' : key.includes('框架') ? 'framework' : key.includes('CSS') ? 'style' : 'other');
    }

    if (toolCalls.length >= 5) {
      const lastTools = toolCalls.slice(-10);
      const toolSet = [...new Set(lastTools)];
      if (toolSet.length >= 3) {
        const desc = `复合工作流: ${toolSet.slice(0, 5).join(' → ')}`;
        this.learnPattern(desc, lastTools.slice(0, 6), toolSet);
      }
    }
  }

  reinforce(targetId: string, feedback: 'positive' | 'negative'): void {
    const entry = this.index.get(targetId);
    if (!entry) return;

    if (feedback === 'positive') {
      entry.importance = Math.min(10, entry.importance + 1.5);
      entry.accuracy = Math.min(10, entry.accuracy + 0.5);
      entry.accessCount += 2;
      entry.feedback = 'positive';
      entry.successRate = Math.min(1, (entry.successRate || 0.5) + 0.15);
    } else {
      entry.importance = Math.max(0, entry.importance - 1);
      entry.accuracy = Math.max(0, entry.accuracy - 0.5);
      entry.feedback = 'negative';
      entry.successRate = Math.max(0, (entry.successRate || 0.5) - 0.1);
    }

    this.dirty = true;
    this.scheduleSave();
  }

  reinforceByContent(content: string, feedback: 'positive' | 'negative', tolerance = 0.6): void {
    const short = content.slice(0, 300);
    let best: MemoryEntry | null = null;
    let bestSim = 0;
    for (const entry of this.index.values()) {
      const sim = similarity(short, entry.content.slice(0, 300));
      if (sim > bestSim && sim >= tolerance) { bestSim = sim; best = entry; }
    }
    if (best) this.reinforce(best.id, feedback);
  }

  getUserContext(maxTokens = 4000): string {
    const prefPrompt = this.getPreferencesPrompt(Math.floor(maxTokens / 2));
    const prefTok = quickTokenEstimate(prefPrompt);
    const remainingTok = maxTokens - prefTok;

    const patterns = this.getPatterns().slice(0, 5);
    let patternPrompt = '';
    if (patterns.length > 0 && remainingTok > 500) {
      patternPrompt = '[用户模式]\n' + patterns.map(p =>
        `- ${p.description} (${p.frequency}次, 成功率${(p.successRate * 100).toFixed(0)}%)`
      ).join('\n');
    }

    return [prefPrompt, patternPrompt].filter(Boolean).join('\n\n');
  }

  getStats(): XMemStats {
    const stats = loadStats();
    const byType: Record<string, number> = {};
    let wTok = 0, sTok = 0, pTok = 0, eTok = 0, prefTok = 0, patTok = 0;
    for (const e of this.index.values()) {
      byType[e.type] = (byType[e.type] || 0) + 1;
      const t = e.tokenEstimate || quickTokenEstimate(e.content);
      if (e.type === 'working') wTok += t;
      else if (e.type === 'semantic') sTok += t;
      else if (e.type === 'procedural') pTok += t;
      else if (e.type === 'preference') prefTok += t;
      else if (e.type === 'pattern') patTok += t;
      else eTok += t;
    }
    this.preferences = loadPrefs();
    this.patterns = loadPatterns();
    return {
      ...stats,
      totalEntries: this.index.size,
      byType,
      totalTokens: wTok + sTok + pTok + eTok + prefTok + patTok,
      workingTokens: wTok, semanticTokens: sTok, proceduralTokens: pTok, episodicTokens: eTok,
      preferenceTokens: prefTok, patternTokens: patTok,
      preferenceCount: this.preferences.length, patternCount: this.patterns.length,
    };
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
      const toSave = entries.slice(-800);
      writeFileSync(file, JSON.stringify(toSave), 'utf-8');
    }

    const stats = this.getStats();
    stats.lastCleanup = stats.lastCleanup || Date.now();
    stats.lastConsolidate = stats.lastConsolidate || Date.now();
    saveStats(stats);
    savePrefs(this.preferences);
    savePatterns(this.patterns);

    this.dirty = false;
  }

  async load(): Promise<void> {
    ensureDir();
    let total = 0;

    for (const type of ['working', 'episodic', 'semantic', 'procedural', 'preference', 'pattern']) {
      const file = join(MEM_DIR, `${type}.json`);
      if (!existsSync(file)) continue;
      try {
        const entries = JSON.parse(readFileSync(file, 'utf-8')) as MemoryEntry[];
        for (const entry of entries) {
          if (total > MAX_TOTAL_MEM) break;
          if (!entry.tokenEstimate) entry.tokenEstimate = quickTokenEstimate(entry.content);
          this.index.set(entry.id, entry);
          if (entry.type === 'working') this.working.push(entry);
          total++;
        }
      } catch {}
    }

    if (this.working.length > MAX_WORKING_MEM) {
      this.working = this.working.slice(-MAX_WORKING_MEM);
    }

    this.preferences = loadPrefs();
    this.patterns = loadPatterns();
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
          entry.tokenEstimate = quickTokenEstimate(content);
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
      const summary = `[consolidated from ${group.length} memories]\n${allContent.slice(0, 2000)}`;

      const newType = best.accessCount >= 10 ? 'procedural' : 'semantic';
      const existing = this.findSimilar(newType, best.content);
      if (existing) {
        existing.content = summary.slice(0, 4000);
        existing.tokenEstimate = quickTokenEstimate(summary);
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
      const scoreA = a.importance * 2 + a.accessCount + (a.type === 'semantic' ? 3 : a.type === 'procedural' ? 2 : a.type === 'preference' ? 4 : 0) - (Date.now() - a.accessedAt) / (1000 * 60 * 60 * 24);
      const scoreB = b.importance * 2 + b.accessCount + (b.type === 'semantic' ? 3 : b.type === 'procedural' ? 2 : b.type === 'preference' ? 4 : 0) - (Date.now() - b.accessedAt) / (1000 * 60 * 60 * 24);
      return scoreA - scoreB;
    });

    const toKeep = entries.slice(-1000);
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
