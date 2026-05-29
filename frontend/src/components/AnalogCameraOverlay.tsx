'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export const AnalogCameraOverlay = ({ enabled = true }: { enabled?: boolean }) => {
  const [time, setTime] = useState('');
  const [trackingError, setTrackingError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setTime(`${h}:${m}:${s}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [enabled]);

  // Random VHS tracking errors
  useEffect(() => {
    if (!enabled) return;
    let t: NodeJS.Timeout;
    const schedule = () => {
      t = setTimeout(() => {
        setTrackingError(true);
        setTimeout(() => { setTrackingError(false); schedule(); }, 200 + Math.random() * 300);
      }, 20000 + Math.random() * 40000);
    };
    schedule();
    return () => clearTimeout(t);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      {/* REC indicator */}
      <div style={{
        position: 'fixed', top: 18, left: 18, zIndex: 9990,
        display: 'flex', alignItems: 'center', gap: 8,
        pointerEvents: 'none',
      }}>
        <motion.div
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF2E2E' }}
        />
        <span style={{
          fontSize: 9, color: 'rgba(255,255,255,0.25)',
          fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.15em',
        }}>
          REC
        </span>
        <span style={{
          fontSize: 9, color: 'rgba(255,255,255,0.15)',
          fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em',
        }}>
          {time}
        </span>
      </div>

      {/* CCTV corner brackets */}
      {[
        { top: 10, left: 10, borderTop: '1px solid', borderLeft: '1px solid' },
        { top: 10, right: 10, borderTop: '1px solid', borderRight: '1px solid' },
        { bottom: 10, left: 10, borderBottom: '1px solid', borderLeft: '1px solid' },
        { bottom: 10, right: 10, borderBottom: '1px solid', borderRight: '1px solid' },
      ].map((pos, i) => (
        <div key={i} style={{
          position: 'fixed', ...pos, width: 30, height: 30,
          borderColor: 'rgba(255,255,255,0.06)', zIndex: 9990,
          pointerEvents: 'none',
        } as React.CSSProperties} />
      ))}

      {/* Camera ID */}
      <div style={{
        position: 'fixed', bottom: 18, left: 18, zIndex: 9990,
        pointerEvents: 'none',
      }}>
        <span style={{
          fontSize: 7, color: 'rgba(255,255,255,0.1)',
          fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.2em',
        }}>
          CAM-07 // AFTERHOURS // SECTOR-NULL
        </span>
      </div>

      {/* VHS tracking error strip */}
      {trackingError && (
        <div style={{
          position: 'fixed',
          top: `${30 + Math.random() * 40}%`,
          left: 0, right: 0,
          height: 3 + Math.random() * 8,
          background: 'rgba(255,255,255,0.08)',
          zIndex: 9991,
          pointerEvents: 'none',
          transform: `translateX(${(Math.random() - 0.5) * 10}px)`,
        }} />
      )}

      {/* Slight barrel distortion vignette */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9989,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.3) 100%)',
      }} />
    </>
  );
};
