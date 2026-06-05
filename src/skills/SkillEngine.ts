import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEEPER_SKILLS_DIR, PROJECT_SKILLS_DIR } from '../core/constants.js';

interface SkillDef {
  name: string;
  description: string;
  version: string;
  triggers: string[];
  content: string;
  path: string;
  source: 'global' | 'project';
  enabled: boolean;
}

interface SkillMeta {
  name: string;
  description: string;
  triggers: string[];
  enabled: boolean;
  source: 'global' | 'project';
}

export class SkillEngine {
  private skills: SkillDef[] = [];
  private activeTriggers: Map<string, SkillDef[]> = new Map();

  constructor() {}

  async loadAll(): Promise<number> {
    this.skills = [];
    this.activeTriggers.clear();

    const dirs = [
      { dir: DEEPER_SKILLS_DIR, source: 'global' as const },
      { dir: join(process.cwd(), PROJECT_SKILLS_DIR), source: 'project' as const },
    ];

    for (const { dir, source } of dirs) {
      if (!existsSync(dir)) continue;
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const mdFile = join(dir, entry.name, 'skill.md');
          if (!existsSync(mdFile)) continue;

          const skill = this.parseSkillFile(mdFile, source);
          if (skill) {
            this.skills.push(skill);
            for (const trigger of skill.triggers) {
              const t = trigger.toLowerCase();
              if (!this.activeTriggers.has(t)) this.activeTriggers.set(t, []);
              this.activeTriggers.get(t)!.push(skill);
            }
          }
        }
      } catch {}
    }

    this.skills.sort((a, b) => {
      if (a.source !== b.source) return a.source === 'project' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return this.skills.length;
  }

  private parseSkillFile(filePath: string, source: 'global' | 'project'): SkillDef | null {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!match) {
        if (raw.trim()) {
          return {
            name: filePath.split(/[\\/]/).slice(-2, -1)[0] || 'unnamed',
            description: '',
            version: '1.0.0',
            triggers: [],
            content: raw.trim(),
            path: filePath,
            source,
            enabled: true,
          };
        }
        return null;
      }

      const yamlStr = match[1];
      const body = match[2].trim();
      const meta = this.parseYaml(yamlStr);

      return {
        name: meta.name || '',
        description: meta.description || '',
        version: meta.version || '1.0.0',
        triggers: meta.triggers || [],
        content: body,
        path: filePath,
        source,
        enabled: true,
      };
    } catch {
      return null;
    }
  }

  private parseYaml(yaml: string): Record<string, any> {
    const result: Record<string, any> = {};
    let currentKey = '';
    let currentList: string[] = [];

    for (const line of yaml.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const listMatch = trimmed.match(/^-\s+(.+)$/);
      if (listMatch && currentKey) {
        currentList.push(listMatch[1]);
        continue;
      }

      if (currentKey && currentList.length > 0) {
        result[currentKey] = currentList;
        currentList = [];
        currentKey = '';
      }

      const kvMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
      if (kvMatch) {
        currentKey = kvMatch[1];
        const value = kvMatch[2].trim();
        result[currentKey] = value || '';
      }
    }

    if (currentKey && currentList.length > 0) {
      result[currentKey] = currentList;
    }

    return result;
  }

  getSystemPrompt(): string {
    if (this.skills.length === 0) return '';
    const parts: string[] = [];
    parts.push(`[已加载 ${this.skills.length} Skills]`);

    for (const skill of this.skills) {
      const loc = skill.source === 'project' ? 'Project' : 'Global';
      const triggerStr = skill.triggers.length > 0 ? `(触发: ${skill.triggers.join(', ')})` : '';
      parts.push(
        `## Skill: ${skill.name} [${loc}] ${triggerStr}\n${skill.description}\n\n${skill.content.slice(0, 2000)}`
      );
    }

    return parts.join('\n\n');
  }

  getActiveSkills(userInput: string): SkillDef[] {
    const input = userInput.toLowerCase();
    const active = new Set<SkillDef>();

    for (const [trigger, skills] of this.activeTriggers) {
      if (input.includes(trigger)) {
        for (const s of skills) active.add(s);
      }
    }

    for (const skill of this.skills) {
      if (skill.triggers.length === 0 && skill.source === 'project') {
        active.add(skill);
      }
    }

    return [...active];
  }

  getActivePrompt(userInput: string, maxTokens = 3000): string {
    const active = this.getActiveSkills(userInput);
    if (active.length === 0) return '';

    const parts: string[] = [];
    parts.push(`[匹配 ${active.length} Skills]`);

    let used = 0;
    const budget = maxTokens * 3;
    for (const skill of active) {
      const text = `## ${skill.name}: ${skill.description}\n${skill.content.slice(0, 800)}`;
      if (used + text.length > budget) break;
      parts.push(text);
      used += text.length;
    }

    return parts.join('\n\n');
  }

  list(): SkillMeta[] {
    return this.skills.map(s => ({
      name: s.name,
      description: s.description,
      triggers: s.triggers,
      enabled: s.enabled,
      source: s.source,
    }));
  }

  getCount(): number { return this.skills.length; }

  reload(): Promise<number> { return this.loadAll(); }
}
