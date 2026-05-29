'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SYMBOLS = ['⌬', '⊗', '⌖', '⊕', '◈', '⌁', '⌇', '⊙'];

const LORE_ENTRIES = [
  { title: 'TRANSMISSION #001', text: 'AfterHours was not built. It was found. Deep in the static of an abandoned server, signals began forming patterns. The first users did not choose to enter — they were drawn.' },
  { title: 'TRANSMISSION #002', text: 'The Void existed before the platform. Some say it is the platform. Every room, every confession, every stranger — they all lead back to the same dark frequency.' },
  { title: 'TRANSMISSION #003', text: 'At 3:33 AM on a Tuesday, every user online heard the same whisper. None of them could agree on what it said. The logs show nothing.' },
  { title: 'TRANSMISSION #004', text: 'There is a room that appears only when all other rooms are empty. No one has been inside and remembered. The system calls it ORIGIN.' },
  { title: 'TRANSMISSION #005', text: 'The identity generator is not random. It reads your signal — the electromagnetic pattern your device emits. Your name was always yours.' },
  { title: 'ARCHIVE FRAGMENT', text: 'Someone wrote: "I think the void is listening. Not the room. The actual void. The space between the data." This was posted 47 days before the platform launched.' },
  { title: 'ENCRYPTED NOTE', text: 'The symbols are not decoration. They are a language older than the internet. Older than electricity. They were carved into telegraph poles in 1847.' },
  { title: 'SIGNAL INTERCEPT', text: 'We are not anonymous. We never were. The system knows. But it chooses not to remember. That is the gift.' },
];

interface SymbolPosition {
  id: number;
  symbol: string;
  x: number;
  y: number;
}

export const SecretSymbolLayer = () => {
  const [symbols, setSymbols] = useState<SymbolPosition[]>([]);
  const [clickedSequence, setClickedSequence] = useState<string[]>([]);
  const [unlockedLore, setUnlockedLore] = useState<typeof LORE_ENTRIES[0] | null>(null);
  const [showHint, setShowHint] = useState(false);
  const sequenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const unlockedCountRef = useRef(0);

  // Generate random symbol positions on mount
  useEffect(() => {
    const generated: SymbolPosition[] = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      symbol: SYMBOLS[i % SYMBOLS.length],
      x: 5 + Math.random() * 88,
      y: 10 + Math.random() * 80,
    }));
    setSymbols(generated);
  }, []);

  const handleSymbolClick = useCallback((symbol: string) => {
    // Reset timer on each click
    if (sequenceTimerRef.current) clearTimeout(sequenceTimerRef.current);

    const newSequence = [...clickedSequence, symbol];
    setClickedSequence(newSequence);

    // Check for 3-symbol sequence
    if (newSequence.length >= 3) {
      // Unlock lore
      const loreIndex = unlockedCountRef.current % LORE_ENTRIES.length;
      unlockedCountRef.current++;
      setUnlockedLore(LORE_ENTRIES[loreIndex]);
      setClickedSequence([]);

      // Auto-dismiss lore after 12 seconds
      setTimeout(() => setUnlockedLore(null), 12000);
    } else {
      // Reset sequence after 5 seconds of inactivity
      sequenceTimerRef.current = setTimeout(() => {
        setClickedSequence([]);
      }, 5000);
    }
  }, [clickedSequence]);

  // Show hint after 2 minutes
  useEffect(() => {
    const t = setTimeout(() => setShowHint(true), 120000);
    const t2 = setTimeout(() => setShowHint(false), 130000);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, []);

  return (
    <>
      {/* Hidden symbols scattered across the page */}
      {symbols.map(sym => (
        <motion.div
          key={sym.id}
          whileHover={{ opacity: 0.5, scale: 1.5, textShadow: '0 0 10px rgba(255,46,46,0.5)' }}
          onClick={() => handleSymbolClick(sym.symbol)}
          style={{
            position: 'fixed',
            left: `${sym.x}%`,
            top: `${sym.y}%`,
            fontSize: 16,
            color: '#FF2E2E',
            opacity: 0.03,
            cursor: 'pointer',
            zIndex: 100,
            transition: 'opacity 0.5s, text-shadow 0.5s',
            userSelect: 'none',
            fontFamily: 'serif',
          }}
        >
          {sym.symbol}
        </motion.div>
      ))}

      {/* Sequence indicator */}
      {clickedSequence.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999, pointerEvents: 'none',
            display: 'flex', gap: 12,
          }}
        >
          {clickedSequence.map((s, i) => (
            <span key={i} style={{
              fontSize: 28, color: '#FF2E2E',
              textShadow: '0 0 15px rgba(255,46,46,0.4)',
            }}>
              {s}
            </span>
          ))}
          {Array.from({ length: 3 - clickedSequence.length }, (_, i) => (
            <span key={`empty-${i}`} style={{
              fontSize: 28, color: '#222',
            }}>
              ◌
            </span>
          ))}
        </motion.div>
      )}

      {/* Unlocked lore display */}
      <AnimatePresence>
        {unlockedLore && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1 }}
            style={{
              position: 'fixed', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10000, maxWidth: 460, width: '90%',
              padding: '32px 36px',
              background: 'rgba(5,5,5,0.97)',
              border: '1px solid rgba(255,46,46,0.2)',
              borderLeft: '3px solid #FF2E2E',
              borderRadius: 4,
            }}
            onClick={() => setUnlockedLore(null)}
          >
            <p style={{
              fontSize: 8, color: '#FF2E2E', letterSpacing: '0.3em',
              fontFamily: 'JetBrains Mono, monospace', marginBottom: 12,
            }}>
              ▮ {unlockedLore.title}
            </p>
            <p style={{
              fontSize: 13, color: '#666', lineHeight: 1.7,
              fontFamily: 'Crimson Pro, Georgia, serif', fontStyle: 'italic',
            }}>
              {unlockedLore.text}
            </p>
            <p style={{
              fontSize: 7, color: '#222', letterSpacing: '0.2em',
              fontFamily: 'JetBrains Mono, monospace', marginTop: 16,
            }}>
              CLICK TO DISMISS — FRAGMENT WILL NOT REPEAT
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle hint */}
      <AnimatePresence>
        {showHint && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.08 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', bottom: 30, right: 30,
              fontSize: 7, color: '#FF2E2E',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.2em', pointerEvents: 'none', zIndex: 100,
            }}
          >
            THE SYMBOLS ARE WATCHING
          </motion.p>
        )}
      </AnimatePresence>
    </>
  );
};
