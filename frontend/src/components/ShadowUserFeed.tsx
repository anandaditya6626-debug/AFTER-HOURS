'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SHADOW_NAMES = [
  'watcher_17', 'static_entity', 'signal_lost', 'ghost_09', 'phantom_44',
  'null_user', 'echo_void', 'dead_signal', 'observer_8', 'static_mind',
  'void_walker', 'dark_node', 'silent_one', 'broken_feed', 'lost_freq',
  'night_pulse', 'absent_user', 'decay_signal', 'hollow_id', 'drift_00',
];

const SHADOW_ACTIONS = [
  (name: string) => `${name} entered VOID`,
  (name: string) => `${name} is typing...`,
  (name: string) => `${name} joined room`,
  (name: string) => `${name} has been watching for ${Math.floor(Math.random() * 120) + 5} minutes`,
  (name: string) => `${name} left without speaking`,
  (name: string) => `${name} is observing`,
  (name: string) => `${name} entered CONFESSIONS`,
  (name: string) => `${name} disconnected`,
  (name: string) => `${name} reconnected from unknown origin`,
  (name: string) => `${name} signal detected`,
];

interface ShadowEvent {
  id: number;
  text: string;
  timestamp: number;
}

export const ShadowUserFeed = ({ visible = true }: { visible?: boolean }) => {
  const [events, setEvents] = useState<ShadowEvent[]>([]);
  const idRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!visible) return;

    const generateEvent = (): ShadowEvent => {
      const name = SHADOW_NAMES[Math.floor(Math.random() * SHADOW_NAMES.length)];
      const actionFn = SHADOW_ACTIONS[Math.floor(Math.random() * SHADOW_ACTIONS.length)];
      return {
        id: ++idRef.current,
        text: actionFn(name),
        timestamp: Date.now(),
      };
    };

    const schedule = () => {
      const delay = 8000 + Math.random() * 20000; // 8-28 seconds
      timerRef.current = setTimeout(() => {
        const evt = generateEvent();
        setEvents(prev => {
          const next = [...prev, evt];
          return next.slice(-3); // Keep only last 3
        });

        // Auto-remove after 6 seconds
        setTimeout(() => {
          setEvents(prev => prev.filter(e => e.id !== evt.id));
        }, 6000);

        schedule();
      }, delay);
    };

    // First event after 5-15 seconds
    const firstDelay = 5000 + Math.random() * 10000;
    timerRef.current = setTimeout(() => {
      const evt = generateEvent();
      setEvents([evt]);
      setTimeout(() => setEvents(prev => prev.filter(e => e.id !== evt.id)), 6000);
      schedule();
    }, firstDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  return (
    <div style={{
      position: 'fixed', bottom: 100, right: 24, zIndex: 150,
      display: 'flex', flexDirection: 'column', gap: 4,
      pointerEvents: 'none', maxWidth: 280,
    }}>
      <AnimatePresence>
        {events.map(evt => (
          <motion.div
            key={evt.id}
            initial={{ opacity: 0, x: 30, scale: 0.95 }}
            animate={{ opacity: 0.7, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.5 }}
            style={{
              padding: '6px 12px',
              background: 'rgba(8,8,8,0.9)',
              border: '1px solid rgba(255,255,255,0.04)',
              borderRadius: 3,
            }}
          >
            <p style={{
              fontSize: 9,
              color: '#444',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.05em',
            }}>
              {evt.text}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
