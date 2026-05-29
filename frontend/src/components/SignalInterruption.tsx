'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const INTERRUPTION_MESSAGES = [
  'SIGNAL LOST',
  'RECONNECTING...',
  'TRANSMISSION CORRUPTED',
  'INTERFERENCE DETECTED',
  'SIGNAL DEGRADATION',
  'CONNECTION UNSTABLE',
  'PACKET LOSS CRITICAL',
  'FREQUENCY OVERRIDE',
];

interface SignalInterruptionProps {
  /** If true, the component manages its own trigger schedule */
  autoTrigger?: boolean;
  /** If true, a single interruption fires immediately */
  forceTrigger?: boolean;
  onComplete?: () => void;
}

export const SignalInterruption = ({
  autoTrigger = true,
  forceTrigger = false,
  onComplete,
}: SignalInterruptionProps) => {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('');
  const [tearStrips, setTearStrips] = useState<{ top: number; height: number; offset: number }[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fireInterruption = () => {
    if (!mountedRef.current) return;

    const msg = INTERRUPTION_MESSAGES[Math.floor(Math.random() * INTERRUPTION_MESSAGES.length)];
    setMessage(msg);

    // Generate random tear strips
    const strips = Array.from({ length: 3 + Math.floor(Math.random() * 4) }, () => ({
      top: Math.random() * 100,
      height: 1 + Math.random() * 4,
      offset: (Math.random() - 0.5) * 20,
    }));
    setTearStrips(strips);
    setActive(true);

    // Phase 1: Screen tears (300ms)
    // Phase 2: Message overlay (1200ms)
    // Phase 3: Flicker back (500ms)
    setTimeout(() => {
      if (mountedRef.current) {
        setActive(false);
        onComplete?.();
      }
    }, 2000);
  };

  // Force trigger from parent
  useEffect(() => {
    if (forceTrigger) fireInterruption();
  }, [forceTrigger]);

  // Auto-trigger schedule
  useEffect(() => {
    if (!autoTrigger) return;
    mountedRef.current = true;

    const schedule = () => {
      // 5-15 minutes between interruptions
      const delay = 300000 + Math.random() * 600000;
      timerRef.current = setTimeout(() => {
        fireInterruption();
        schedule();
      }, delay);
    };

    // First interruption after 3-8 minutes
    const firstDelay = 180000 + Math.random() * 300000;
    timerRef.current = setTimeout(() => {
      fireInterruption();
      schedule();
    }, firstDelay);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [autoTrigger]);

  return (
    <AnimatePresence>
      {active && (
        <>
          {/* Screen tear strips */}
          {tearStrips.map((strip, i) => (
            <motion.div
              key={`tear-${i}`}
              initial={{ opacity: 0, x: 0 }}
              animate={{
                opacity: [0, 1, 0.8, 0],
                x: [0, strip.offset, -strip.offset, 0],
              }}
              transition={{ duration: 0.4, ease: 'linear' }}
              style={{
                position: 'fixed',
                top: `${strip.top}%`,
                left: 0,
                right: 0,
                height: strip.height,
                background: 'rgba(255,255,255,0.15)',
                zIndex: 9998,
                pointerEvents: 'none',
                mixBlendMode: 'overlay',
              }}
            />
          ))}

          {/* Full screen glitch overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.95, 0.7, 0.95, 0] }}
            transition={{ duration: 2, times: [0, 0.15, 0.5, 0.85, 1] }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              background: 'rgba(5,5,5,0.97)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              pointerEvents: 'none',
            }}
          >
            {/* Scanline noise */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px)',
              pointerEvents: 'none',
            }} />

            <motion.p
              animate={{ opacity: [1, 0.3, 1, 0, 1] }}
              transition={{ duration: 0.5, repeat: 3 }}
              style={{
                fontSize: 14,
                color: '#FF2E2E',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '0.3em',
                fontWeight: 700,
                textShadow: '0 0 20px rgba(255,46,46,0.5)',
              }}
            >
              {message}
            </motion.p>

            <motion.div
              animate={{ width: ['0%', '60%', '100%', '60%', '0%'] }}
              transition={{ duration: 2, ease: 'easeInOut' }}
              style={{
                height: 1,
                background: 'rgba(255,46,46,0.4)',
                marginTop: 8,
              }}
            />

            <p style={{
              fontSize: 8,
              color: '#333',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.2em',
              marginTop: 8,
            }}>
              ATTEMPTING RECOVERY...
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
