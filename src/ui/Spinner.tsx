import { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { defaultTheme } from './themes/default.ts';

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface SpinnerProps {
  label?: string;
  type?: 'dots' | 'line' | 'braille';
}

export function Spinner({ label, type = 'braille' }: SpinnerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % spinnerFrames.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  const dotsFrames = ['   ', '.  ', '.. ', '...'];
  const frameChar = type === 'dots'
    ? dotsFrames[frame % dotsFrames.length]
    : type === 'line'
      ? ['|', '/', '-', '\\'][frame % 4]
      : spinnerFrames[frame];

  return (
    <Box>
      <Text color={defaultTheme.primary}>{frameChar}</Text>
      {label ? <Text> {label}</Text> : null}
    </Box>
  );
}
