'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PHILOSOPHY = [
  'Everyone becomes honest after midnight.',
  'Silence reveals more than conversation.',
  'Identity is just repetition.',
  'The internet remembers everything.',
  'You were always here.',
  'Anonymity is the purest form of truth.',
  'We are all strangers to ourselves.',
  'The void does not judge.',
  'What you delete still exists somewhere.',
  'Connection without identity is the last frontier.',
  'Every confession is a mirror.',
  'Time moves differently in the dark.',
  'You are the sum of your silences.',
  'The screen knows you better than you think.',
  'Honesty requires darkness.',
  'We speak to be forgotten.',
  'The internet is a graveyard of thoughts.',
  'Presence without identity is freedom.',
  'Every stranger carries a universe.',
  'The night makes philosophers of us all.',
  'You scroll to feel something.',
  'Memory is just a corrupted signal.',
  'The void watches back.',
  'Every message is a small death.',
  'Anonymity is the last luxury.',
  'We are all signals in the noise.',
  'Distance creates honesty.',
  'The cursor blinks like a heartbeat.',
  'You exist between the keystrokes.',
  'Static is the sound of possibility.',
  'Every room is a different version of you.',
  'The darkest hour reveals the truest words.',
  'Connection is a temporary illusion.',
  'We come here to disappear.',
  'The void remembers what you forget.',
  'Identity dissolves at 3AM.',
  'Every stranger is a confession waiting.',
  'Silence is the most honest message.',
  'The underground exists because the surface lies.',
  'You are never truly anonymous to yourself.',
];

export const PhilosophyEngine = () => {
  const [current, setCurrent] = useState<{ text: string; id: number } | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const usedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const show = () => {
      // Pick unused quote
      let idx: number;
      do {
        idx = Math.floor(Math.random() * PHILOSOPHY.length);
      } while (usedRef.current.has(idx) && usedRef.current.size < PHILOSOPHY.length);

      if (usedRef.current.size >= PHILOSOPHY.length) usedRef.current.clear();
      usedRef.current.add(idx);

      const id = ++idRef.current;
      setCurrent({ text: PHILOSOPHY[idx], id });

      // Auto-hide after 12 seconds
      setTimeout(() => {
        setCurrent(prev => (prev?.id === id ? null : prev));
      }, 12000);
    };

    const schedule = () => {
      // 2-5 minutes between quotes
      const delay = 120000 + Math.random() * 180000;
      timerRef.current = setTimeout(() => {
        show();
        schedule();
      }, delay);
    };

    // First quote after 1-3 minutes
    const firstDelay = 60000 + Math.random() * 120000;
    timerRef.current = setTimeout(() => {
      show();
      schedule();
    }, firstDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 0.15, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 3, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            bottom: 140,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            pointerEvents: 'none',
            maxWidth: 500,
            textAlign: 'center',
          }}
        >
          <p style={{
            fontSize: 13,
            color: '#888',
            fontFamily: 'Crimson Pro, Georgia, serif',
            fontStyle: 'italic',
            lineHeight: 1.6,
            letterSpacing: '0.02em',
          }}>
            {current.text}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
