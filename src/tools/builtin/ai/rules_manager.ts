import { readFileSync, existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEEPER_HOME } from '../../../core/constants.js';
import type { Tool } from '../../../tools/tool-types.js';

export const rules_manager: Tool = {
  name: 'rules_manager',
  description: '管理项目或全局规则。可读取/添加/更新/删除 .deeper/rules.md 中的规则。',
  category: 'ai',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: '操作: view, add, update, delete, list',
        enum: ['view', 'add', 'update', 'delete', 'list'],
      },
      scope: {
        type: 'string',
        description: '作用域: project (项目规则) 或 global (全局规则)。默认 project',
        enum: ['project', 'global'],
      },
      rule: { type: 'string', description: '规则内容（add/update 时必填）' },
      index: { type: 'number', description: '规则行号或序号（update/delete 时使用, 从1开始）' },
    },
    required: ['action'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const action = params.action as string;
      const scope = (params.scope as string) || 'project';
      const ruleContent = params.rule as string | undefined;

      const rulesPath = scope === 'project'
        ? join(process.cwd(), '.deeper', 'rules.md')
        : join(DEEPER_HOME, 'rules.md');

      const dir = scope === 'project' ? join(process.cwd(), '.deeper') : DEEPER_HOME;
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      switch (action) {
        case 'view':
        case 'list': {
          if (!existsSync(rulesPath)) {
            return { success: true, output: `(${scope}) 暂无规则。使用 rules_manager add 添加`, metadata: { rules: [], count: 0 } };
          }
          const content = readFileSync(rulesPath, 'utf-8');
          const rules = content.split('\n').filter(l => l.trim()).map((l, i) => `${i + 1}. ${l}`);
          return {
            success: true,
            output: `[${scope} 规则] ${rulesPath}\n\n${rules.join('\n')}`,
            metadata: { rules: content.split('\n').filter(l => l.trim()), count: rules.length },
          };
        }
        case 'add': {
          if (!ruleContent) return { success: false, error: '请提供 rule 参数', output: '' };
          const header = `\n<!-- 规则 #${Date.now().toString(36)} -->\n`;
          appendFileSync(rulesPath, header + ruleContent + '\n', 'utf-8');
          const lines = existsSync(rulesPath) ? readFileSync(rulesPath, 'utf-8').split('\n').filter(l => l.trim()).length : 0;
          return { success: true, output: `已添加 ${scope} 规则 (共 ${lines} 条)`, metadata: { action: 'add', totalRules: lines } };
        }
        case 'update': {
          const idx = (params.index as number) || 1;
          if (!ruleContent) return { success: false, error: '请提供 rule 参数', output: '' };
          if (!existsSync(rulesPath)) return { success: false, error: `无 ${scope} 规则文件`, output: '' };
          const lines = readFileSync(rulesPath, 'utf-8').split('\n');
          if (idx < 1 || idx > lines.length) return { success: false, error: `无效序号 ${idx}`, output: '' };
          lines[idx - 1] = ruleContent;
          writeFileSync(rulesPath, lines.join('\n'), 'utf-8');
          return { success: true, output: `已更新 ${scope} 规则 #${idx}`, metadata: { action: 'update', index: idx } };
        }
        case 'delete': {
          const idx = (params.index as number) || 1;
          if (!existsSync(rulesPath)) return { success: false, error: `无 ${scope} 规则文件`, output: '' };
          const lines = readFileSync(rulesPath, 'utf-8').split('\n');
          if (idx < 1 || idx > lines.length) return { success: false, error: `无效序号 ${idx}`, output: '' };
          const removed = lines[idx - 1];
          lines.splice(idx - 1, 1);
          writeFileSync(rulesPath, lines.join('\n'), 'utf-8');
          return { success: true, output: `已删除 ${scope} 规则 #${idx}: ${removed.slice(0, 60)}`, metadata: { action: 'delete', index: idx } };
        }
        default:
          return { success: false, error: `未知操作: ${action}`, output: '' };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
