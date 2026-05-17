import type { Tool } from '../../tool-types.js';

export interface TodoItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'done' | 'cancelled';
  subtasks?: { title: string; status: 'pending' | 'done' }[];
  plan?: string;
  agent?: string;
}

export const todos: Map<string, TodoItem[]> = new Map();
const MAX_TOP = 12;

function uid() { return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`; }

function formatList(items: TodoItem[], indent = 0): string {
  const lines: string[] = [];
  for (const t of items) {
    const pf = '  '.repeat(indent);
    const s = t.status === 'done' ? '✓' : t.status === 'in_progress' ? '◉' : t.status === 'cancelled' ? '✗' : '○';
    lines.push(`${pf}${s} ${t.title.slice(0, 72)}`);
    if (t.subtasks) for (const st of t.subtasks) {
      const ss = st.status === 'done' ? '✓' : '○';
      lines.push(`${pf}  ${ss} ${st.title.slice(0, 60)}`);
    }
  }
  return lines.join('\n');
}

function formatChange(changes: Array<{ oldStatus: string; newStatus: string; title: string }>): string {
  if (changes.length === 0) return '无变更';
  const sMap: Record<string, string> = { pending: '○', in_progress: '◉', done: '✓', cancelled: '✗' };
  return changes.map(c => `${sMap[c.oldStatus]} → ${sMap[c.newStatus]} ${c.title.slice(0, 60)}`).join('\n');
}

function findAndUpdate(items: TodoItem[], idOrTitle: string, status: string): Array<{ oldStatus: string; newStatus: string; title: string }> {
  const changes: Array<{ oldStatus: string; newStatus: string; title: string }> = [];
  for (const t of items) {
    if (t.id === idOrTitle || t.title === idOrTitle) {
      if (t.status !== status) { changes.push({ oldStatus: t.status, newStatus: status, title: t.title }); t.status = status as any; }
      break;
    }
    if (t.subtasks) for (const st of t.subtasks) {
      if (st.title === idOrTitle || st.title.includes(idOrTitle)) {
        if (st.status !== status) { changes.push({ oldStatus: st.status, newStatus: status, title: st.title }); st.status = status as any; }
        break;
      }
    }
  }
  return changes;
}

function countStats(items: TodoItem[]) {
  let total = 0, done = 0;
  for (const t of items) {
    total++; if (t.status === 'done') done++;
    if (t.subtasks) for (const st of t.subtasks) { total++; if (st.status === 'done') done++; }
  }
  return { total, done };
}

export const todo_manager: Tool = {
  name: 'todo_manager',
  description: '管理任务面板。复杂任务前创建 items 列表（≤8项），过程中用 update 改变状态（title 或 task_id 定位）。',
  category: 'ai',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'update', 'list', 'clear'], description: '操作' },
      task_id: { type: 'string', description: 'update 时用 id 定位任务' },
      title: { type: 'string', description: 'update 时用标题定位任务（唯一匹配）' },
      status: { type: 'string', enum: ['pending', 'in_progress', 'done', 'cancelled'], description: '更新目标状态' },
      items: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, plan: { type: 'string' }, agent: { type: 'string' }, subtasks: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' } } } } } }, description: 'create 时传入 ≤8 项' },
    },
    required: ['action'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    const action = params.action as string;
    const sessionId = 'default';

    if (action === 'list') {
      const items = todos.get(sessionId) || [];
      if (items.length === 0) return { success: true, output: '任务列表为空' };
      const { total, done } = countStats(items);
      return { success: true, output: `📋 ${done}/${total}\n${formatList(items)}`, metadata: { total, done } };
    }

    if (action === 'clear') {
      todos.set(sessionId, []);
      return { success: true, output: '已清空' };
    }

    if (action === 'create') {
      const items = (params.items as any[]) || [];
      if (items.length === 0 && params.title) {
        todos.set(sessionId, [{ id: uid(), title: params.title as string, status: 'pending', plan: (params as any).plan }]);
        return { success: true, output: `📋 1 项\n${formatList(todos.get(sessionId)!)}`, metadata: { total: 1, done: 0 } };
      }
      const top = items.slice(0, MAX_TOP);
      const mapped: TodoItem[] = top.map((t: any) => ({
        id: uid(), title: t.title, status: 'pending',
        plan: t.plan, agent: t.agent,
        subtasks: t.subtasks ? t.subtasks.slice(0, 6).map((st: any) => ({ title: st.title, status: 'pending' as const })) : undefined,
      }));
      todos.set(sessionId, mapped);
      const { total, done } = countStats(mapped);
      return { success: true, output: `📋 ${done}/${total}\n${formatList(mapped)}`, metadata: { total, done, topLevel: mapped.length } };
    }

    if (action === 'update') {
      const list = todos.get(sessionId) || [];
      const tid = params.task_id as string;
      const title = params.title as string;
      const status = (params.status as string) || 'in_progress';
      let changes: Array<{ oldStatus: string; newStatus: string; title: string }> = [];
      if (tid) changes = findAndUpdate(list, tid, status);
      else if (title) changes = findAndUpdate(list, title, status);
      if (changes.length === 0 && (tid || title)) {
        return { success: false, error: `未找到: ${tid || title}`, output: '' };
      }
      todos.set(sessionId, list);
      if (changes.length === 0) {
        const { done, total } = countStats(list);
        return { success: true, output: `📋 ${done}/${total}\n${formatList(list)}` };
      }
      const { done, total } = countStats(list);
      return { success: true, output: `${formatChange(changes)}\n(${done}/${total})` };
    }

    return { success: false, error: '未知 action: ' + action, output: '' };
  },
};

export function getTodos(): TodoItem[] {
  return todos.get('default') || [];
}

export function todoSummary(maxItems = 8): string {
  const items = getTodos();
  if (items.length === 0) return '';
  const pending = items.filter(t => t.status !== 'done' && t.status !== 'cancelled');
  if (pending.length === 0) return '';
  let s = `[任务 ${pending.length}/${items.length}]\n`;
  for (const t of pending.slice(0, maxItems)) {
    const sym = t.status === 'in_progress' ? '⏳' : '⬚';
    s += `${sym} ${t.title.slice(0, 50)}`;
    if (t.subtasks) {
      const subDone = t.subtasks.filter(st => st.status === 'done').length;
      s += ` (${subDone}/${t.subtasks.length})`;
    }
    s += '\n';
  }
  return s;
}
