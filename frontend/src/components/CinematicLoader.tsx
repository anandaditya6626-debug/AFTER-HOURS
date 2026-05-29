'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BOOT_SEQUENCES = [
  [
    { text: 'SCANNING IDENTITY...', delay: 0 },
    { text: 'LOCATING SIGNAL...', delay: 400 },
    { text: 'ACCESSING VOID...', delay: 800 },
  ],
  [
    { text: 'ESTABLISHING CONNECTION...', delay: 0 },
    { text: 'RECOVERING SIGNAL...', delay: 500 },
    { text: 'SYNCHRONIZING FREQUENCY...', delay: 900 },
  ],
  [
    { text: 'INITIALIZING PROTOCOL...', delay: 0 },
    { text: 'VERIFYING ANONYMITY...', delay: 350 },
    { text: 'ENTERING SECURE CHANNEL...', delay: 750 },
  ],
  [
    { text: 'DECRYPTING TRANSMISSION...', delay: 0 },
    { text: 'ROUTING THROUGH VOID...', delay: 450 },
    { text: 'SIGNAL ACQUIRED...', delay: 850 },
  ],
];

interface CinematicLoaderProps {
  active: boolean;
  onComplete?: () => void;
  duration?: number; // ms, default 1500
}

export const CinematicLoader = ({ active, onComplete, duration = 1500 }: CinematicLoaderProps) => {
  const [lines, setLines] = useState<{ text: string; progress: number; complete: boolean }[]>([]);
  const [sequence] = useState(() => BOOT_SEQUENCES[Math.floor(Math.random() * BOOT_SEQUENCES.length)]);
  const [glitchFlash, setGlitchFlash] = useState(false);

  useEffect(() => {
    if (!active) { setLines([]); return; }

    // Initialize lines
    setLines(sequence.map(s => ({ text: s.text, progress: 0, complete: false })));

    // Animate progress bars
    const intervals: NodeJS.Timeout[] = [];
    const timeouts: NodeJS.Timeout[] = [];

    sequence.forEach((step, i) => {
      const t = setTimeout(() => {
        const startTime = Date.now();
        const lineDuration = (duration - step.delay) * 0.7;

        const iv = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / lineDuration, 1);

          setLines(prev => prev.map((line, j) =>
            j === i ? { ...line, progress, complete: progress >= 1 } : line
          ));

          if (progress >= 1) clearInterval(iv);
        }, 30);
        intervals.push(iv);
      }, step.delay);
      timeouts.push(t);
    });

    // Glitch flash midway
    const glitchT = setTimeout(() => {
      setGlitchFlash(true);
      setTimeout(() => setGlitchFlash(false), 100);
    }, duration * 0.5);
    timeouts.push(glitchT);

    // Complete
    const completeT = setTimeout(() => {
      onComplete?.();
    }, duration);
    timeouts.push(completeT);

    return () => {
      intervals.forEach(clearInterval);
      timeouts.forEach(clearTimeout);
    };
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 10001,
            background: '#050505',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 16,
          }}
        >
          {/* Scanlines */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
            pointerEvents: 'none', opacity: 0.5,
          }} />

          {/* Glitch flash */}
          {glitchFlash && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(255,46,46,0.05)',
              pointerEvents: 'none',
            }} />
          )}

          {/* Boot lines */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
            {lines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: (sequence[i]?.delay || 0) / 1000, duration: 0.3 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{
                    fontSize: 9, color: line.complete ? '#FF2E2E' : '#555',
                    fontFamily: 'JetBrains Mono, monospace',
                    letterSpacing: '0.15em',
                    transition: 'color 0.3s',
                  }}>
                    {line.text}
                  </span>
                  <span style={{
                    fontSize: 8, color: '#333',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {Math.floor(line.progress * 100)}%
                  </span>
                </div>
                <div style={{
                  height: 2, background: 'rgba(255,255,255,0.04)',
                  borderRadius: 1, overflow: 'hidden',
                }}>
                  <motion.div style={{
                    height: '100%',
                    width: `${line.progress * 100}%`,
                    background: line.complete
                      ? '#FF2E2E'
                      : 'linear-gradient(90deg, #FF2E2E, rgba(255,46,46,0.5))',
                    borderRadius: 1,
                    transition: 'width 0.03s linear',
                    boxShadow: line.complete ? '0 0 8px rgba(255,46,46,0.3)' : 'none',
                  }} />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Blinking cursor */}
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{
              fontSize: 12, color: '#FF2E2E',
              fontFamily: 'JetBrains Mono, monospace',
              marginTop: 8,
            }}
          >
            _
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
