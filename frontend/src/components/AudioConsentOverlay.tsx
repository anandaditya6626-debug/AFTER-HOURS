'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAmbientAudio } from '@/lib/AmbientAudioProvider';

export function AudioConsentOverlay() {
  const [showPrompt, setShowPrompt] = useState(false);
  const { setAmbientEnabled } = useAmbientAudio();

  useEffect(() => {
    // Check if consent has already been given or rejected
    const consent = localStorage.getItem('ah_ambient_enabled');
    if (consent === null) {
      setShowPrompt(true);
    }
  }, []);

  const handleConsent = (enabled: boolean) => {
    setAmbientEnabled(enabled);
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999, // above everything
            background: 'rgba(5, 5, 5, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: 'easeOut' }}
            style={{
              background: 'rgba(10, 10, 10, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderLeft: '3px solid #FF2E2E',
              padding: '40px 50px',
              borderRadius: '8px',
              boxShadow: '0 30px 60px rgba(0,0,0,0.8), inset 0 0 40px rgba(255,46,46,0.05)',
              textAlign: 'center',
              maxWidth: '500px',
              width: '90%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF2E2E', boxShadow: '0 0 10px rgba(255,46,46,0.5)' }}
              />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#FF2E2E', letterSpacing: '0.24em', fontWeight: 700 }}>
                SIGNAL DETECTED
              </span>
            </div>
            
            <h2 className="cinematic" style={{
              fontSize: '28px', color: '#F0F0F0', marginBottom: '16px', letterSpacing: '0.05em'
            }}>
              Ambient Mode Available
            </h2>
            <p style={{
              fontSize: '14px', color: '#888', marginBottom: '32px', fontFamily: 'var(--font-body)', lineHeight: 1.6
            }}>
              Enable immersive audio experience? This involves procedural soundscapes, low drones, and sudden high-frequency events designed for late-night viewing.
            </p>
            
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
              <motion.button
                onClick={() => handleConsent(true)}
                whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(255,46,46,0.4)' }}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: '12px 32px',
                  background: '#FF2E2E',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.2em',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  transition: 'background 0.3s'
                }}
              >
                ENABLE
              </motion.button>
              
              <motion.button
                onClick={() => handleConsent(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  padding: '12px 24px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: '#666',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = '#666';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                NOT NOW
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
