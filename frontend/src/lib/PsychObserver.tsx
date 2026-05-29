'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PsychObserverContextType {
  observations: string[];
  triggerObservation: () => void;
}

const PsychObserverContext = createContext<PsychObserverContextType>({
  observations: [],
  triggerObservation: () => {},
});

export const usePsychObserver = () => useContext(PsychObserverContext);

// ─── Behavior tracking keys in sessionStorage ───
const KEYS = {
  roomVisits: 'ah_psych_rooms',       // { deepTalk: 3, confessions: 7, ... }
  messagesSent: 'ah_psych_sent',      // number
  messagesRead: 'ah_psych_read',      // number  
  sessionsAfterMidnight: 'ah_psych_midnight', // number
  totalSessions: 'ah_psych_sessions', // number
  lastVisitTime: 'ah_psych_lasttime', // ISO string
};

interface BehaviorProfile {
  topRoom: string | null;
  roomCount: number;
  sentCount: number;
  readCount: number;
  readToSendRatio: number; // >2 means reads more than speaks
  midnightSessions: number;
  totalSessions: number;
  isReturning: boolean;
}

const OBSERVATION_TEMPLATES: ((p: BehaviorProfile) => string | null)[] = [
  (p) => p.topRoom ? `You spend a lot of time in ${p.topRoom.toUpperCase()}.` : null,
  (p) => p.readToSendRatio > 2 ? 'You read more than you speak.' : null,
  (p) => p.readToSendRatio < 0.5 ? 'You speak more than you listen.' : null,
  (p) => p.midnightSessions > 1 ? 'You always return after midnight.' : null,
  (p) => p.midnightSessions > 3 ? 'The night knows your patterns.' : null,
  (p) => p.isReturning ? `You've been here before. Same time.` : null,
  (p) => p.totalSessions > 5 ? 'You keep coming back.' : null,
  (p) => p.totalSessions > 10 ? 'This is becoming a habit.' : null,
  (p) => p.sentCount === 0 ? 'You avoid conversations.' : null,
  (p) => p.sentCount > 20 ? 'You have a lot to say tonight.' : null,
  (p) => p.roomCount > 3 ? 'You explore more than most.' : null,
  () => 'Someone noticed you.',
  () => 'You were observed entering.',
  () => 'Your signal has been logged.',
  () => 'Patterns detected.',
  () => 'The system is watching.',
  () => 'Your behavior is being analyzed.',
  () => 'You hesitate before typing.',
  () => 'You scroll like you are looking for something.',
];

function getProfile(): BehaviorProfile {
  const roomsRaw = localStorage.getItem(KEYS.roomVisits);
  const rooms: Record<string, number> = roomsRaw ? JSON.parse(roomsRaw) : {};
  const roomEntries = Object.entries(rooms);
  const topRoom = roomEntries.length > 0
    ? roomEntries.sort((a, b) => b[1] - a[1])[0][0]
    : null;

  const sentCount = parseInt(localStorage.getItem(KEYS.messagesSent) || '0');
  const readCount = parseInt(localStorage.getItem(KEYS.messagesRead) || '0');
  const midnightSessions = parseInt(localStorage.getItem(KEYS.sessionsAfterMidnight) || '0');
  const totalSessions = parseInt(localStorage.getItem(KEYS.totalSessions) || '0');

  const lastVisit = localStorage.getItem(KEYS.lastVisitTime);
  const now = new Date();
  let isReturning = false;
  if (lastVisit) {
    const lastDate = new Date(lastVisit);
    const hoursDiff = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
    isReturning = hoursDiff < 48 && hoursDiff > 1;
  }

  return {
    topRoom,
    roomCount: roomEntries.length,
    sentCount,
    readCount,
    readToSendRatio: sentCount > 0 ? readCount / sentCount : readCount > 0 ? 999 : 1,
    midnightSessions,
    totalSessions,
    isReturning,
  };
}

function generateObservation(): string {
  const profile = getProfile();
  // Shuffle and try templates until one returns a non-null observation
  const shuffled = [...OBSERVATION_TEMPLATES].sort(() => Math.random() - 0.5);
  for (const template of shuffled) {
    const result = template(profile);
    if (result) return result;
  }
  return 'The system is watching.';
}

