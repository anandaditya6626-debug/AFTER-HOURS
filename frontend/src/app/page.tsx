'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useIdentity } from '@/lib/IdentityProvider';
import { useSocket } from '@/lib/SocketProvider';
import { useAmbientAudio } from '@/lib/AmbientAudioProvider';

const SYSTEM_NOTIFICATIONS = [
  'Someone is reading your confession.',
  'identity mismatch detected.',
  '14 users are inside VOID right now.',
  'Ghost_77 entered CONFESSIONS.',
  'Signal interrupted — reconnecting...',
  'Void session starting in 4 minutes.',
  'A stranger is waiting for you.',
  'Echo_33 has been watching.',
  'New confession posted 3 seconds ago.',
  'System breach detected in REDROOM.',
  'You were not supposed to see this.',
  'Phantom_12 has left the void.',
  'MIDNIGHT SESSION starting soon.',
  'Your identity is being generated...',
];

const CORRUPTION_MESSAGES = [
  'IDENTITY FAILURE DETECTED',
  'SIGNAL INTERRUPTED',
  'SYSTEM BREACH',
  'YOU WERE NOT SUPPOSED TO SEE THIS',
  'CONNECTION UNSTABLE',
  'MEMORY PURGE IN PROGRESS',
];

/* ── Particles ───────────────────────────────────────────────── */
function ParticleField() {
  const [dims, setDims] = useState({ w: 1200, h: 800 });
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setDims({ w: window.innerWidth, h: window.innerHeight });
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const particles = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 8,
    duration: 7 + Math.random() * 9,
    size: 1 + Math.random() * 2,
    opacity: 0.1 + Math.random() * 0.35,
    isRed: Math.random() > 0.75,
  }));

  return (
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
            background: p.isRed ? '#FF2E2E' : 'rgba(255,255,255,0.5)',
          }}
          animate={{
            y: [0, -(dims.h + 60)],
            x: [0, (Math.random() - 0.5) * 60],
            opacity: [0, p.opacity, p.opacity, 0],
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
  );
}

/* ── Cursor Glow ─────────────────────────────────────────────── */
function CursorGlow() {
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const springX = useSpring(x, { stiffness: 80, damping: 25 });
  const springY = useSpring(y, { stiffness: 80, damping: 25 });

  useEffect(() => {
    const handler = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY); };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [x, y]);

  return (
    <motion.div
      className="audio-glow"
      style={{
        position: 'fixed',
        left: springX,
        top: springY,
        width: 320,
        height: 320,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,46,46,0.06) 0%, transparent 70%)',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 1,
        mixBlendMode: 'screen',
      }}
    />
  );
}

