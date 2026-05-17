import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, basename } from 'node:path';

const MAX_FILE_SIZE = 500_000;

export interface BugReport {
  file: string;
  line?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
  category: string;
}

const LANG_CONFIGS: Record<string, { name: string; patterns: Array<{ re: RegExp; severity: BugReport['severity']; cat: string; msg: string; hint?: string }> }> = {
  '.ts': { name: 'TypeScript', patterns: [
    { re: /:\s*any\b/g, severity: 'warning', cat: '类型安全', msg: '使用了 `any` 类型，建议指定具体类型', hint: '将 `any` 替换为具体接口或类型' },
    { re: /console\.(log|warn|error|debug)\(/g, severity: 'info', cat: '调试代码', msg: '生产代码中留有 console 调用', hint: '移除此调试语句或使用 logger' },
    { re: /as\s+[A-Z]\w+/g, severity: 'warning', cat: '类型安全', msg: '使用 `as` 类型断言', hint: '优先使用类型守卫替代类型断言' },
    { re: /@ts-ignore/g, severity: 'warning', cat: '类型安全', msg: '使用 @ts-ignore 忽略类型检查', hint: '修复类型错误而非忽略' },
    { re: /setTimeout\([^,)]*\)/g, severity: 'info', cat: '可靠性', msg: 'setTimeout 缺少错误处理', hint: '考虑在回调中添加 try-catch' },
  ]},
  '.js': { name: 'JavaScript', patterns: [
    { re: /console\.(log|warn|error|debug)\(/g, severity: 'info', cat: '调试代码', msg: '生产代码中留有 console 调用' },
    { re: /var\s+/g, severity: 'warning', cat: '代码风格', msg: '使用了 `var`，建议使用 `const`/`let`' },
    { re: /==(?!=)/g, severity: 'warning', cat: '逻辑错误', msg: '使用了 `==` 而非 `===`', hint: '使用 `===` 进行严格比较' },
    { re: /eval\(/g, severity: 'error', cat: '安全', msg: '使用 eval() 存在安全风险', hint: '避免使用 eval' },
    { re: /innerHTML\s*=/g, severity: 'warning', cat: '安全', msg: '直接修改 innerHTML 有 XSS 风险', hint: '使用 textContent 或安全 DOM 方法' },
  ]},
  '.py': { name: 'Python', patterns: [
    { re: /except\s*:/g, severity: 'warning', cat: '错误处理', msg: '使用了裸 except 捕获所有异常' },
    { re: /except\s+Exception\s*:/g, severity: 'info', cat: '错误处理', msg: '捕获范围过宽', hint: '捕获更具体的异常类型' },
    { re: /:\s*print\(/g, severity: 'info', cat: '调试代码', msg: '生产代码中留有 print 调用' },
    { re: /input\(/g, severity: 'info', cat: '安全', msg: '未校验用户输入' },
    { re: /exec\(/g, severity: 'error', cat: '安全', msg: '使用 exec() 存在安全风险' },
    { re: /import\s+\*/g, severity: 'info', cat: '代码风格', msg: '通配符导入，建议明确导入' },
  ]},
  '.json': { name: 'JSON', patterns: [
  ]},
  '.css': { name: 'CSS', patterns: [
    { re: /!important/g, severity: 'warning', cat: 'CSS 反模式', msg: '使用 !important', hint: '通过提高选择器特异性替代' },
    { re: /position:\s*absolute/g, severity: 'info', cat: '布局', msg: '大量 absolute 定位可能影响响应式' },
  ]},
  '.html': { name: 'HTML', patterns: [
    { re: /<script[^>]*>/, severity: 'info', cat: '安全', msg: '内联 script 标签' },
    { re: /on\w+\s*=/, severity: 'warning', cat: '安全', msg: '内联事件处理器 (onclick 等)', hint: '使用 addEventListener 替代' },
  ]},
  '.java': { name: 'Java', patterns: [
    { re: /System\.out\.print/, severity: 'info', cat: '调试代码', msg: '留有 System.out 调用', hint: '使用日志框架替代' },
    { re: /catch\s*\(\s*Exception\s+/g, severity: 'warning', cat: '错误处理', msg: '捕获范围过宽' },
  ]},
  '.go': { name: 'Go', patterns: [
    { re: /_,\s*_\s*:=/g, severity: 'warning', cat: '错误处理', msg: '忽略了错误返回值', hint: '应处理返回的 error' },
    { re: /panic\(/g, severity: 'warning', cat: '错误处理', msg: '使用 panic 而非 error 返回', hint: '优先使用 error 返回值' },
  ]},
  '.rs': { name: 'Rust', patterns: [
    { re: /\.unwrap\(\)/g, severity: 'warning', cat: '错误处理', msg: '使用 unwrap() 可能导致 panic', hint: '使用 ? 或 match 处理错误' },
    { re: /unsafe\s*\{/g, severity: 'warning', cat: '安全', msg: '使用了 unsafe 块' },
  ]},
};

export function analyzeFile(filePath: string): BugReport[] {
  if (!existsSync(filePath)) return [];
  try { if (statSync(filePath).size > MAX_FILE_SIZE) return []; } catch { return []; }
  const reports: BugReport[] = [];
  const ext = extname(filePath).toLowerCase();
  const config = LANG_CONFIGS[ext];
  if (!config) return [];

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const pattern of config.patterns) {
      if (!pattern.msg) continue;
      let match;
      pattern.re.lastIndex = 0;
      while ((match = pattern.re.exec(content)) !== null) {
        if (!pattern.msg) continue;
        const lineNum = content.slice(0, match.index).split('\n').length;
        reports.push({
          file: basename(filePath),
          line: lineNum,
          severity: pattern.severity,
          message: pattern.msg,
          suggestion: pattern.hint,
          category: pattern.cat,
        });
      }
    }

    // 通用检查 (跨语言)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // 超长行
      if (trimmed.length > 200 && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
        reports.push({
          file: basename(filePath), line: i + 1, severity: 'info',
          message: `行过长 (${trimmed.length} 字符)`, suggestion: '考虑拆分或格式化',
          category: '代码风格',
        });
      }

      // TODO/FIXME/HACK/BUG 标记
      if (/\/\/\s*(TODO|FIXME|HACK|BUG|XXX)\b/i.test(trimmed) ||
          /#\s*(TODO|FIXME|HACK|BUG|XXX)\b/i.test(trimmed)) {
        const tag = trimmed.match(/(?:TODO|FIXME|HACK|BUG|XXX)/i)?.[0] || '';
        reports.push({
          file: basename(filePath), line: i + 1,
          severity: tag === 'BUG' ? 'error' : tag === 'FIXME' ? 'warning' : 'info',
          message: `标记为 ${tag}`, suggestion: '建议及时处理',
          category: '代码标记',
        });
      }
    }
  } catch { return []; }

  return reports;
}

export function summarizeBugs(reports: BugReport[]): string {
  if (reports.length === 0) return '';
  const errs = reports.filter(r => r.severity === 'error').length;
  const warns = reports.filter(r => r.severity === 'warning').length;
  const infos = reports.filter(r => r.severity === 'info').length;

  let s = `[BugScan] 检查发现 ${reports.length} 个问题`;
  if (errs > 0) s += ` · ${errs} ❌错误`;
  if (warns > 0) s += ` · ${warns} ⚠警告`;
  if (infos > 0) s += ` · ${infos} ℹ提示`;
  s += '\n';

  const top = reports.slice(0, 8);
  for (const r of top) {
    const sev = r.severity === 'error' ? '❌' : r.severity === 'warning' ? '⚠' : 'ℹ';
    s += `${sev} ${r.file}:${r.line ?? '?'} [${r.category}] ${r.message}`;
    if (r.suggestion) s += ` → ${r.suggestion}`;
    s += '\n';
  }

  if (reports.length > 8) s += `... 还有 ${reports.length - 8} 个问题\n`;
  return s;
}
