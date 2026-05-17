import type { Tool } from '../../tool-types.js';

export const data_validate: Tool = {
  name: 'data_validate',
  description: '根据 schema 验证数据',
  category: 'data',
  parameters: {
    type: 'object',
    properties: {
      data: { type: 'string', description: 'JSON 数据' },
      schema: { type: 'string', description: 'JSON Schema 用于验证' },
    },
    required: ['data', 'schema'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const data = JSON.parse(params.data as string);
      const schema = JSON.parse(params.schema as string);

      const errors = validateAgainstSchema(data, schema);

      if (errors.length === 0) {
        return { success: true, output: '数据验证通过！' };
      }
      return {
        success: false,
        error: `数据验证失败 (${errors.length} 个问题)`,
        output: errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n'),
      };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};

function validateAgainstSchema(data: unknown, schema: Record<string, unknown>, path = '$'): string[] {
  const errors: string[] = [];

  if (schema.type) {
    const expectedType = schema.type as string;
    const actualType = Array.isArray(data) ? 'array' : typeof data;
    if (expectedType !== actualType) {
      errors.push(`${path}: 期望类型 "${expectedType}"，实际类型 "${actualType}"`);
      return errors;
    }
  }

  if (schema.required && Array.isArray(schema.required) && data && typeof data === 'object') {
    for (const key of schema.required as string[]) {
      if (!(key in (data as Record<string, unknown>))) {
        errors.push(`${path}: 缺少必需字段 "${key}"`);
      }
    }
  }

  if (schema.properties && data && typeof data === 'object' && !Array.isArray(data)) {
    const props = schema.properties as Record<string, Record<string, unknown>>;
    for (const [key, propSchema] of Object.entries(props)) {
      if (key in data) {
        errors.push(...validateAgainstSchema((data as Record<string, unknown>)[key], propSchema, `${path}.${key}`));
      }
    }
  }

  if (schema.enum && Array.isArray(schema.enum)) {
    const enumValues = schema.enum;
    if (!enumValues.includes(data)) {
      errors.push(`${path}: 值 "${data}" 不在允许的范围: [${enumValues.join(', ')}]`);
    }
  }

  return errors;
}
