'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useIdentity } from '@/lib/IdentityProvider';
import { useAmbientAudio } from '@/lib/AmbientAudioProvider';

interface TermLog {
  text: string;
  type: 'info' | 'success' | 'warn' | 'critical';
  time: string;
}

export default function EndPage() {
  const router = useRouter();
  const { regenerate, identity, missions, titles } = useIdentity();
  const { setCurrentRoom } = useAmbientAudio();
  
  // Save identity state before it's regenerated or wiped
  const [purgedIdentity, setPurgedIdentity] = useState('');
  const [phase, setPhase] = useState<'purge' | 'fade-in' | 'dashboard'>('purge');
  const [consoleLogs, setConsoleLogs] = useState<TermLog[]>([]);
  const [glitchText, setGlitchText] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCurrentRoom('end');
  }, [setCurrentRoom]);

  useEffect(() => {
    if (identity && !purgedIdentity) {
      setPurgedIdentity(identity);
    }
  }, [identity, purgedIdentity]);

  // Terminal Purge logs animation
  useEffect(() => {
    const logs: Omit<TermLog, 'time'>[] = [
      { text: 'INITIATING SYSTEM MEMORY PURGE...', type: 'info' },
      { text: 'TERMINATING WEBRTC PEER-TO-PEER LINKS...', type: 'info' },
      { text: 'WebRTC PeerConnection: closed successfully.', type: 'success' },
      { text: 'DISCONNECTING WEBSOCKET ENDPOINTS...', type: 'info' },
      { text: 'Socket connections: unbound and severed.', type: 'success' },
      { text: 'ERASING CHAT HISTORY BUFFER...', type: 'warn' },
      { text: 'Messages deleted: 200/200 wiped from transient memory.', type: 'success' },
      { text: 'WIPING TEMPORARY SESSION TOKENS...', type: 'info' },
      { text: 'Identity metadata purged.', type: 'success' },
      { text: 'SHREDDING IN-MEMORY ROOM SCHEMAS...', type: 'warn' },
      { text: 'Room records deleted: 100% cleared.', type: 'success' },
      { text: 'OVERWRITING ENTROPY MATRIX FOR TRACELESS COEXISTENCE...', type: 'info' },
      { text: 'SYSTEM PURGE COMPLETE. NO MEMORY. NO RESIDUE.', type: 'critical' },
      { text: 'STATUS: YOU ARE SECURELY ANONYMOUS.', type: 'success' },
    ];

    let currentLogIndex = 0;
    const addNextLog = () => {
      if (currentLogIndex < logs.length) {
        const timeStr = new Date().toLocaleTimeString();
        setConsoleLogs(prev => [...prev, { ...logs[currentLogIndex], time: timeStr }]);
        currentLogIndex++;
        // Speed up logs slightly as they progress
        const delay = currentLogIndex === logs.length ? 600 : Math.max(120, 350 - currentLogIndex * 20);
        setTimeout(addNextLog, delay);
      } else {
        // Purge complete, move to title fade-in phase
        setTimeout(() => {
          setPhase('fade-in');
        }, 1200);
      }
    };

    const initialTimeout = setTimeout(addNextLog, 300);
    return () => clearTimeout(initialTimeout);
  }, []);

  // Control sub-phases
  useEffect(() => {
    if (phase === 'fade-in') {
      const t = setTimeout(() => {
        setPhase('dashboard');
      }, 3500);
      return () => clearTimeout(t);
    }
    if (phase === 'dashboard') {
      const t = setTimeout(() => {
        setShowStats(true);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Glitch identity effect
  useEffect(() => {
    if (!purgedIdentity || phase === 'purge') return;

    let iterations = 0;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_@#$';
    const interval = setInterval(() => {
      setGlitchText(() => {
        return purgedIdentity
          .split('')
          .map((char, index) => {
            if (char === '_') return '_';
            if (index < iterations) return purgedIdentity[index];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join('');
      });

      if (iterations >= purgedIdentity.length) {
        clearInterval(interval);
      }
      iterations += 0.25;
    }, 65);

    return () => clearInterval(interval);
  }, [purgedIdentity, phase]);

  const handleAgain = () => {
    regenerate();
    router.push('/lobby');
  };

  const handleExit = () => {
    regenerate();
    router.push('/');
  };

  // Particles for background
  const particles = mounted ? Array.from({ length: 15 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 5,
    duration: 10 + Math.random() * 10,
    size: 1 + Math.random() * 1.5,
  })) : [];

  return (
    <main
      id="end-page"
      style={{
        background: '#050505',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--font-body), Space Grotesk, sans-serif',
        color: '#F0F0F0',
        padding: '24px',
      }}
    >
      {/* Background drift particles */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {particles.map(p => (
          <motion.div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.left}%`,
              bottom: '-10px',
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: '#FF2E2E',
              opacity: 0.05,
            }}
            animate={{
              y: [0, -1000],
              opacity: [0, 0.15, 0.15, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* PHASE 1: Terminal Purge Console */}
        {phase === 'purge' && (
          <motion.div
            key="purge-console"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            style={{
              width: '100%',
              maxWidth: '680px',
              background: 'rgba(10,10,10,0.85)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderLeft: '3px solid var(--accent, #FF2E2E)',
              borderRadius: '6px',
              padding: '20px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,46,46,0.01)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Terminal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF2E2E' }}></span>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.12em', color: '#888' }}>TERMINAL::SHREDDER_V1.03</span>
              </div>
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono), monospace', color: '#444' }}>SECURE SESSION</span>
            </div>

            {/* Terminal Logs */}
            <div style={{ height: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', fontFamily: 'var(--font-mono), monospace', fontSize: '11px', scrollbarWidth: 'none' }}>
              {consoleLogs.map((log, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', color: log.type === 'success' ? '#1ec864' : log.type === 'warn' ? '#FF6B35' : log.type === 'critical' ? '#FF2E2E' : '#888' }}>
                  <span style={{ color: '#333' }}>[{log.time}]</span>
                  <span>{log.type === 'critical' ? '⚡' : log.type === 'warn' ? '⚠' : '>'}</span>
                  <span style={{ lineHeight: '1.4', flex: 1 }}>{log.text}</span>
                </div>
              ))}
              <div className="terminal-cursor" style={{ height: '14px', width: '8px' }} />
            </div>
          </motion.div>
        )}

        {/* PHASE 2 & 3: Cinematic Dashboard */}
        {phase !== 'purge' && (
          <motion.div
            key="cinematic-final"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              maxWidth: '600px',
              textAlign: 'center',
              zIndex: 10,
            }}
          >
            {/* Philosophical Banner */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 1.2 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '24px' }}
            >
              <div style={{ width: '40px', height: '1px', background: '#FF2E2E', opacity: 0.3 }} />
              <h1
                className="cinematic"
                style={{
                  fontSize: 'clamp(24px, 5vw, 42px)',
                  color: '#DDDDDD',
                  letterSpacing: '0.04em',
                  fontFamily: 'var(--font-cinematic), Crimson Pro, Georgia, serif',
                  textShadow: '0 0 30px rgba(255,46,46,0.1)',
                }}
              >
                This moment no longer exists.
              </h1>
              <p
                style={{
                  fontSize: '13px',
                  color: '#666',
                  letterSpacing: '0.2em',
                  fontFamily: 'var(--font-mono), monospace',
                  textTransform: 'uppercase',
                }}
              >
                No record. No history. No trace.
              </p>
              <div style={{ width: '40px', height: '1px', background: '#FF2E2E', opacity: 0.3 }} />
            </motion.div>

            {/* Glitchy identity notice */}
            {purgedIdentity && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.8 }}
                transition={{ delay: 1, duration: 0.8 }}
                style={{
                  margin: '8px 0 32px 0',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono), monospace',
                  letterSpacing: '0.15em',
                  color: '#444',
                  textTransform: 'uppercase',
                }}
              >
                IDENTITY SHREDDED:{' '}
                <span style={{ color: '#FF2E2E', textShadow: '0 0 10px rgba(255,46,46,0.4)', fontWeight: 700 }}>
                  {glitchText || purgedIdentity}
                </span>
              </motion.div>
            )}

            {/* Dashboard / Stats Section */}
            {phase === 'dashboard' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: showStats ? 1 : 0, y: showStats ? 0 : 15 }}
                transition={{ duration: 0.8 }}
                style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}
              >
                {/* Stats & Missions Panel */}
                <div
                  className="glass-card"
                  style={{
                    padding: '24px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.04)',
                    borderLeft: '3px solid rgba(255,46,46,0.3)',
                    background: 'rgba(255,255,255,0.01)',
                    textAlign: 'left',
                  }}
                >
                  <p style={{ fontSize: '10px', color: '#FF2E2E', letterSpacing: '0.18em', fontFamily: 'var(--font-mono), monospace', marginBottom: '16px', fontWeight: 600 }}>NIGHTLY METRICS & PROGRESS</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Unlocked Titles */}
                    <div>
                      <p style={{ fontSize: '9px', color: '#444', letterSpacing: '0.12em', marginBottom: '6px' }}>UNLOCKED TITLES</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {titles && titles.length > 0 ? (
                          titles.map((t, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '10px',
                                fontFamily: 'var(--font-mono), monospace',
                                background: 'rgba(255,46,46,0.06)',
                                border: '1px solid rgba(255,46,46,0.2)',
                                borderRadius: '3px',
                                padding: '3px 8px',
                                color: '#FF2E2E',
                              }}
                            >
                              ◉ {t.toUpperCase()}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '11px', color: '#333', fontStyle: 'italic' }}>No titles unlocked yet. Stay active in more sessions.</span>
                        )}
                      </div>
                    </div>

                    {/* Missions */}
                    <div>
                      <p style={{ fontSize: '9px', color: '#444', letterSpacing: '0.12em', marginBottom: '8px' }}>ACTIVE MISSIONS</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {missions && missions.length > 0 ? (
                          missions.map(m => (
                            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                                <span style={{ color: m.completed ? '#888' : '#BBB', textDecoration: m.completed ? 'line-through' : 'none' }}>
                                  {m.label}
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '10px', color: m.completed ? '#1ec864' : '#555' }}>
                                  {m.completed ? 'COMPLETE' : `${m.progress}/${m.goal}`}
                                </span>
                              </div>
                              {/* Progress bar */}
                              <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.03)', borderRadius: '1px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    height: '100%',
                                    background: m.completed ? '#1ec864' : '#FF2E2E',
                                    width: `${(m.progress / m.goal) * 100}%`,
                                    transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)',
                                  }}
                                />
                              </div>
                            </div>
                          ))
                        ) : (
                          <span style={{ fontSize: '11px', color: '#333', fontStyle: 'italic' }}>No missions active.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Option Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
                  <motion.button
                    id="enter-again-btn"
                    onClick={handleAgain}
                    whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(255,46,46,0.3)', border: '1px solid #FF2E2E' }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      padding: '16px 56px',
                      background: '#FF2E2E',
                      border: '1px solid #FF2E2E',
                      borderRadius: '4px',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.2em',
                      cursor: 'pointer',
                      boxShadow: '0 0 15px rgba(255,46,46,0.15)',
                      fontFamily: 'var(--font-body), sans-serif',
                      transition: 'box-shadow 0.3s ease, border 0.3s ease',
                    }}
                  >
                    RE-ENTER THE VOID
                  </motion.button>
                  <button
                    id="exit-btn"
                    onClick={handleExit}
                    style={{
                      fontSize: '12px',
                      color: '#444',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      letterSpacing: '0.12em',
                      fontFamily: 'var(--font-mono), monospace',
                      textTransform: 'uppercase',
                      padding: '6px 12px',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#FF2E2E')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#444')}
                  >
                    Leave the night
                  </button>
                </div>

                {/* Philosophical Quote */}
                <p
                  className="cinematic"
                  style={{
                    fontSize: '13px',
                    color: '#252525',
                    marginTop: '56px',
                    fontStyle: 'italic',
                    fontFamily: 'var(--font-cinematic), Georgia, serif',
                  }}
                >
                  &quot;This is not social media. This is AfterHours.&quot;
                </p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
