import { useState, useEffect } from 'react';
import { Text, Box, useInput } from 'ink';
import { defaultTheme } from './themes/default.ts';

interface ConfirmDialogProps {
  message: string;
  detail?: string;
  onConfirm: () => void;
  onReject: () => void;
}

export function ConfirmDialog({ message, detail, onConfirm, onReject }: ConfirmDialogProps) {
  const [selected, setSelected] = useState<'confirm' | 'reject'>('reject');

  useInput((input, key) => {
    if (key.leftArrow || key.rightArrow) {
      setSelected((prev) => (prev === 'confirm' ? 'reject' : 'confirm'));
    }
    if (key.return) {
      if (selected === 'confirm') {
        onConfirm();
      } else {
        onReject();
      }
    }
    if (input === 'y' || input === 'Y') {
      onConfirm();
    }
    if (input === 'n' || input === 'N') {
      onReject();
    }
  });

  useEffect(() => {
    setSelected('reject');
  }, [message]);

  return (
    <Box flexDirection="column" borderStyle="double" borderColor={defaultTheme.warning} paddingX={2} paddingY={1}>
      <Box>
        <Text bold color={defaultTheme.warning}>⚠ {message}</Text>
      </Box>
      {detail ? (
        <Box marginTop={0}>
          <Text dimColor>{detail}</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Box marginRight={2}>
          <Text
            color={selected === 'confirm' ? defaultTheme.success : defaultTheme.dimText}
            bold={selected === 'confirm'}
          >
            {selected === 'confirm' ? '▶ ' : '  '}[Y] 确认
          </Text>
        </Box>
        <Box>
          <Text
            color={selected === 'reject' ? defaultTheme.error : defaultTheme.dimText}
            bold={selected === 'reject'}
          >
            {selected === 'reject' ? '▶ ' : '  '}[N] 取消
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
