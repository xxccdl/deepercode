import { describe, it, expect } from 'vitest';
import { SkillLoader } from '../../src/skills/SkillLoader.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('SkillLoader', () => {
  function createTempSkillDir(): string {
    const baseDir = join(tmpdir(), `deeper-test-${randomUUID()}`);
    const skillDir = join(baseDir, 'test-skill');
    mkdirSync(skillDir, { recursive: true });

    const markdown = `---
name: test-skill
description: A test skill
version: 1.0.0
author: test
triggers:
  - test
  - testing
tools:
  - read_file
  - write_file
dependencies:
  - test-lib
---

# Test Skill

## 概述
这是一个测试 Skill。

## 工作流程
1. 读取文件
2. 处理数据
3. 写入结果
`;

    writeFileSync(join(skillDir, 'skill.md'), markdown, 'utf-8');
    return baseDir;
  }

  function createTempSkillWithCode(): string {
    const baseDir = join(tmpdir(), `deeper-test-code-${randomUUID()}`);
    const skillDir = join(baseDir, 'code-skill');
    mkdirSync(skillDir, { recursive: true });

    const markdown = `---
name: code-skill
description: A skill with code
version: 2.0.0
author: test
triggers:
  - code
  - script
tools:
  - run_command
dependencies: []
---

# Code Skill

## Overview
A skill that uses JavaScript code.`;

    const jsCode = `module.exports = function(params) { return { result: params.input }; };`;

    writeFileSync(join(skillDir, 'skill.md'), markdown, 'utf-8');
    writeFileSync(join(skillDir, 'skill.js'), jsCode, 'utf-8');
    return baseDir;
  }

  it('应正确解析 Skill Markdown 文件', async () => {
    const dir = createTempSkillDir();
    try {
      const loader = new SkillLoader([dir]);
      const results = await loader.loadAll();
      const found = results.find(r => r.skill.meta.name === 'test-skill');
      expect(found).toBeDefined();
      expect(found!.skill.meta.description).toBe('A test skill');
      expect(found!.skill.meta.version).toBe('1.0.0');
      expect(found!.skill.meta.triggers).toContain('test');
      expect(found!.skill.meta.tools).toContain('read_file');
      expect(found!.skill.meta.dependencies).toContain('test-lib');
      expect(found!.skill.content).toContain('测试 Skill');
      expect(found!.fromCodeFile).toBe(false);
    } finally {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('应正确解析带代码的 Skill', async () => {
    const dir = createTempSkillWithCode();
    try {
      const loader = new SkillLoader([dir]);
      const results = await loader.loadAll();
      const found = results.find(r => r.skill.meta.name === 'code-skill');
      expect(found).toBeDefined();
      expect(found!.skill.meta.version).toBe('2.0.0');
      expect(found!.skill.code).toBeDefined();
      expect(found!.fromCodeFile).toBe(true);
    } finally {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('不存在的目录应不报错', async () => {
    const loader = new SkillLoader([join(tmpdir(), `nonexistent-${randomUUID()}`)]);
    const results = await loader.loadAll();
    expect(Array.isArray(results)).toBe(true);
  });

  it('loadSingle 应正确加载单个 Skill', async () => {
    const dir = createTempSkillDir();
    try {
      const loader = new SkillLoader([dir]);
      const result = await loader.loadSingle(dir, 'test-skill');
      expect(result).toBeDefined();
      expect(result!.skill.meta.name).toBe('test-skill');
    } finally {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('没有 frontmatter 的 Markdown 应使用默认值', async () => {
    const dir = join(tmpdir(), `deeper-test-nofm-${randomUUID()}`);
    const skillDir = join(dir, 'no-fm');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'skill.md'), '# Just a header\n\nNo frontmatter here.\n', 'utf-8');
    try {
      const loader = new SkillLoader([dir]);
      const results = await loader.loadAll();
      const found = results.find(r => r.skill.meta.name === 'unnamed');
      expect(found).toBeDefined();
      expect(found!.skill.meta.triggers).toEqual([]);
    } finally {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    }
  });
});