// ─── Floating observation display ───
function ObservationDisplay({ observations }: { observations: { id: number; text: string }[] }) {
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 32, zIndex: 200,
      pointerEvents: 'none', maxWidth: 320,
    }}>
      <AnimatePresence>
        {observations.map((obs) => (
          <motion.div
            key={obs.id}
            initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
            animate={{ opacity: 0.6, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            style={{
              marginBottom: 8,
              padding: '8px 14px',
              background: 'rgba(8,8,8,0.85)',
              border: '1px solid rgba(255,255,255,0.04)',
              borderLeft: '2px solid rgba(255,46,46,0.3)',
              borderRadius: 3,
            }}
          >
            <p style={{
              fontSize: 8, color: '#FF2E2E', letterSpacing: '0.2em',
              fontFamily: 'JetBrains Mono, monospace', marginBottom: 3,
              opacity: 0.7,
            }}>
              OBSERVER
            </p>
            <p style={{
              fontSize: 10, color: '#666', fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.05em', lineHeight: 1.5,
            }}>
              {`> ${obs.text}`}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export const PsychObserverProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeObservations, setActiveObservations] = useState<{ id: number; text: string }[]>([]);
  const [allObservations, setAllObservations] = useState<string[]>([]);
  const observationCountRef = useRef(0);
  const idCounterRef = useRef(0);

  // Track session on mount
  useEffect(() => {
    const sessions = parseInt(localStorage.getItem(KEYS.totalSessions) || '0');
    localStorage.setItem(KEYS.totalSessions, String(sessions + 1));
    localStorage.setItem(KEYS.lastVisitTime, new Date().toISOString());

    // Track midnight session
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) {
      const midnightCount = parseInt(localStorage.getItem(KEYS.sessionsAfterMidnight) || '0');
      localStorage.setItem(KEYS.sessionsAfterMidnight, String(midnightCount + 1));
    }
  }, []);

  const showObservation = (text: string) => {
    const id = ++idCounterRef.current;
    setActiveObservations(prev => [...prev, { id, text }]);
    setAllObservations(prev => [...prev, text]);
    // Auto-remove after 6 seconds
    setTimeout(() => {
      setActiveObservations(prev => prev.filter(o => o.id !== id));
    }, 6000);
  };

  const triggerObservation = () => {
    if (observationCountRef.current >= 5) return; // Max per session
    observationCountRef.current++;
    const text = generateObservation();
    showObservation(text);
  };

  // Auto-trigger observations
  useEffect(() => {
    // First observation 45-120 seconds after mount
    const firstDelay = 45000 + Math.random() * 75000;
    const t1 = setTimeout(() => {
      triggerObservation();

      // Second observation 60-180 seconds later
      const secondDelay = 60000 + Math.random() * 120000;
      const t2 = setTimeout(() => {
        triggerObservation();

        // Third observation 90-240 seconds later
        const thirdDelay = 90000 + Math.random() * 150000;
        const t3 = setTimeout(() => {
          triggerObservation();
        }, thirdDelay);
        return () => clearTimeout(t3);
      }, secondDelay);
      return () => clearTimeout(t2);
    }, firstDelay);

    return () => clearTimeout(t1);
  }, []);

  return (
    <PsychObserverContext.Provider value={{ observations: allObservations, triggerObservation }}>
      {children}
      <ObservationDisplay observations={activeObservations} />
    </PsychObserverContext.Provider>
  );
};

// ─── Helper functions for other components to call ───
export const trackRoomVisit = (roomType: string) => {
  const raw = localStorage.getItem(KEYS.roomVisits);
  const rooms: Record<string, number> = raw ? JSON.parse(raw) : {};
  rooms[roomType] = (rooms[roomType] || 0) + 1;
  localStorage.setItem(KEYS.roomVisits, JSON.stringify(rooms));
};

export const trackMessageSent = () => {
  const count = parseInt(localStorage.getItem(KEYS.messagesSent) || '0');
  localStorage.setItem(KEYS.messagesSent, String(count + 1));
};

export const trackMessageRead = () => {
  const count = parseInt(localStorage.getItem(KEYS.messagesRead) || '0');
  localStorage.setItem(KEYS.messagesRead, String(count + 1));
};
