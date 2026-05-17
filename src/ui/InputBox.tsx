import { useState, useCallback, useRef } from 'react';
import { Text, Box, useInput } from 'ink';
import { defaultTheme } from './themes/default.ts';
import { eventbus } from '../core/eventbus.ts';
import { SLASH_COMMANDS } from '../model/types.ts';

interface InputBoxProps {
  onSubmit: (content: string) => void;
  placeholder?: string;
}

const MAX_HISTORY = 100;
const history: string[] = [];

function addHistory(content: string) {
  if (content.trim() && history[history.length - 1] !== content) {
    history.push(content);
    if (history.length > MAX_HISTORY) {
      history.shift();
    }
  }
}

export function InputBox({ onSubmit, placeholder = '输入消息...' }: InputBoxProps) {
  const [value, setValue] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [tabSuggestions, setTabSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const valueRef = useRef(value);
  valueRef.current = value;

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('/')) {
      const cmd = SLASH_COMMANDS.find((c) => trimmed.startsWith(c.command));
      if (cmd) {
        eventbus.emitMessageSend({ content: trimmed });
        addHistory(trimmed);
        setValue('');
        setCursorPos(0);
        setHistoryIndex(-1);
        return;
      }
    }

    onSubmit(trimmed);
    eventbus.emitMessageSend({ content: trimmed });
    addHistory(trimmed);
    setValue('');
    setCursorPos(0);
    setHistoryIndex(-1);
  }, [value, onSubmit]);

  const handleTabComplete = useCallback(() => {
    if (value.startsWith('/')) {
      const matching = SLASH_COMMANDS
        .filter((c) => c.command.startsWith(value))
        .map((c) => c.command);

      if (matching.length === 1) {
        setValue(matching[0] + ' ');
        setCursorPos(matching[0].length + 1);
        setShowSuggestions(false);
      } else if (matching.length > 1) {
        setTabSuggestions(matching);
        setShowSuggestions(true);
      }
    }
  }, [value]);

  useInput((input, key) => {
    if (showConfirmExit) {
      if (input === 'y' || input === 'Y') {
        eventbus.emitAppQuit();
        return;
      }
      if (input === 'n' || input === 'N' || key.escape) {
        setShowConfirmExit(false);
        return;
      }
      return;
    }

    if (input === '\x03') {
      setShowConfirmExit(true);
      return;
    }

    if (key.return) {
      if (key.ctrl) {
        handleSubmit();
        return;
      }
      if (showSuggestions) {
        setShowSuggestions(false);
        return;
      }
      handleSubmit();
      return;
    }

    if (key.tab) {
      handleTabComplete();
      return;
    }

    if (key.upArrow) {
      if (showSuggestions) {
        setShowSuggestions(false);
        return;
      }
      if (history.length === 0) return;
      const newIndex = historyIndex === -1
        ? history.length - 1
        : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setValue(history[newIndex]);
      setCursorPos(history[newIndex].length);
      return;
    }

    if (key.downArrow) {
      if (showSuggestions) {
        setShowSuggestions(false);
        return;
      }
      if (historyIndex === -1) return;
      const newIndex = historyIndex + 1;
      if (newIndex >= history.length) {
        setHistoryIndex(-1);
        setValue('');
        setCursorPos(0);
      } else {
        setHistoryIndex(newIndex);
        setValue(history[newIndex]);
        setCursorPos(history[newIndex].length);
      }
      return;
    }

    if (key.escape) {
      setShowSuggestions(false);
      return;
    }

    if (key.backspace || key.delete) {
      setShowSuggestions(false);
      if (key.backspace) {
        if (cursorPos > 0) {
          const newVal = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
          setValue(newVal);
          setCursorPos(Math.max(0, cursorPos - 1));
        }
      }
      if (key.delete) {
        if (cursorPos < value.length) {
          const newVal = value.slice(0, cursorPos) + value.slice(cursorPos + 1);
          setValue(newVal);
        }
      }
      return;
    }

    if (key.leftArrow) {
      setCursorPos(Math.max(0, cursorPos - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPos(Math.min(value.length, cursorPos + 1));
      return;
    }

    if ((key as Record<string, unknown>).home) {
      setCursorPos(0);
      return;
    }

    if ((key as Record<string, unknown>).end) {
      setCursorPos(value.length);
      return;
    }

    if (input && input.length === 1 && !key.ctrl && !key.meta) {
      const newVal = value.slice(0, cursorPos) + input + value.slice(cursorPos);
      setValue(newVal);
      setCursorPos(cursorPos + 1);

      if (newVal.startsWith('/') && newVal.length > 1) {
        const matching = SLASH_COMMANDS
          .filter((c) => c.command.startsWith(newVal))
          .map((c) => c.command);
        if (matching.length > 0) {
          setTabSuggestions(matching);
          setShowSuggestions(true);
        } else {
          setShowSuggestions(false);
        }
      } else {
        setShowSuggestions(false);
      }
      return;
    }
  });

  if (showConfirmExit) {
    return (
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={defaultTheme.error}
        paddingX={2}
        paddingY={0}
      >
        <Box>
          <Text bold color={defaultTheme.error}>⚠ 确认退出 DeeperCode?</Text>
        </Box>
        <Box marginTop={0}>
          <Text>按 [Y] 退出  [N/ESC] 取消</Text>
        </Box>
      </Box>
    );
  }

  const cursorChar = '█';

  const beforeCursor = value.slice(0, cursorPos);
  const atCursor = value[cursorPos] || ' ';
  const afterCursor = value.slice(cursorPos + 1);

  return (
    <Box flexDirection="column">
      {showSuggestions && tabSuggestions.length > 0 ? (
        <Box flexDirection="column" borderStyle="single" borderColor={defaultTheme.border} paddingX={1}>
          {tabSuggestions.map((s) => (
            <Text key={s} color={defaultTheme.primary}>{s}</Text>
          ))}
        </Box>
      ) : null}

      <Box
        flexDirection="row"
        borderStyle="round"
        borderColor={defaultTheme.primary}
        paddingX={1}
      >
        <Text color={defaultTheme.primary} bold>❯ </Text>
        <Box>
          <Text>{beforeCursor}</Text>
          <Text backgroundColor={defaultTheme.primary} color={defaultTheme.background}>
            {atCursor}
          </Text>
          <Text>{afterCursor}</Text>
          {value.length === 0 ? (
            <Text dimColor>{placeholder}</Text>
          ) : null}
        </Box>
        <Text dimColor> Ctrl+Enter 发送</Text>
      </Box>
    </Box>
  );
}
