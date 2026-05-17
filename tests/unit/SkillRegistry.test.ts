import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../../src/skills/SkillRegistry.js';
import type { Skill } from '../../src/skills/types.js';

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    meta: {
      name: 'pdf',
      description: 'Handle PDF files',
      version: '1.0.0',
      author: 'deeper',
      triggers: ['pdf', '合并pdf', '提取pdf'],
      tools: ['read_file', 'write_file'],
      dependencies: ['pdf-lib'],
    },
    content: '# PDF Skill\n\n处理 PDF 文件。',
    ...overrides,
  };
}

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  it('应正确注册 Skill', () => {
    registry.register(makeSkill());
    expect(registry.size).toBe(1);
  });

  it('重复注册应抛出错误', () => {
    registry.register(makeSkill());
    expect(() => registry.register(makeSkill())).toThrow('already registered');
  });

  it('应能获取 Skill', () => {
    registry.register(makeSkill());
    const skill = registry.get('pdf');
    expect(skill).toBeDefined();
    expect(skill!.meta.name).toBe('pdf');
  });

  it('获取不存在的 Skill 返回 undefined', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('应能注销 Skill', () => {
    registry.register(makeSkill());
    expect(registry.unregister('pdf')).toBe(true);
    expect(registry.size).toBe(0);
    expect(registry.unregister('pdf')).toBe(false);
  });

  it('findByTrigger 应通过关键词匹配', () => {
    registry.register(makeSkill());
    const matches = registry.findByTrigger('合并pdf文件');
    expect(matches).toHaveLength(1);

    const noMatch = registry.findByTrigger('excel');
    expect(noMatch).toHaveLength(0);
  });

  it('findByTool 应通过工具名查找', () => {
    registry.register(makeSkill());
    const matches = registry.findByTool('read_file');
    expect(matches).toHaveLength(1);

    const noMatch = registry.findByTool('unknown_tool');
    expect(noMatch).toHaveLength(0);
  });

  it('findByDependency 应通过依赖查找', () => {
    registry.register(makeSkill());
    const matches = registry.findByDependency('pdf-lib');
    expect(matches).toHaveLength(1);

    const noMatch = registry.findByDependency('unknown-dep');
    expect(noMatch).toHaveLength(0);
  });

  it('getAll 应返回所有 Skill', () => {
    registry.register(makeSkill({ meta: { ...makeSkill().meta, name: 'pdf' } }));
    const skill2: Skill = {
      meta: {
        name: 'web-dev',
        description: 'Web development',
        version: '1.0.0',
        author: 'deeper',
        triggers: ['web', 'html', 'css'],
        tools: ['write_file'],
        dependencies: [],
      },
      content: '# Web Dev Skill',
    };
    registry.register(skill2);
    expect(registry.getAll()).toHaveLength(2);
  });

  it('getMeta 应返回所有元数据', () => {
    registry.register(makeSkill());
    const metas = registry.getMeta();
    expect(metas).toHaveLength(1);
    expect(metas[0].name).toBe('pdf');
  });

  it('clear 应清空所有 Skill', () => {
    registry.register(makeSkill());
    registry.clear();
    expect(registry.size).toBe(0);
  });
});
