import { readFile, readdir } from 'node:fs/promises';
import { existsSync, watch } from 'node:fs';
import { join } from 'node:path';
import { DEEPER_SKILLS_DIR, PROJECT_SKILLS_DIR } from '../core/constants.js';
import type { Skill, SkillMeta, SkillLoadResult } from './types.js';

function parseSimpleYaml(s: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = s.split('\n');
  let listKey = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const listMatch = trimmed.match(/^\s*-\s+(.+)/);
    if (listMatch && listKey) {
      const arr = (result[listKey] as string[]) || [];
      arr.push(listMatch[1]);
      result[listKey] = arr;
      continue;
    }
    const kv = trimmed.match(/^([^:]+):\s*(.*)/);
    if (kv) {
      listKey = kv[2] === '' ? kv[1].trim() : '';
      if (!listKey) result[kv[1].trim()] = kv[2].trim();
    }
  }
  return result;
}

interface FrontmatterResult {
  meta: SkillMeta;
  body: string;
}

export class SkillLoader {
  private scanDirs: string[];
  private watchers: Array<ReturnType<typeof watch>> = [];

  constructor(additionalDirs?: string[]) {
    this.scanDirs = [DEEPER_SKILLS_DIR, PROJECT_SKILLS_DIR];
    if (additionalDirs) {
      this.scanDirs.push(...additionalDirs);
    }
  }

  async loadAll(): Promise<SkillLoadResult[]> {
    const results: SkillLoadResult[] = [];

    for (const dir of this.scanDirs) {
      if (!existsSync(dir)) continue;
      const dirResults = await this.scanDirectory(dir);
      results.push(...dirResults);
    }

    return results;
  }

  async loadSingle(dirPath: string, skillName: string): Promise<SkillLoadResult | null> {
    const mdPath = join(dirPath, skillName, 'skill.md');
    const jsPath = join(dirPath, skillName, 'skill.js');

    if (!existsSync(mdPath)) return null;

    try {
      const mdContent = await readFile(mdPath, 'utf-8');
      const { meta, body } = this.parseFrontmatter(mdContent);

      let code: string | undefined;
      if (existsSync(jsPath)) {
        code = await readFile(jsPath, 'utf-8');
      }

      const skill: Skill = { meta, content: body, code };

      return {
        skill,
        source: dirPath,
        fromCodeFile: !!code,
      };
    } catch {
      return null;
    }
  }

  startWatching(callback: (result: SkillLoadResult) => void): void {
    for (const dir of this.scanDirs) {
      if (!existsSync(dir)) continue;

      try {
        const watcher = watch(dir, { recursive: true }, async (_eventType, filename) => {
          if (!filename) return;
          const parts = filename.toString().split(/[/\\]/);
          if (parts.length < 2) return;

          const skillName = parts[0];
          const result = await this.loadSingle(dir, skillName);
          if (result) {
            callback(result);
          }
        });
        this.watchers.push(watcher);
      } catch {
        continue;
      }
    }
  }

  stopWatching(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }

  private async scanDirectory(dirPath: string): Promise<SkillLoadResult[]> {
    const results: SkillLoadResult[] = [];

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillDir = join(dirPath, entry.name);
        const mdFile = join(skillDir, 'skill.md');

        if (!existsSync(mdFile)) continue;

        const result = await this.loadSingle(dirPath, entry.name);
        if (result) {
          results.push(result);
        }
      }
    } catch {
      // Directory may not exist yet
    }

    return results;
  }

  private parseFrontmatter(markdown: string): FrontmatterResult {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
    const match = markdown.match(frontmatterRegex);

    if (!match) {
      return {
        meta: {
          name: 'unnamed',
          description: 'No description',
          version: '1.0.0',
          author: 'unknown',
          triggers: [],
          tools: [],
          dependencies: [],
        },
        body: markdown,
      };
    }

    const yamlContent = match[1];
    const body = match[2];

    let parsed: Record<string, unknown> = {};
    try {
      parsed = parseSimpleYaml(yamlContent) as Record<string, unknown>;
    } catch {
      // If YAML parsing fails, use defaults
    }

    const meta: SkillMeta = {
      name: (parsed.name as string) || 'unnamed',
      description: (parsed.description as string) || 'No description',
      version: (parsed.version as string) || '1.0.0',
      author: (parsed.author as string) || 'unknown',
      triggers: Array.isArray(parsed.triggers) ? parsed.triggers.map(String) : [],
      tools: Array.isArray(parsed.tools) ? parsed.tools.map(String) : [],
      dependencies: Array.isArray(parsed.dependencies) ? parsed.dependencies.map(String) : [],
    };

    return { meta, body };
  }
}
