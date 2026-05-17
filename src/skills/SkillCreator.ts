import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEEPER_SKILLS_DIR } from '../core/constants.js';
import type { Skill, SkillMeta } from './types.js';

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

export interface CreateSkillInput {
  meta: SkillMeta;
  content: string;
  code?: string;
}

export class SkillCreator {
  private outputDir: string;

  constructor(outputDir?: string) {
    this.outputDir = outputDir || DEEPER_SKILLS_DIR;
  }

  async create(input: CreateSkillInput): Promise<Skill> {
    const skillDir = join(this.outputDir, input.meta.name);

    await mkdir(skillDir, { recursive: true });

    const yamlFrontmatter = this.buildYamlFrontmatter(input.meta);
    const mdContent = `---\n${yamlFrontmatter}---\n\n${input.content}`;

    const mdPath = join(skillDir, 'skill.md');
    await writeFile(mdPath, mdContent, 'utf-8');

    if (input.code) {
      const jsPath = join(skillDir, 'skill.js');
      await writeFile(jsPath, input.code, 'utf-8');
    }

    return {
      meta: input.meta,
      content: input.content,
      code: input.code,
    };
  }

  async update(name: string, updates: Partial<CreateSkillInput>): Promise<Skill | null> {
    const skillDir = join(this.outputDir, name);
    const mdPath = join(skillDir, 'skill.md');

    if (!existsSync(mdPath)) {
      return null;
    }

    const { readFile } = await import('node:fs/promises');
    const existingMd = await readFile(mdPath, 'utf-8');

    let existingMeta: SkillMeta = {
      name,
      description: '',
      version: '1.0.0',
      author: 'unknown',
      triggers: [],
      tools: [],
      dependencies: [],
    };

    let existingBody = existingMd;

    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
    const match = existingMd.match(frontmatterRegex);
    if (match) {
      try {
        const parsed = parseSimpleYaml(match[1]) as Record<string, unknown>;
        existingMeta = {
          name: (parsed.name as string) || name,
          description: (parsed.description as string) || '',
          version: (parsed.version as string) || '1.0.0',
          author: (parsed.author as string) || 'unknown',
          triggers: Array.isArray(parsed.triggers) ? parsed.triggers.map(String) : [],
          tools: Array.isArray(parsed.tools) ? parsed.tools.map(String) : [],
          dependencies: Array.isArray(parsed.dependencies) ? parsed.dependencies.map(String) : [],
        };
      } catch {
        // Use defaults
      }
      existingBody = match[2];
    }

    const newMeta: SkillMeta = {
      ...existingMeta,
      ...updates.meta,
    };

    const newContent = updates.content || existingBody;

    return this.create({
      meta: newMeta,
      content: newContent,
      code: updates.code,
    });
  }

  private buildYamlFrontmatter(meta: SkillMeta): string {
    const lines: string[] = [];
    lines.push(`name: ${meta.name}`);
    lines.push(`description: ${meta.description}`);
    lines.push(`version: ${meta.version}`);
    lines.push(`author: ${meta.author}`);

    if (meta.triggers.length > 0) {
      lines.push('triggers:');
      for (const t of meta.triggers) {
        lines.push(`  - ${t}`);
      }
    }

    if (meta.tools.length > 0) {
      lines.push('tools:');
      for (const t of meta.tools) {
        lines.push(`  - ${t}`);
      }
    }

    if (meta.dependencies.length > 0) {
      lines.push('dependencies:');
      for (const d of meta.dependencies) {
        lines.push(`  - ${d}`);
      }
    }

    return lines.join('\n') + '\n';
  }
}
