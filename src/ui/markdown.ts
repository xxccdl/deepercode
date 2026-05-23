const A = { R: '\x1b[0m', b: '\x1b[1m', d: '\x1b[2m', i: '\x1b[3m', u: '\x1b[4m', g: '\x1b[32m', inv: '\x1b[7m' };
function ansi(code: string, text: string) { return code + text + A.R; }

export class MarkdownStreamRenderer {
  private lineBuf = '';
  private inCodeBlock = false;
  private codeLang = '';
  private codeContent = '';
  private codeDropped = 0;
  private seenFirstLine = false;
  private tableRows: string[] = [];
  private inTable = false;
  private tableAligns: ('L'|'C'|'R')[] = [];

  private static readonly MAX_LINE = 4096;
  private static readonly MAX_CODE = 51200;

  feed(chunk: string): string | null {
    this.lineBuf += chunk;
    if (this.lineBuf.length > MarkdownStreamRenderer.MAX_LINE) this.lineBuf = this.lineBuf.slice(-MarkdownStreamRenderer.MAX_LINE);

    const idx = this.lineBuf.indexOf('\n');
    if (idx === -1) return null;
    const line = this.lineBuf.slice(0, idx);
    this.lineBuf = this.lineBuf.slice(idx + 1);

    if (this.inCodeBlock) {
      if (/^```\s*$/.test(line.trim())) {
        this.inCodeBlock = false;
        let out = this.flushCodeBlock() + '\n';
        if (this.codeLang.toLowerCase() === 'markdown') out = '';
        return out;
      }
      if (this.codeContent.length < MarkdownStreamRenderer.MAX_CODE) {
        this.codeContent += line + '\n';
      } else {
        this.codeDropped++;
      }
      return null;
    }

    if (/^```(\w*)\s*$/.test(line.trim())) {
      this.inCodeBlock = true;
      this.codeLang = line.trim().slice(3).trim();
      this.codeContent = '';
      if (!this.seenFirstLine) { this.seenFirstLine = true; return ansi(A.d, `  ┌ ${this.codeLang || 'code'}`) + '\n'; }
      return `\n` + ansi(A.d, `  ┌ ${this.codeLang || 'code'}`) + '\n';
    }

    // ── Table detection ──
    const isPipeLine = /^\|.+|\s+\|/.test(line) && line.includes('|');
    const isSepLine = /^\|?[\s\-:]+(\|[\s\-:]+)+\|?\s*$/.test(line.trim()) && !/[a-zA-Z\u4e00-\u9fff]/.test(line.trim());

    if (isPipeLine) {
      if (!this.inTable) {
        this.inTable = true;
        this.tableRows = [];
        this.tableAligns = [];
      }
      if (isSepLine) {
        // Parse alignment from separator row
        const cells = line.split('|').filter(c => /[\-:]/.test(c));
        this.tableAligns = cells.map(c => {
          const t = c.trim();
          if (t.startsWith(':') && t.endsWith(':')) return 'C';
          if (t.endsWith(':')) return 'R';
          return 'L';
        });
        return null;
      }
      this.tableRows.push(line);
      return null;
    }

    // End of table
    if (this.inTable) {
      const out = this.renderTable();
      this.inTable = false;
      this.tableRows = [];
      this.tableAligns = [];
      this.seenFirstLine = true;
      return out + '\n' + this.renderLine(line) + '\n';
    }

    this.seenFirstLine = true;
    return this.renderLine(line) + '\n';
  }

  flush(): string {
    let out = '';
    if (this.inTable) {
      out += this.renderTable();
      this.inTable = false;
      this.tableRows = [];
    }
    if (this.inCodeBlock) {
      out += this.flushCodeBlock();
      this.inCodeBlock = false;
    }
    if (this.lineBuf) {
      out += this.lineBuf;
      this.lineBuf = '';
    }
    return out;
  }

  reset(): void {
    this.lineBuf = ''; this.inCodeBlock = false; this.codeLang = ''; this.codeContent = ''; this.codeDropped = 0; this.seenFirstLine = false;
    this.inTable = false; this.tableRows = []; this.tableAligns = [];
  }

  // ── Table rendering ──

  private renderTable(): string {
    if (this.tableRows.length === 0) return '';
    const headerRow = this.tableRows[0];
    const dataRows = this.tableRows.slice(this.tableAligns.length === 0 ? 0 : 1);
    const headerCells = headerRow ? this.splitCells(headerRow) : [];
    const allRows: string[][] = [];

    if (this.tableAligns.length > 0 && headerRow) {
      allRows.push(headerCells);
      allRows.push(...dataRows.map(r => this.splitCells(r)));
    } else {
      allRows.push(...this.tableRows.map(r => this.splitCells(r)));
    }

    const colCount = Math.max(...allRows.map(r => r.length), 1);
    const colWidths: number[] = Array(colCount).fill(3);
    for (const row of allRows) {
      for (let i = 0; i < row.length; i++) {
        const w = this.visualLen(row[i]);
        if (w > colWidths[i]) colWidths[i] = Math.min(w, 30);
      }
    }

    const aligns = Array(colCount).fill('L');
    for (let i = 0; i < this.tableAligns.length && i < colCount; i++) aligns[i] = this.tableAligns[i];

    const F = ansi(A.d + '\x1b[90m', '│');
    let out = '';

    // Top border
    out += A.d + '\x1b[90m' + '  ┌' + colWidths.map(w => '─'.repeat(Math.max(0, w + 2))).join('┬') + '┐' + A.R + '\n';

    // Header row
    if (allRows.length > 0 && colWidths.length > 0) {
      out += `  ${F} ` + allRows[0].map((c, i) => this.padCell(c, colWidths[i] || 3, 'C', true)).join(` ${F} `) + ` ${F}\n`;
      // Separator
      out += A.d + '\x1b[90m' + '  ├' + colWidths.map(w => '─'.repeat(Math.max(0, w + 2))).join('┼') + '┤' + A.R + '\n';
    }

    // Data rows
    const maxRows = 12;
    for (let r = 1; r < allRows.length && r <= maxRows; r++) {
      out += `  ${F} ` + allRows[r].map((c, i) => this.padCell(c, colWidths[i] || 3, aligns[i] || 'L', false)).join(` ${F} `) + ` ${F}\n`;
    }
    if (allRows.length > maxRows + 1) {
      out += ansi(A.d + '\x1b[90m', `  ${F} ${ansi(A.d, '...')} `.padEnd(colWidths.reduce((a, w) => a + w + 3, 3))) + ` ${F}` + '\n';
    }

    // Bottom border
    out += A.d + '\x1b[90m' + '  └' + colWidths.map(w => '─'.repeat(Math.max(0, w + 2))).join('┴') + '┘' + A.R;
    return out;
  }

  private splitCells(line: string): string[] {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    return s.split('|').map(c => c.trim());
  }

  private stripMarkdown(s: string): string {
    return s
      .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  }

  private visualLen(s: string): number {
    const plain = this.stripMarkdown(s).replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    let len = 0;
    for (const cp of [...plain].map(ch => ch.codePointAt(0) || 0)) {
      if ((cp >= 0x1100 && cp <= 0x115F) ||    // Hangul Jamo
          (cp >= 0x2E80 && cp <= 0xA4CF) ||    // CJK
          (cp >= 0xAC00 && cp <= 0xD7A3) ||    // Hangul Syllables
          (cp >= 0xF900 && cp <= 0xFAFF) ||    // CJK Compatibility
          (cp >= 0xFE10 && cp <= 0xFE19) ||    // Vertical forms
          (cp >= 0xFE30 && cp <= 0xFE6F) ||    // CJK Compatibility Forms
          (cp >= 0xFF00 && cp <= 0xFF60) ||    // Fullwidth ASCII
          (cp >= 0xFFE0 && cp <= 0xFFE6) ||    // Fullwidth symbols
          (cp >= 0x20000 && cp <= 0x2FFFD) ||  // CJK Extension B+
          (cp >= 0x30000 && cp <= 0x3FFFD) ||  // CJK Extension C+
          (cp >= 0x1F300 && cp <= 0x1F9FF) ||  // Emoji
          (cp >= 0x1F000 && cp <= 0x1F2FF) ||  // Emoji misc
          (cp >= 0x2600 && cp <= 0x26FF) ||    // Misc symbols
          (cp >= 0x2700 && cp <= 0x27BF)) {     // Dingbats
        len += 2;
      } else if ((cp >= 0x0300 && cp <= 0x036F) ||  // Combining marks → 0 width
                 (cp >= 0x1DC0 && cp <= 0x1DFF) ||
                 (cp >= 0x20D0 && cp <= 0x20FF) ||
                 (cp >= 0xFE20 && cp <= 0xFE2F)) {
        continue;
      } else {
        len += 1;
      }
    }
    return len;
  }

  private padCell(text: string, width: number, align: string, bold: boolean): string {
    const rendered = this.inline(text);
    const visual = this.visualLen(rendered);
    const pad = Math.max(0, width - visual);
    const left = align === 'R' ? pad : align === 'C' ? Math.floor(pad / 2) : 0;
    const right = Math.max(0, pad - left);
    return ' '.repeat(left) + rendered + ' '.repeat(right);
  }

  // ── Flush code ──

  private flushCodeBlock(): string {
    const lines = this.codeContent.split('\n').filter(l => l || true);
    let out = '';
    const max = Math.min(lines.length, 20);
    for (let i = 0; i < max; i++) {
      out += `  ${ansi(A.d + '\x1b[90m', String(i + 1).padStart(3, ' '))} ${ansi(A.d, '│')} ${lines[i]}\n`;
    }
    if (lines.length > 20) out += ansi(A.d + '\x1b[90m', `  ... (${lines.length - 20} lines omitted)\n`);
    if (this.codeDropped > 0) out += ansi(A.d + '\x1b[90m', `  ... (${this.codeDropped} lines dropped, code too large)\n`);
    out += ansi(A.d, `  └ ${this.codeLang || 'code'}`);
    this.codeContent = '';
    this.codeDropped = 0;
    return out;
  }

  // ── Render line ──

  private renderLine(line: string): string {
    const t = line.trim();
    if (t === '') return '';

    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#{4}\s+(.+)/))) return ansi(A.b + '\x1b[36m', `  ## ${m[1]}`);
    if ((m = line.match(/^#{3}\s+(.+)/))) return ansi(A.b + '\x1b[33m', `  ▸ ${m[1]}`);
    if ((m = line.match(/^#{2}\s+(.+)/))) return ansi(A.b + '\x1b[34m', `  ▸▸ ${m[1]}`);
    if ((m = line.match(/^#\s+(.+)/))) return ansi(A.b + '\x1b[35m', ` █ ${m[1]}`);
    if (line.startsWith('> ')) return ansi(A.d + '\x1b[90m', `  │ ${line.slice(2)}`);
    if (/^[-*_]{3,}\s*$/.test(t) && !t.includes('|')) return ansi(A.d + '\x1b[90m', '  ──'.repeat(12));
    if ((m = line.match(/^(\s*)(\d+)\.\s+(.+)/))) { const sp = m[1].length; return ' '.repeat(Math.max(0, sp)) + ansi(A.b + '\x1b[36m', `${m[2]}.`) + ' ' + this.inline(m[3]); }
    if ((m = line.match(/^(\s*)[*+-]\s+(.+)/))) { const sp = m[1].length; return ' '.repeat(Math.max(0, sp)) + ansi(A.g, '• ') + this.inline(m[2]); }
    if ((m = line.match(/^(\s*)- \[([ x])\]\s+(.+)/))) {
      const ck = m[2] === 'x' ? ansi(A.g, '✓') : ansi(A.d + '\x1b[90m', '○');
      return `  ${ck} ${this.inline(m[3])}`;
    }
    return '  ' + this.inline(line);
  }

  private inline(text: string): string {
    let s = text;
    s = s.replace(/`([^`]+)`/g, (_, c) => ansi(A.inv + '\x1b[33m', c));
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, (_, c) => ansi(A.b + A.i, c));
    s = s.replace(/\*\*(.+?)\*\*/g, (_, c) => ansi(A.b, c));
    s = s.replace(/\*(.+?)\*/g, (_, c) => ansi(A.i, c));
    s = s.replace(/~~(.+?)~~/g, (_, c) => ansi(A.d + '\x1b[9m', c));
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, url) =>
      ansi(A.u + '\x1b[36m', txt) + ansi(A.d + '\x1b[90m', ` (${url.slice(0, 40)})`));
    return s;
  }
}
