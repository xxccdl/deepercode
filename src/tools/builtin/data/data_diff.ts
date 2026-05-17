import type { Tool } from '../../tool-types.js';

export const data_diff: Tool = {
  name: 'data_diff',
  description: '比较两个数据集的差异',
  category: 'data',
  parameters: {
    type: 'object',
    properties: {
      data_a: { type: 'string', description: '数据集 A (JSON)' },
      data_b: { type: 'string', description: '数据集 B (JSON)' },
    },
    required: ['data_a', 'data_b'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const a = JSON.parse(params.data_a as string);
      const b = JSON.parse(params.data_b as string);

      const diff = computeDiff(a, b, '');
      const output = diff.length > 0 ? diff.join('\n') : '两个数据集完全相同';

      return { success: true, output, metadata: { differences: diff.length } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};

function computeDiff(a: unknown, b: unknown, path: string): string[] {
  const results: string[] = [];

  if (a === b) return results;

  if (typeof a !== typeof b) {
    results.push(`${path || 'root'}: 类型不同 (${typeof a} vs ${typeof b})`);
    return results;
  }

  if (a === null || b === null || typeof a !== 'object') {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      results.push(`${path || 'root'}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
    }
    return results;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      results.push(...computeDiff(a[i], b[i], `${path}[${i}]`));
    }
    return results;
  }

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  const allKeys = new Set([...keysA, ...keysB]);

  for (const key of allKeys) {
    const valA = (a as Record<string, unknown>)[key];
    const valB = (b as Record<string, unknown>)[key];

    if (!(key in (a as object))) {
      results.push(`${path}.${key}: 新增 → ${JSON.stringify(valB)}`);
    } else if (!(key in (b as object))) {
      results.push(`${path}.${key}: 已删除 (原值: ${JSON.stringify(valA)})`);
    } else {
      if (typeof valA === 'object' && typeof valB === 'object' && valA !== null && valB !== null) {
        results.push(...computeDiff(valA, valB, `${path}.${key}`));
      } else if (valA !== valB) {
        results.push(`${path}.${key}: ${JSON.stringify(valA)} → ${JSON.stringify(valB)}`);
      }
    }
  }

  return results;
}
