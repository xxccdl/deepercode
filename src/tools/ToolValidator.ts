import type { Tool, ToolResult, JSONSchema } from './tool-types.js';

function getPropType(schema: JSONSchema, path: string): string {
  return schema.type ?? 'any';
}

function checkRequired(
  params: Record<string, unknown>,
  schema: JSONSchema,
  errors: string[]
): void {
  const required = schema.required ?? [];
  for (const key of required) {
    if (!(key in params) || params[key] === undefined) {
      errors.push(`缺少必需参数: ${key}`);
    }
  }
}

function checkTypes(
  params: Record<string, unknown>,
  schema: JSONSchema,
  path: string,
  errors: string[]
): void {
  const props = schema.properties;
  if (!props) return;

  for (const [key, propSchema] of Object.entries(props)) {
    const value = params[key];
    const fullPath = path ? `${path}.${key}` : key;

    if (value === undefined || value === null) continue;

    switch (propSchema.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`参数 "${fullPath}" 应为字符串类型`);
        }
        if (propSchema.enum && !propSchema.enum.includes(value as string)) {
          errors.push(`参数 "${fullPath}" 值不在允许范围内: ${propSchema.enum.join(', ')}`);
        }
        break;
      case 'number':
      case 'integer':
        if (typeof value !== 'number') {
          errors.push(`参数 "${fullPath}" 应为数字类型`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`参数 "${fullPath}" 应为布尔类型`);
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`参数 "${fullPath}" 应为数组类型`);
        } else if (propSchema.items) {
          const itemSchema = propSchema.items;
          for (let i = 0; i < value.length; i++) {
            if (itemSchema.type === 'string' && typeof value[i] !== 'string') {
              errors.push(`参数 "${fullPath}[${i}]" 应为字符串类型`);
            } else if (itemSchema.type === 'number' && typeof value[i] !== 'number') {
              errors.push(`参数 "${fullPath}[${i}]" 应为数字类型`);
            }
          }
        }
        break;
      case 'object':
        if (typeof value !== 'object' || value === null) {
          errors.push(`参数 "${fullPath}" 应为对象类型`);
        } else if (propSchema.properties) {
          checkTypes(value as Record<string, unknown>, propSchema, fullPath, errors);
        }
        break;
    }
  }
}

export class ToolValidator {
  validate(tool: Tool, params: Record<string, unknown>): ToolResult {
    const errors: string[] = [];
    const schema = tool.parameters;

    checkRequired(params, schema, errors);
    checkTypes(params, schema, '', errors);

    if (errors.length > 0) {
      return {
        success: false,
        output: '',
        error: `参数验证失败:\n${errors.map(e => `  - ${e}`).join('\n')}`,
        metadata: { validationErrors: errors },
      };
    }

    return { success: true, output: '参数验证通过' };
  }

  validateMany(tool: Tool, calls: Record<string, unknown>[]): ToolResult[] {
    return calls.map(params => this.validate(tool, params));
  }
}
