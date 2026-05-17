import { describe, it, expect } from 'vitest';
import { writeFileSync, unlinkSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

describe('内置文件系统工具', () => {
  let testDir: string;

  function setup() {
    testDir = join(tmpdir(), `deeper-fs-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
    return testDir;
  }

  function cleanup() {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  }

  it('read_file 应正确读取文件内容', async () => {
    const dir = setup();
    const filePath = join(dir, 'test.txt');
    writeFileSync(filePath, 'line1\nline2\nline3\nline4\nline5', 'utf-8');
    try {
      const { read_file } = await import('../../src/tools/builtin/filesystem/read_file.js');
      const result = await read_file.execute({ file_path: filePath });
      expect(result.success).toBe(true);
      expect(result.output).toContain('line1');
      expect(result.output).toContain('line5');
    } finally {
      cleanup();
    }
  });

  it('read_file 应支持行范围读取', async () => {
    const dir = setup();
    const filePath = join(dir, 'test.txt');
    writeFileSync(filePath, 'line1\nline2\nline3\nline4\nline5', 'utf-8');
    try {
      const { read_file } = await import('../../src/tools/builtin/filesystem/read_file.js');
      const result = await read_file.execute({ file_path: filePath, offset: 2, limit: 2 });
      expect(result.success).toBe(true);
      expect(result.output).toContain('line2');
      expect(result.output).toContain('line3');
      expect(result.output).not.toContain('line1');
    } finally {
      cleanup();
    }
  });

  it('read_file 不存在的文件应返回错误', async () => {
    const { read_file } = await import('../../src/tools/builtin/filesystem/read_file.js');
    const result = await read_file.execute({ file_path: '/nonexistent/file.txt' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('不存在');
  });

  it('write_file 应写入文件', async () => {
    const dir = setup();
    const filePath = join(dir, 'output.txt');
    try {
      const { write_file } = await import('../../src/tools/builtin/filesystem/write_file.js');
      const result = await write_file.execute({ file_path: filePath, content: 'Hello DeeperCode' });
      expect(result.success).toBe(true);
      const { readFileSync } = await import('node:fs');
      expect(readFileSync(filePath, 'utf-8')).toBe('Hello DeeperCode');
    } finally {
      cleanup();
    }
  });

  it('write_file 应覆盖已有文件', async () => {
    const dir = setup();
    const filePath = join(dir, 'output.txt');
    writeFileSync(filePath, 'old content', 'utf-8');
    try {
      const { write_file } = await import('../../src/tools/builtin/filesystem/write_file.js');
      await write_file.execute({ file_path: filePath, content: 'new content' });
      const { readFileSync } = await import('node:fs');
      expect(readFileSync(filePath, 'utf-8')).toBe('new content');
    } finally {
      cleanup();
    }
  });

  it('delete_file 应删除文件', async () => {
    const dir = setup();
    const filePath = join(dir, 'to_delete.txt');
    writeFileSync(filePath, 'delete me', 'utf-8');
    try {
      const { delete_file } = await import('../../src/tools/builtin/filesystem/delete_file.js');
      const result = await delete_file.execute({ file_path: filePath });
      expect(result.success).toBe(true);
      expect(existsSync(filePath)).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('list_dir 应列出目录内容', async () => {
    const dir = setup();
    writeFileSync(join(dir, 'a.txt'), '', 'utf-8');
    writeFileSync(join(dir, 'b.txt'), '', 'utf-8');
    mkdirSync(join(dir, 'subdir'));
    try {
      const { list_dir } = await import('../../src/tools/builtin/filesystem/list_dir.js');
      const result = await list_dir.execute({ dir_path: dir });
      expect(result.success).toBe(true);
      expect(result.output).toContain('a.txt');
      expect(result.output).toContain('b.txt');
    } finally {
      cleanup();
    }
  });

  it('create_dir 应创建目录', async () => {
    const dir = setup();
    const newDir = join(dir, 'nested', 'deep');
    try {
      const { create_dir } = await import('../../src/tools/builtin/filesystem/create_dir.js');
      const result = await create_dir.execute({ dir_path: newDir });
      expect(result.success).toBe(true);
      expect(existsSync(newDir)).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('glob_find 应匹配文件', async () => {
    const dir = setup();
    writeFileSync(join(dir, 'file1.ts'), '', 'utf-8');
    writeFileSync(join(dir, 'file2.ts'), '', 'utf-8');
    writeFileSync(join(dir, 'file3.js'), '', 'utf-8');
    try {
      const { glob_find } = await import('../../src/tools/builtin/filesystem/glob_find.js');
      const result = await glob_find.execute({ pattern: '*.ts', cwd: dir });
      expect(result.success).toBe(true);
      expect(result.output).toContain('file1.ts');
      expect(result.output).toContain('file2.ts');
      expect(result.output).not.toContain('file3.js');
    } finally {
      cleanup();
    }
  });

  it('file_info 应返回文件信息', async () => {
    const dir = setup();
    const filePath = join(dir, 'info.txt');
    writeFileSync(filePath, 'content', 'utf-8');
    try {
      const { file_info } = await import('../../src/tools/builtin/filesystem/file_info.js');
      const result = await file_info.execute({ file_path: filePath });
      expect(result.success).toBe(true);
      expect(result.output).toContain('info.txt');
    } finally {
      cleanup();
    }
  });

  it('batch_read 应批量读取', async () => {
    const dir = setup();
    const p1 = join(dir, 'batch1.txt');
    const p2 = join(dir, 'batch2.txt');
    writeFileSync(p1, 'content1', 'utf-8');
    writeFileSync(p2, 'content2', 'utf-8');
    try {
      const { batch_read } = await import('../../src/tools/builtin/filesystem/batch_read.js');
      const result = await batch_read.execute({ file_paths: [p1, p2] });
      expect(result.success).toBe(true);
      expect(result.output).toContain('content1');
      expect(result.output).toContain('content2');
    } finally {
      cleanup();
    }
  });

  it('copy_file 应复制文件', async () => {
    const dir = setup();
    const src = join(dir, 'src.txt');
    const dest = join(dir, 'dest.txt');
    writeFileSync(src, 'copy content', 'utf-8');
    try {
      const { copy_file } = await import('../../src/tools/builtin/filesystem/copy_file.js');
      const result = await copy_file.execute({ source: src, destination: dest });
      expect(result.success).toBe(true);
      const { readFileSync } = await import('node:fs');
      expect(readFileSync(dest, 'utf-8')).toBe('copy content');
    } finally {
      cleanup();
    }
  });

  it('move_file 应移动文件', async () => {
    const dir = setup();
    const src = join(dir, 'src.txt');
    const dest = join(dir, 'dest.txt');
    writeFileSync(src, 'move content', 'utf-8');
    try {
      const { move_file } = await import('../../src/tools/builtin/filesystem/move_file.js');
      const result = await move_file.execute({ source: src, destination: dest });
      expect(result.success).toBe(true);
      expect(existsSync(src)).toBe(false);
      const { readFileSync } = await import('node:fs');
      expect(readFileSync(dest, 'utf-8')).toBe('move content');
    } finally {
      cleanup();
    }
  });
});
