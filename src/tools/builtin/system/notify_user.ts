import type { Tool } from '../../tool-types.js';

export const notify_user: Tool = {
  name: 'notify_user',
  description: '发送系统通知给用户',
  category: 'system',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '通知标题' },
      message: { type: 'string', description: '通知详情' },
      level: { type: 'string', description: '通知级别: info, warn, error, success', enum: ['info', 'warn', 'error', 'success'] },
    },
    required: ['message'],
  },
  dangerous: false,
  requiresApproval: false,
  async execute(params) {
    try {
      const title = (params.title as string) ?? 'DeeperCode';
      const message = params.message as string;
      const level = (params.level as string) ?? 'info';

      const icons: Record<string, string> = {
        info: 'ℹ',
        warn: '⚠',
        error: '✗',
        success: '✓',
      };

      const output = `${icons[level] || ''} [${level.toUpperCase()}] ${title}: ${message}`;

      try {
        if (process.platform === 'win32') {
          const { execSync } = await import('node:child_process');
          execSync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $notify = New-Object System.Windows.Forms.NotifyIcon; $notify.Icon = [System.Drawing.SystemIcons]::Information; $notify.Visible = $true; $notify.ShowBalloonTip(5000, '${title}', '${message}', [System.Windows.Forms.ToolTipIcon]::${level === 'error' ? 'Error' : 'Info'}); Start-Sleep -Seconds 6; $notify.Dispose()"`, {
            timeout: 10000,
            stdio: 'ignore',
          });
        } else if (process.platform === 'darwin') {
          const { execSync } = await import('node:child_process');
          execSync(`osascript -e 'display notification "${message}" with title "${title}"'`, { stdio: 'ignore' });
        } else {
          const { execSync } = await import('node:child_process');
          execSync(`notify-send "${title}" "${message}"`, { stdio: 'ignore' });
        }
        return { success: true, output, metadata: { title, level, notified: true } };
      } catch {
        return { success: true, output, metadata: { title, level, notified: false } };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message, output: '' };
    }
  },
};
