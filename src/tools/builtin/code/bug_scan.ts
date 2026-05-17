import { statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import fg from 'fast-glob';
import { analyzeFile, summarizeBugs } from '../../../core/bugscan.js';
import type { Tool } from '../../tool-types.js';
import type { BugReport } from '../../../core/bugscan.js';

const MAX_FILES = 50;
const EXTENSIONS = '{ts,js,py,java,go,rs,css,html}';
const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 };

export const bug_scan: Tool = {
  name: 'bug_scan',
  description: 'Scan source files for bugs, anti-patterns, and code quality issues. Supports TS/JS/Python/Java/Go/Rust/CSS/HTML.',
  category: 'code',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File or directory path to scan' },
      recursive: { type: 'boolean', description: 'Scan directory recursively' },
      severity: { type: 'string', description: 'Minimum severity level to report', enum: ['error', 'warning', 'info'] },
    },
    required: ['path'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const target = params.path as string;
      const recursive = (params.recursive as boolean) ?? false;
      const minSeverity = (params.severity as string) ?? 'warning';

      const absPath = isAbsolute(target) ? target : join(process.cwd(), target);

      let isFile = false;
      try {
        isFile = statSync(absPath).isFile();
      } catch {
        return { success: false, error: `路径不存在: ${absPath}`, output: '' };
      }

      let files: string[];
      if (isFile) {
        files = [absPath];
      } else {
        const pattern = recursive
          ? `**/*.${EXTENSIONS}`
          : `*.${EXTENSIONS}`;
        files = await fg(pattern, {
          cwd: absPath,
          absolute: true,
          ignore: ['node_modules/**', '.git/**', 'dist/**'],
          onlyFiles: true,
        });
      }

      files = files.slice(0, MAX_FILES);

      const allBugs: BugReport[] = [];
      for (const fp of files) {
        try {
          const bugs = analyzeFile(fp);
          allBugs.push(...bugs);
        } catch { /* skip files that fail */ }
      }

      const minOrder = SEVERITY_ORDER[minSeverity] ?? 1;
      const filtered = allBugs.filter(b => (SEVERITY_ORDER[b.severity] ?? 2) <= minOrder);

      if (filtered.length === 0) {
        return { success: true, output: 'No issues found', metadata: { filesScanned: files.length, totalBugs: allBugs.length } };
      }

      const output = summarizeBugs(filtered);
      return { success: true, output, metadata: { filesScanned: files.length, totalBugs: allBugs.length, filteredBugs: filtered.length } };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
