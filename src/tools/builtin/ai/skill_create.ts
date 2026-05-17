import { mkdirSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DEEPER_SKILLS_DIR } from '../../../core/constants.js';
import type { Tool } from '../../../tools/tool-types.js';

export const skill_create: Tool = {
  name: 'skill_create',
  description: '创建新 Skill（写入 ~/.deeper/skills/<name>/skill.md）。Skill 会在后续对话中被自动加载和识别。',
  category: 'ai',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Skill 名称（英文+连字符，如 "react-expert"）' },
      description: { type: 'string', description: 'Skill 用途描述' },
      prompt: { type: 'string', description: 'Skill 的 Markdown 指令内容（包含操作步骤、最佳实践等）' },
      triggers: { type: 'array', items: { type: 'string' }, description: '触发词（如 ["react", "component"]）' },
    },
    required: ['name', 'prompt'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const name = params.name as string;
      const description = (params.description as string) || `${name} 技能`;
      const prompt = params.prompt as string;
      const triggers = (params.triggers as string[]) || [];

      const skillDir = join(DEEPER_SKILLS_DIR, name);
      if (!existsSync(skillDir)) mkdirSync(skillDir, { recursive: true });

      const yaml = [
        `name: ${name}`,
        `description: ${description}`,
        `version: 1.0.0`,
        `author: DeeperCode AI`,
        triggers.length > 0 ? `triggers:\n${triggers.map(t => `  - ${t}`).join('\n')}` : '',
      ].filter(Boolean).join('\n');

      const md = `---\n${yaml}\n---\n\n${prompt}`;
      await writeFile(join(skillDir, 'skill.md'), md, 'utf-8');

      return {
        success: true,
        output: `Skill "${name}" 已创建\n  路径: ${skillDir}/skill.md\n  提示: 新对话开始时生效`,
        metadata: { name, description, triggerCount: triggers.length },
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
