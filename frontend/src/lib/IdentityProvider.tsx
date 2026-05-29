'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';

interface IdentityContextType {
  identity: string;
  color: string;
  peerId: string;
  regenerate: () => void;
  missions: Mission[];
  titles: string[];
  completeSession: () => void;
}

interface Mission {
  id: string;
  label: string;
  progress: number;
  goal: number;
  completed: boolean;
}

const ADJECTIVES = [
  'Ghost', 'Shadow', 'Echo', 'Void', 'Cipher', 'Phantom', 'Dusk', 'Neon',
  'Abyss', 'Wraith', 'Specter', 'Glitch', 'Nova', 'Drift', 'Pulse', 'Static',
  'Flicker', 'Sable', 'Mist', 'Rift', 'Surge', 'Ember', 'Haze', 'Veil',
  'Noir', 'Ruin', 'Crest', 'Fray', 'Spark', 'Ash'
];

const COLORS = [
  '#FF2E2E', '#FF6B35', '#F7931E', '#9B59B6',
  '#3498DB', '#1ABC9C', '#E74C3C', '#F39C12',
  '#16A085', '#8E44AD', '#2980B9', '#D35400'
];

const TITLE_THRESHOLDS = [
  { sessions: 1, title: 'Newcomer' },
  { sessions: 3, title: 'Observer' },
  { sessions: 7, title: 'Nightwalker' },
  { sessions: 15, title: 'Listener' },
  { sessions: 30, title: 'Shadow Elder' },
];

const generateName = () => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const num = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
  return `${adj}_${num}`;
};

const generateColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];
const generatePeerId = () => `peer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const DEFAULT_MISSIONS: Mission[] = [
  { id: 'join-3', label: 'Join 3 sessions today', progress: 0, goal: 3, completed: false },
  { id: 'stay-full', label: 'Stay until a session ends', progress: 0, goal: 1, completed: false },
  { id: 'send-10', label: 'Send 10 messages in one session', progress: 0, goal: 10, completed: false },
  { id: 'voice', label: 'Enable your camera once', progress: 0, goal: 1, completed: false },
];

const IdentityContext = createContext<IdentityContextType>({
  identity: '',
  color: '#FF2E2E',
  peerId: '',
  regenerate: () => {},
  missions: DEFAULT_MISSIONS,
  titles: [],
  completeSession: () => {},
});

export const IdentityProvider = ({ children }: { children: ReactNode }) => {
  const [identity, setIdentity] = useState('');
  const [color, setColor] = useState('#FF2E2E');
  const [peerId, setPeerId] = useState('');
  const [missions, setMissions] = useState<Mission[]>(DEFAULT_MISSIONS);
  const [titles, setTitles] = useState<string[]>([]);

  useEffect(() => {
    // Load from localStorage or generate fresh
    const savedMissions = localStorage.getItem('ah_missions');
    const savedTitles = localStorage.getItem('ah_titles');
    
    if (savedMissions) setMissions(JSON.parse(savedMissions));
    if (savedTitles) setTitles(JSON.parse(savedTitles));

    // Always generate fresh identity per page load
    regenerate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regenerate = useCallback(() => {
    setIdentity(generateName());
    setColor(generateColor());
    setPeerId(generatePeerId());
  }, []);

  const completeSession = useCallback(() => {
    setMissions(prev => {
      const updated = prev.map(m => {
        if (m.id === 'join-3' && !m.completed) {
          const progress = Math.min(m.progress + 1, m.goal);
          return { ...m, progress, completed: progress >= m.goal };
        }
        if (m.id === 'stay-full' && !m.completed) {
          return { ...m, progress: 1, completed: true };
        }
        return m;
      });
      localStorage.setItem('ah_missions', JSON.stringify(updated));

      // Check title unlocks
      const sessionsCompleted = updated.find(m => m.id === 'join-3')?.progress || 0;
      const newTitles: string[] = [];
      TITLE_THRESHOLDS.forEach(t => {
        if (sessionsCompleted >= t.sessions) newTitles.push(t.title);
      });
      localStorage.setItem('ah_titles', JSON.stringify(newTitles));
      setTitles(newTitles);

      return updated;
    });
  }, []);

  return (
    <IdentityContext.Provider value={{ identity, color, peerId, regenerate, missions, titles, completeSession }}>
      {children}
    </IdentityContext.Provider>
  );
};

export const useIdentity = () => useContext(IdentityContext);
