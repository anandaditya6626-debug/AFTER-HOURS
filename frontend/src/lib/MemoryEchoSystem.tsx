'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MemoryEchoContextType {
  triggerEcho: () => void;
  storeFragment: (text: string) => void;
}

const MemoryEchoContext = createContext<MemoryEchoContextType>({
  triggerEcho: () => {},
  storeFragment: () => {},
});

export const useMemoryEcho = () => useContext(MemoryEchoContext);

interface StoredFragment {
  text: string;
  timestamp: number; // Unix ms
}

const STORAGE_KEY = 'ah_memory_fragments';
const MAX_FRAGMENTS = 50;

// Community echo fallbacks for users with no local history
const COMMUNITY_ECHOES = [
  "I don't remember the last time I felt real.",
  "Does anyone else feel like this?",
  "I keep coming back here. I don't know why.",
  "The silence was louder than anything I've ever heard.",
  "Nobody knows I'm awake right now.",
  "I told a stranger more than I've told anyone.",
  "Sometimes I think the void is the only honest place.",
  "3AM and I'm still here. What does that say about me?",
  "I used to be someone else.",
  "I can hear the static getting louder.",
  "Does it matter if no one remembers?",
  "I think I said something real tonight.",
  "The rain outside sounds like the end of something.",
  "I don't want to sleep because the thoughts get louder.",
  "This is the only place where I don't have to pretend.",
  "Someone told me they understood. I don't think they did.",
  "I've been watching for hours.",
  "Every confession I read feels like mine.",
  "I wrote something honest and then deleted it.",
  "The static between channels is where I live.",
];

function getStoredFragments(): StoredFragment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addFragment(text: string) {
  const fragments = getStoredFragments();
  fragments.push({ text: text.substring(0, 200), timestamp: Date.now() });
  // Keep only the latest MAX_FRAGMENTS
  if (fragments.length > MAX_FRAGMENTS) fragments.shift();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fragments));
}

function pickEcho(): { text: string; daysAgo: number } | null {
  const fragments = getStoredFragments();
  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  // Filter fragments older than 3 days
  const oldFragments = fragments.filter(f => (now - f.timestamp) > threeDaysMs);

  if (oldFragments.length > 0) {
    const pick = oldFragments[Math.floor(Math.random() * oldFragments.length)];
    const daysAgo = Math.floor((now - pick.timestamp) / (24 * 60 * 60 * 1000));
    return { text: pick.text, daysAgo };
  }

  // Fall back to community echoes
  const communityPick = COMMUNITY_ECHOES[Math.floor(Math.random() * COMMUNITY_ECHOES.length)];
  const fakeDaysAgo = 3 + Math.floor(Math.random() * 25);
  return { text: communityPick, daysAgo: fakeDaysAgo };
}

// ─── Echo Display Component ───
function EchoOverlay({ echo, onDismiss }: { echo: { text: string; daysAgo: number } | null; onDismiss: () => void }) {
  useEffect(() => {
    if (echo) {
      const t = setTimeout(onDismiss, 10000); // Auto-dismiss after 10s
      return () => clearTimeout(t);
    }
  }, [echo, onDismiss]);

  return (
    <AnimatePresence>
      {echo && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 2, ease: 'easeOut' }}
          style={{
            position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
            zIndex: 9996, pointerEvents: 'none', maxWidth: 480, width: '90%',
            textAlign: 'center',
          }}
        >
          {/* VHS timestamp */}
          <motion.p
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              fontSize: 8, color: '#FF2E2E', letterSpacing: '0.3em',
              fontFamily: 'JetBrains Mono, monospace', marginBottom: 12,
              opacity: 0.5,
            }}
          >
            ▮ ECHO RECOVERED — {echo.daysAgo} DAYS AGO
          </motion.p>

          {/* Echo message */}
          <motion.p
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              fontSize: 16,
              color: '#555',
              fontFamily: 'Crimson Pro, Georgia, serif',
              fontStyle: 'italic',
              lineHeight: 1.7,
              filter: 'blur(0.3px)',
              textShadow: '0 0 8px rgba(255,46,46,0.1)',
              letterSpacing: '0.02em',
            }}
          >
            &ldquo;{echo.text}&rdquo;
          </motion.p>

          {/* Source label */}
          <p style={{
            fontSize: 8, color: '#222', letterSpacing: '0.2em',
            fontFamily: 'JetBrains Mono, monospace', marginTop: 16,
          }}>
            ANONYMOUS FRAGMENT — ORIGIN UNKNOWN
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const MemoryEchoProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeEcho, setActiveEcho] = useState<{ text: string; daysAgo: number } | null>(null);
  const echoCountRef = useRef(0);

  const triggerEcho = () => {
    if (echoCountRef.current >= 3) return; // Max 3 per session
    const echo = pickEcho();
    if (echo) {
      echoCountRef.current++;
      setActiveEcho(echo);
    }
  };

  const storeFragment = (text: string) => {
    if (text.trim().length >= 10) { // Only store meaningful messages
      addFragment(text.trim());
    }
  };

  // Auto-trigger echoes at random intervals
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const scheduleEcho = () => {
      // 3-8 minutes between echoes
      const delay = 180000 + Math.random() * 300000;
      timeout = setTimeout(() => {
        triggerEcho();
        scheduleEcho();
      }, delay);
    };

    // First echo after 2-5 minutes
    const firstDelay = 120000 + Math.random() * 180000;
    timeout = setTimeout(() => {
      triggerEcho();
      scheduleEcho();
    }, firstDelay);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <MemoryEchoContext.Provider value={{ triggerEcho, storeFragment }}>
      {children}
      <EchoOverlay echo={activeEcho} onDismiss={() => setActiveEcho(null)} />
    </MemoryEchoContext.Provider>
  );
};
