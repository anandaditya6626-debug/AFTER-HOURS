'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TerminalCommandBarProps {
  onCommand: (command: string) => void;
}

const COMMANDS: Record<string, { description: string; response: string }> = {
  '/void': { description: 'Enter the VOID', response: 'REDIRECTING TO VOID...' },
  '/echo': { description: 'Trigger Memory Echo', response: 'RECOVERING ECHO FROM ARCHIVE...' },
  '/disconnect': { description: 'Simulate signal loss', response: 'SIGNAL INTERRUPTED — RECOVERY IN PROGRESS...' },
  '/signal': { description: 'Open signal radar', response: 'SCANNING GLOBAL FREQUENCIES...' },
  '/sleep': { description: 'Enter Dream Mode', response: 'ENTERING DREAM STATE...' },
  '/watcher': { description: 'Show shadow users', response: 'MONITORING SHADOW ENTITIES...' },
  '/weather': { description: 'Cycle weather', response: 'ATMOSPHERIC SHIFT INITIATED...' },
  '/mayhem': { description: 'Trigger chaos', response: 'SYSTEM DESTABILIZATION IN PROGRESS...' },
  '/help': { description: 'Show all commands', response: '' },
};

const COMMAND_HISTORY_KEY = 'ah_terminal_history';

export const TerminalCommandBar = ({ onCommand }: TerminalCommandBarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open terminal with / key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !isOpen && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsOpen(true);
        setInput('/');
        setResponse(null);
        setShowHelp(false);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setInput('');
        setResponse(null);
        setShowHelp(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Load history
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COMMAND_HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim().toLowerCase();

    if (cmd === '/help') {
      setShowHelp(true);
      setResponse(null);
      return;
    }

    const cmdDef = COMMANDS[cmd];
    if (cmdDef) {
      setResponse(cmdDef.response);
      setShowHelp(false);

      // Save to history
      const newHistory = [...history, cmd].slice(-20);
      setHistory(newHistory);
      localStorage.setItem(COMMAND_HISTORY_KEY, JSON.stringify(newHistory));

      // Execute command after brief display
      setTimeout(() => {
        onCommand(cmd);
        setIsOpen(false);
        setInput('');
        setResponse(null);
      }, 1200);
    } else {
      setResponse('COMMAND NOT RECOGNIZED — TYPE /help');
      setShowHelp(false);
    }
  }, [input, onCommand, history]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      } else {
        setHistoryIndex(-1);
        setInput('/');
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setIsOpen(false); setInput(''); }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(5,5,5,0.7)',
            }}
          />

          {/* Terminal bar */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              zIndex: 10000, padding: '20px 40px',
              background: 'rgba(8,8,8,0.98)',
              borderTop: '1px solid rgba(255,46,46,0.2)',
            }}
          >
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  fontSize: 12, color: '#FF2E2E',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  &gt;
                </span>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); setHistoryIndex(-1); }}
                  onKeyDown={handleKeyDown}
                  placeholder="/command"
                  style={{
                    flex: 1, background: 'transparent', border: 'none',
                    outline: 'none', color: '#F0F0F0', fontSize: 14,
                    fontFamily: 'JetBrains Mono, monospace',
                    letterSpacing: '0.05em', caretColor: '#FF2E2E',
                  }}
                />
                <span style={{
                  fontSize: 8, color: '#333',
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '0.15em',
                }}>
                  ESC TO CLOSE
                </span>
              </div>
            </form>

            {/* Response */}
            {response && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  fontSize: 10, color: '#FF2E2E',
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '0.15em', marginTop: 12,
                }}
              >
                {response}
              </motion.p>
            )}

            {/* Help menu */}
            {showHelp && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                {Object.entries(COMMANDS).filter(([k]) => k !== '/help').map(([cmd, def]) => (
                  <div key={cmd} style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
                    <span style={{
                      fontSize: 11, color: '#FF2E2E', fontFamily: 'JetBrains Mono, monospace',
                      minWidth: 110,
                    }}>
                      {cmd}
                    </span>
                    <span style={{
                      fontSize: 10, color: '#444', fontFamily: 'JetBrains Mono, monospace',
                    }}>
                      {def.description}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
