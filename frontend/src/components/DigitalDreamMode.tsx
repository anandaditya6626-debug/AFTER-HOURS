'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HIDDEN_MESSAGES = [
  'you are being watched',
  'nothing is permanent',
  'the signal is inside you',
  'wake up',
  'this is not real',
  'someone remembers',
  'the void speaks back',
  'you chose to be here',
  'time is circular',
  'identity is a loop',
];

const REVERSED_WORDS = [
  'SRUOHREFTFA',
  'DIOV',
  'LANGIS',
  'EREHWON',
  'HCTAW',
  'MAERD',
];

interface DigitalDreamModeProps {
  active: boolean;
  onEnd: () => void;
}

export const DigitalDreamMode = ({ active, onEnd }: DigitalDreamModeProps) => {
  const [phase, setPhase] = useState<'entering' | 'active' | 'exiting' | 'off'>('off');
  const [hiddenMessages, setHiddenMessages] = useState<{ text: string; x: number; y: number }[]>([]);
  const [floatingWords, setFloatingWords] = useState<{ text: string; x: number; y: number; delay: number }[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef(60000 + Math.random() * 30000); // 60-90 seconds

  useEffect(() => {
    if (active && phase === 'off') {
      setPhase('entering');

      // Generate hidden messages in corners
      const msgs = Array.from({ length: 4 }, () => ({
        text: HIDDEN_MESSAGES[Math.floor(Math.random() * HIDDEN_MESSAGES.length)],
        x: Math.random() > 0.5 ? 2 + Math.random() * 8 : 90 + Math.random() * 8,
        y: 5 + Math.random() * 90,
      }));
      setHiddenMessages(msgs);

      // Generate floating reversed words
      const words = Array.from({ length: 6 }, () => ({
        text: REVERSED_WORDS[Math.floor(Math.random() * REVERSED_WORDS.length)],
        x: 10 + Math.random() * 80,
        y: 10 + Math.random() * 80,
        delay: Math.random() * 5,
      }));
      setFloatingWords(words);

      // Transition to active after 2s entrance
      setTimeout(() => setPhase('active'), 2000);

      // Auto-end after duration
      timerRef.current = setTimeout(() => {
        setPhase('exiting');
        setTimeout(() => {
          setPhase('off');
          onEnd();
        }, 2000);
      }, durationRef.current);
    }

    if (!active && phase !== 'off') {
      setPhase('exiting');
      setTimeout(() => setPhase('off'), 2000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active]);

  // Apply dream mode CSS effects to body
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    if (phase === 'active' || phase === 'entering') {
      root.style.setProperty('--dream-active', '1');
      root.style.setProperty('--dream-float', '1');
    } else {
      root.style.setProperty('--dream-active', '0');
      root.style.setProperty('--dream-float', '0');
    }
  }, [phase]);

  if (phase === 'off') return null;

  return (
    <>
      {/* Dream atmosphere overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'exiting' ? 0 : 0.15 }}
        transition={{ duration: 2 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9995,
          background: 'radial-gradient(ellipse at center, rgba(123,45,139,0.2) 0%, rgba(0,0,50,0.1) 50%, transparent 80%)',
          pointerEvents: 'none',
          mixBlendMode: 'screen',
        }}
      />

      {/* Hidden corner messages */}
      <AnimatePresence>
        {phase === 'active' && hiddenMessages.map((msg, i) => (
          <motion.p
            key={`hidden-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.15, 0.08, 0.12, 0] }}
            transition={{ duration: 8, repeat: Infinity, delay: i * 2 }}
            style={{
              position: 'fixed',
              left: `${msg.x}%`,
              top: `${msg.y}%`,
              fontSize: 7,
              color: '#666',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.15em',
              pointerEvents: 'none',
              zIndex: 9996,
              textTransform: 'lowercase',
              whiteSpace: 'nowrap',
            }}
          >
            {msg.text}
          </motion.p>
        ))}
      </AnimatePresence>

      {/* Floating reversed words */}
      {phase === 'active' && floatingWords.map((word, i) => (
        <motion.p
          key={`float-${i}`}
          animate={{
            y: [0, -30, 0, 20, 0],
            x: [0, 10, -5, 15, 0],
            opacity: [0, 0.06, 0.03, 0.08, 0],
          }}
          transition={{
            duration: 12 + i * 2,
            repeat: Infinity,
            delay: word.delay,
            ease: 'easeInOut',
          }}
          style={{
            position: 'fixed',
            left: `${word.x}%`,
            top: `${word.y}%`,
            fontSize: 40 + Math.random() * 30,
            fontWeight: 900,
            color: '#222',
            fontFamily: 'Space Grotesk, sans-serif',
            pointerEvents: 'none',
            zIndex: 9994,
            letterSpacing: '0.1em',
            userSelect: 'none',
          }}
        >
          {word.text}
        </motion.p>
      ))}

      {/* Dream mode label */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'active' ? 0.4 : 0 }}
        transition={{ duration: 3 }}
        style={{
          position: 'fixed',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9996,
          pointerEvents: 'none',
          textAlign: 'center',
        }}
      >
        <p style={{
          fontSize: 8,
          color: '#7B2D8B',
          fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '0.4em',
        }}>
          ◈ DREAM MODE ACTIVE ◈
        </p>
      </motion.div>
    </>
  );
};