/* ── Glitch Title ────────────────────────────────────────────── */
function GlitchTitle() {
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const schedule = () => {
      timeout = setTimeout(() => {
        setGlitch(true);
        setTimeout(() => { setGlitch(false); schedule(); }, 350);
      }, 3000 + Math.random() * 5000);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, []);

  const titleStyle: React.CSSProperties = {
    fontSize: 'clamp(60px, 11vw, 130px)',
    fontWeight: 900,
    letterSpacing: '-0.04em',
    lineHeight: 0.9,
    fontFamily: 'Space Grotesk, sans-serif',
    position: 'relative',
    display: 'inline-block',
  };

  return (
    <div style={{ position: 'relative' }}>
      <motion.h1
        style={titleStyle}
        animate={glitch ? { x: [0, -3, 3, -1, 1, 0] } : {}}
        transition={{ duration: 0.3 }}
      >
        <span style={{ color: '#F0F0F0' }}>AFTER</span>
        <span style={{ color: '#FF2E2E' }}>HOURS</span>
      </motion.h1>
      {glitch && (
        <>
          <div style={{
            ...titleStyle, position: 'absolute', inset: 0,
            color: 'rgba(255,0,0,0.5)', transform: 'translate(3px, -1px)',
            mixBlendMode: 'screen', pointerEvents: 'none',
          }}>AFTERHOURS</div>
          <div style={{
            ...titleStyle, position: 'absolute', inset: 0,
            color: 'rgba(0,100,255,0.3)', transform: 'translate(-3px, 1px)',
            mixBlendMode: 'screen', pointerEvents: 'none',
          }}>AFTERHOURS</div>
        </>
      )}
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { identity, color } = useIdentity();
  const { isConnected, globalCount } = useSocket();
  const { ambientEnabled, setAmbientEnabled, setCurrentRoom } = useAmbientAudio();
  const [entered, setEntered] = useState(false);
  const [currentNotif, setCurrentNotif] = useState(0);
  const [corruptionMsg, setCorruptionMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [displayCount, setDisplayCount] = useState(0);
  const countRef = useRef(0);

  // Set ambient room
  useEffect(() => {
    setCurrentRoom('landing');
  }, [setCurrentRoom]);

  // Count-up
  useEffect(() => {
    const target = 1247 + (globalCount || 0);
    const step = Math.max(1, target / 120);
    const iv = setInterval(() => {
      countRef.current = Math.min(countRef.current + step, target);
      setDisplayCount(Math.floor(countRef.current));
      if (countRef.current >= target) clearInterval(iv);
    }, 16);
    return () => clearInterval(iv);
  }, [globalCount]);

  // Rotate notifications
  useEffect(() => {
    const iv = setInterval(() => setCurrentNotif(p => (p + 1) % SYSTEM_NOTIFICATIONS.length), 3500);
    return () => clearInterval(iv);
  }, []);

  // Random corruption
  useEffect(() => {
    let t: NodeJS.Timeout;
    const schedule = () => {
      t = setTimeout(() => {
        const msg = CORRUPTION_MESSAGES[Math.floor(Math.random() * CORRUPTION_MESSAGES.length)];
        setCorruptionMsg(msg);
        setTimeout(() => { setCorruptionMsg(null); schedule(); }, 2500);
      }, 10000 + Math.random() * 25000);
    };
    schedule();
    return () => clearTimeout(t);
  }, []);

  const handleEnter = useCallback(() => {
    setEntered(true);
    setTimeout(() => router.push('/lobby'), 700);
  }, [router]);

  const handleDoubleClick = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 600);
  }, []);

  return (
    <motion.main
      id="landing-page"
      onDoubleClick={handleDoubleClick}
      animate={isShaking ? { x: [-3, 3, -2, 2, -1, 0] } : {}}
      transition={{ duration: 0.5 }}
      style={{
        background: '#080808', minHeight: '100vh',
        fontFamily: 'Space Grotesk, sans-serif',
        overflow: 'hidden', position: 'relative', cursor: 'default',
      }}
    >
      <CursorGlow />

      {/* ── BG ATMOSPHERE ─────────────────────────────────────── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: '#050505' }} />
        {/* Ambient fog top-left */}
        <motion.div
          animate={{ opacity: [0.25, 0.5, 0.25], scale: [1, 1.06, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', top: '-20%', left: '-10%',
            width: '60%', height: '70%',
            background: 'radial-gradient(ellipse, rgba(139,0,0,0.12) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Ambient fog bottom-right */}
        <motion.div
          animate={{ opacity: [0.15, 0.35, 0.15], scale: [1, 1.08, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          style={{
            position: 'absolute', bottom: '-10%', right: '-5%',
            width: '50%', height: '60%',
            background: 'radial-gradient(ellipse, rgba(255,46,46,0.06) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Vignette */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.75) 100%)',
        }} />
      </div>

      {/* Particles */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 1 }}>
        <ParticleField />
      </div>

      {/* ── CORRUPTION BANNER ─────────────────────────────────── */}
      <AnimatePresence>
        {corruptionMsg && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9997,
              background: '#FF2E2E', padding: '10px 24px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.22em',
              color: '#000', textAlign: 'center',
            }}
          >
            ▓▓▓ {corruptionMsg} ▓▓▓
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NAV ───────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 48px',
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          background: 'linear-gradient(to bottom, rgba(5,5,5,0.95), transparent)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <span style={{
            fontSize: 14, fontWeight: 900, letterSpacing: '0.15em', color: '#F0F0F0',
          }}>
            AFTER<span style={{ color: '#FF2E2E' }}>HOURS</span>
          </span>
          <div style={{ display: 'flex', gap: 28 }}>
            {['MANIFESTO', 'RULES', 'ABOUT'].map(l => (
              <span key={l}
                style={{ fontSize: 10, color: '#333', letterSpacing: '0.16em', cursor: 'pointer', transition: 'color 0.3s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#888')}
                onMouseLeave={e => (e.currentTarget.style.color = '#333')}
              >{l}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <motion.div
              animate={{ opacity: isConnected ? [1, 0.3, 1] : 1 }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                width: 5, height: 5, borderRadius: '50%',
                background: isConnected ? '#1ABC9C' : '#FF2E2E',
              }}
            />
            <span style={{ fontSize: 9, color: '#333', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em' }}>
              {isConnected ? 'CONNECTED' : 'OFFLINE'}
            </span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4,
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color || '#FF2E2E' }} />
            <span style={{ fontSize: 11, color: '#666', fontFamily: 'JetBrains Mono', letterSpacing: '0.08em' }}>
              {identity || 'GHOST_00'}
            </span>
          </div>
          <button onClick={handleEnter} style={{
            padding: '8px 20px', background: 'transparent',
            border: '1px solid rgba(255,46,46,0.4)', borderRadius: 4,
            color: '#FF2E2E', fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
            cursor: 'pointer', fontFamily: 'Space Grotesk', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,46,46,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            ENTER
          </button>
        </div>
      </motion.nav>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 10,
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'flex-start',
        padding: '0 10vw',
      }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1.2 }}
        >
          {/* Status label */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}
          >
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF2E2E' }}
            />
            <span style={{
              fontSize: 10, color: '#FF2E2E', letterSpacing: '0.24em',
              fontFamily: 'JetBrains Mono', fontWeight: 700,
            }}>
              SYSTEM ONLINE — {displayCount.toLocaleString()} INSIDE
            </span>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 1 }}
          >
            <GlitchTitle />
          </motion.div>

          {/* Subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 0.8 }}
            style={{ marginTop: 28, marginBottom: 48 }}
          >
            <p style={{
              fontSize: 'clamp(16px, 2.5vw, 24px)',
              color: '#666',
              fontFamily: 'Crimson Pro, Georgia, serif',
              fontStyle: 'italic', lineHeight: 1.5, maxWidth: 500,
            }}>
              Where strangers become honest.
            </p>
            <p style={{
              fontSize: 12, color: '#2A2A2A', letterSpacing: '0.1em',
              marginTop: 12, fontFamily: 'JetBrains Mono',
            }}>
              No names. No faces. No limits. Only the night.
            </p>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2, duration: 0.8 }}
            style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}
          >
            <motion.button
              id="enter-void-btn"
              onClick={handleEnter}
              disabled={entered}
              whileHover={{ scale: 1.03, boxShadow: '0 0 50px rgba(255,46,46,0.4)' }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: '16px 44px', background: '#FF2E2E',
                border: 'none', borderRadius: 4,
                color: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: '0.2em',
                cursor: entered ? 'not-allowed' : 'pointer',
                fontFamily: 'Space Grotesk, sans-serif',
                boxShadow: '0 0 25px rgba(255,46,46,0.25)',
                opacity: entered ? 0.5 : 1,
              }}
            >
              {entered ? 'ENTERING...' : 'ENTER THE VOID'}
            </motion.button>

            <motion.button
              onClick={() => setAmbientEnabled(!ambientEnabled)}
              whileHover={{ scale: 1.02 }}
              style={{
                padding: '16px 32px',
                background: ambientEnabled ? 'rgba(255,46,46,0.08)' : 'transparent',
                border: ambientEnabled ? '1px solid rgba(255,46,46,0.3)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 4,
                color: ambientEnabled ? '#FF2E2E' : '#555',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
                cursor: 'pointer', fontFamily: 'Space Grotesk', transition: 'all 0.3s',
              }}
            >
              {ambientEnabled ? '◉ AMBIENT ON' : '○ ENABLE AMBIENT'}
            </motion.button>
          </motion.div>

          {/* Hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3.5, duration: 1.5 }}
            style={{ fontSize: 10, color: '#1A1A1A', marginTop: 28, letterSpacing: '0.1em', fontFamily: 'JetBrains Mono' }}
          >
            double-click anywhere to test the signal
          </motion.p>
        </motion.div>
      </div>

      {/* ── NOTIFICATION TICKER ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
        style={{
          position: 'fixed', bottom: 76, left: 0, right: 0, zIndex: 20,
          display: 'flex', justifyContent: 'center',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentNotif}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 20px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 4,
            }}
          >
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#FF2E2E' }} />
            <span style={{ fontSize: 10, color: '#444', fontFamily: 'JetBrains Mono', letterSpacing: '0.08em' }}>
              {SYSTEM_NOTIFICATIONS[currentNotif]}
            </span>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 48px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(5,5,5,0.92)',
        }}
      >
        <div style={{ display: 'flex', gap: 40 }}>
          {[
            { label: 'ROOMS ACTIVE', value: '47' },
            { label: 'PEOPLE INSIDE', value: `${(globalCount || 0) + 312}` },
            { label: 'CONFESSIONS TODAY', value: '2.4K' },
          ].map(s => (
            <div key={s.label}>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#F0F0F0', fontFamily: 'JetBrains Mono', lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 9, color: '#333', letterSpacing: '0.14em', marginTop: 2 }}>{s.label}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#1E1E1E', fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', letterSpacing: '0.04em' }}>
          &quot;You do not talk about AfterHours.&quot;
        </p>
      </motion.div>
    </motion.main>
  );
}
