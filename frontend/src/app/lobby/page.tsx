'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/lib/SocketProvider';
import { useIdentity } from '@/lib/IdentityProvider';
import { useAmbientAudio } from '@/lib/AmbientAudioProvider';

const ROOMS = [
  { id: 'deepTalk', label: 'DEEP TALK', tagline: 'Say what you cannot say anywhere else.', icon: '◎', color: '#FF2E2E', glow: 'rgba(255,46,46,0.12)', duration: '12 MIN', max: 2, group: '1 — 2', ambience: 'Rain + Dark Synth' },
  { id: 'confessions', label: 'CONFESSIONS', tagline: 'Your secret dies here with the session.', icon: '◉', color: '#FF6B35', glow: 'rgba(255,107,53,0.12)', duration: '8 MIN', max: 2, group: '1 — 2', ambience: 'VHS Static + Hum' },
  { id: 'chill', label: 'CHILL', tagline: 'Just exist together in the dark.', icon: '○', color: '#4ECDC4', glow: 'rgba(78,205,196,0.10)', duration: '15 MIN', max: 6, group: '2 — 6', ambience: 'City Rain + Lo-fi' },
  { id: 'voiceRoom', label: 'VOICE ROOM', tagline: 'Say something real. Hear something honest.', icon: '◈', color: '#FFE66D', glow: 'rgba(255,230,109,0.10)', duration: '10 MIN', max: 4, group: '2 — 4', ambience: 'Bass + Industrial' },
];

const NAV_ITEMS = [
  { id: 'void', label: 'VOID', icon: '▪', color: '#555' },
  { id: 'confessions', label: 'CONFESSIONS', icon: '◉', color: '#FF6B35' },
  { id: 'deepTalk', label: 'DEEP TALK', icon: '◎', color: '#FF2E2E' },
  { id: 'chill', label: 'CHILL', icon: '○', color: '#4ECDC4' },
  { id: 'voiceRoom', label: 'VOICE ROOM', icon: '◈', color: '#FFE66D' },
  { id: 'project', label: 'PROJECT', icon: '◫', color: '#9B59B6' },
  { id: 'hidden', label: 'HIDDEN', icon: '█', color: '#1A1A1A' },
];

const MOODS = [
  { id: 'calm', label: 'Calm', icon: '~' },
  { id: 'deep', label: 'Deep', icon: '◆' },
  { id: 'lonely', label: 'Lonely', icon: '○' },
  { id: 'curious', label: 'Curious', icon: '?' },
  { id: 'raw', label: 'Raw', icon: '▲' },
];

const INTENTS = [
  { id: 'talk', label: 'Talk' },
  { id: 'vent', label: 'Vent' },
  { id: 'listen', label: 'Listen' },
  { id: 'explore', label: 'Explore' },
];

const LIVE_NOTIFS = [
  'Ghost_77 entered VOID.', 'New confession posted.', 'Someone is reading your thoughts.',
  'Echo_33 has been watching.', 'Phantom_12 left the room.', 'Identity mismatch detected.',
  'Signal interrupted briefly.', 'Midnight session approaching.',
];

const MENTAL_STATES = ['Detached', 'Awake', 'Watching', 'Dissolving', 'Unstable'];

function LiveNotification() {
  const [notif, setNotif] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let t: NodeJS.Timeout;
    const trigger = () => {
      const msg = LIVE_NOTIFS[Math.floor(Math.random() * LIVE_NOTIFS.length)];
      setNotif(msg); setShow(true);
      setTimeout(() => setShow(false), 3000);
      t = setTimeout(trigger, 5000 + Math.random() * 10000);
    };
    t = setTimeout(trigger, 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {show && notif && (
        <motion.div
          initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 200,
            padding: '12px 18px', background: 'rgba(8,8,8,0.96)',
            border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid #FF2E2E',
            borderRadius: 4, maxWidth: 280,
          }}
        >
          <p style={{ fontSize: 9, color: '#FF2E2E', letterSpacing: '0.16em', marginBottom: 3, fontFamily: 'JetBrains Mono' }}>SYSTEM</p>
          <p style={{ fontSize: 11, color: '#888', fontFamily: 'JetBrains Mono' }}>{notif}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function LobbyPage() {
  const router = useRouter();
  const { socket, isConnected, globalCount } = useSocket();
  const { identity, color, peerId, missions, titles } = useIdentity();
  const { setCurrentRoom } = useAmbientAudio();

  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState('deepTalk');
  const [selectedMood, setSelectedMood] = useState('calm');
  const [selectedIntent, setSelectedIntent] = useState('talk');
  const [matchmaking, setMatchmaking] = useState(false);
  const [mentalState, setMentalState] = useState('Watching');
  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    setCurrentRoom('lobby');
    setMentalState(MENTAL_STATES[Math.floor(Math.random() * MENTAL_STATES.length)]);
  }, [setCurrentRoom]);

  // Countdown to midnight
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const mid = new Date(); mid.setHours(24, 0, 0, 0);
      const diff = mid.getTime() - now.getTime();
      setCountdown({ h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) });
    };
    tick(); const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleRoomJoined = (data: { roomId: string }) => {
      sessionStorage.setItem('afterhours_room', JSON.stringify(data));
      router.push(`/room/${data.roomId}`);
    };
    const handleError = () => setMatchmaking(false);
    socket.on('room-joined', handleRoomJoined);
    socket.on('error', handleError);
    return () => { socket.off('room-joined', handleRoomJoined); socket.off('error', handleError); };
  }, [socket, router]);

  const handleEnterRoom = () => {
    if (!selectedRoom || !socket || !isConnected) return;
    setMatchmaking(true);
    socket.emit('find-room', { roomType: selectedRoom, mood: selectedMood, intent: selectedIntent, identity, color, peerId });
  };

  const currentTitle = titles?.length > 0 ? titles[titles.length - 1] : 'Newcomer';
  const pad = (n: number) => String(n).padStart(2, '0');
  const selectedRoomData = ROOMS.find(r => r.id === selectedRoom);

  return (
    <div style={{
      background: '#080808', minHeight: '100vh',
      display: 'grid', gridTemplateColumns: '200px 1fr 300px',
      fontFamily: 'Space Grotesk, sans-serif', color: '#F0F0F0',
      position: 'relative', overflow: 'hidden',
    }}>
      <LiveNotification />

      {/* ── MATCHMAKING OVERLAY ────────────────────────────────── */}
      <AnimatePresence>
        {matchmaking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(5,5,5,0.97)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32,
            }}
          >
            <motion.div
              className="audio-glow"
              animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 120, height: 120, borderRadius: '50%', border: '1px solid rgba(255,46,46,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <motion.div
                className="audio-glow"
                animate={{ scale: [1, 1.6, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                style={{ width: 50, height: 50, borderRadius: '50%', border: '1px solid rgba(255,46,46,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF2E2E' }} />
              </motion.div>
            </motion.div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 10, color: '#FF2E2E', letterSpacing: '0.24em', fontFamily: 'JetBrains Mono', marginBottom: 8 }}>SCANNING THE VOID</p>
              <p style={{ fontSize: 18, color: '#444', fontFamily: 'Crimson Pro, serif', fontStyle: 'italic' }}>Searching for a stranger...</p>
              <p style={{ fontSize: 11, color: '#222', marginTop: 8 }}>Someone out there is waiting for you</p>
            </div>
            <button onClick={() => setMatchmaking(false)} style={{
              padding: '8px 24px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 4, color: '#333', fontSize: 10, letterSpacing: '0.14em', cursor: 'pointer', fontFamily: 'Space Grotesk',
            }}>ABORT SIGNAL</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LEFT SIDEBAR ──────────────────────────────────────── */}
      <div style={{ borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', background: 'rgba(5,5,5,0.6)' }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.12em' }}>
            AFTER<span style={{ color: '#FF2E2E' }}>HOURS</span>
          </span>
        </div>

        {/* Nav */}
        <nav style={{ padding: '16px 0', flex: 1 }}>
          {NAV_ITEMS.map(item => (
            <motion.button key={item.id} id={`nav-${item.id}`}
              onClick={() => { setActiveNav(item.id); const r = ROOMS.find(r => r.id === item.id); if (r) setSelectedRoom(item.id); }}
              whileHover={{ x: 4 }}
              style={{
                width: '100%', padding: '11px 20px', display: 'flex', alignItems: 'center', gap: 12,
                background: activeNav === item.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                border: 'none', borderLeft: activeNav === item.id ? `2px solid ${item.color}` : '2px solid transparent',
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 10, color: activeNav === item.id ? item.color : '#333', width: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 9, letterSpacing: '0.16em', color: activeNav === item.id ? '#888' : '#333', fontFamily: 'JetBrains Mono' }}>{item.label}</span>
            </motion.button>
          ))}
        </nav>

        {/* Identity mini */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: color || '#FF2E2E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
              {(identity || 'G')[0]}
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#888', lineHeight: 1 }}>{identity || 'GHOST_00'}</p>
              <p style={{ fontSize: 8, color: '#FF2E2E', letterSpacing: '0.1em', marginTop: 2 }}>{mentalState.toUpperCase()}</p>
            </div>
          </div>
          <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 1 }}>
            <motion.div animate={{ width: ['30%', '70%', '45%'] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ height: '100%', background: '#FF2E2E', borderRadius: 1 }} />
          </div>
          <p style={{ fontSize: 8, color: '#1E1E1E', marginTop: 4, fontFamily: 'JetBrains Mono' }}>ACTIVITY SIGNAL</p>
        </div>
      </div>

      {/* ── CENTER ────────────────────────────────────────────── */}
      <div style={{ overflowY: 'auto', padding: '32px 40px' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF2E2E' }} />
            <h1 style={{ fontSize: 11, letterSpacing: '0.2em', color: '#333', fontFamily: 'JetBrains Mono' }}>LOBBY — SELECT YOUR ROOM</h1>
          </div>
          <p style={{ fontSize: 13, color: '#222', fontFamily: 'Crimson Pro, serif', fontStyle: 'italic' }}>Every room is a different reality.</p>
        </div>

        {/* Room Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 40 }}>
          {ROOMS.map(room => (
            <motion.div key={room.id} id={`room-card-${room.id}`}
              onClick={() => !matchmaking && setSelectedRoom(room.id)}
              whileHover={{ y: -4 }}
              style={{
                cursor: 'pointer', borderRadius: 8, overflow: 'hidden', transition: 'all 0.25s', position: 'relative',
                border: selectedRoom === room.id ? `1px solid ${room.color}` : '1px solid rgba(255,255,255,0.06)',
                background: selectedRoom === room.id ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)',
              }}
            >
              {/* Glow */}
              {selectedRoom === room.id && (
                <motion.div className="audio-glow" animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 2.5, repeat: Infinity }}
                  style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at top, ${room.glow} 0%, transparent 70%)`, pointerEvents: 'none' }} />
              )}
              {/* Top */}
              <div style={{ height: 90, padding: '20px 24px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 32, color: room.color, opacity: 0.7 }}>{room.icon}</span>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 9, color: '#333', letterSpacing: '0.12em', fontFamily: 'JetBrains Mono' }}>{room.duration}</p>
                  <p style={{ fontSize: 8, color: '#222', marginTop: 2, fontFamily: 'JetBrains Mono' }}>{room.group} PEOPLE</p>
                </div>
              </div>
              {/* Info */}
              <div style={{ padding: '16px 24px 20px' }}>
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', marginBottom: 6, color: '#F0F0F0' }}>{room.label}</p>
                <p style={{ fontSize: 12, color: '#555', fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', marginBottom: 10, lineHeight: 1.4 }}>{room.tagline}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1ABC9C' }} />
                    <span style={{ fontSize: 9, color: '#333', fontFamily: 'JetBrains Mono' }}>LIVE</span>
                  </div>
                  <span style={{ fontSize: 9, color: '#2A2A2A', fontFamily: 'JetBrains Mono' }}>{room.ambience}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Midnight Event */}
        <div style={{ padding: '24px 28px', background: 'rgba(255,46,46,0.03)', border: '1px solid rgba(255,46,46,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 9, color: '#FF2E2E', letterSpacing: '0.2em', fontFamily: 'JetBrains Mono', marginBottom: 6 }}>MIDNIGHT SESSION STARTS IN</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#666', marginBottom: 4 }}>MIDNIGHT CONFESSIONS</p>
            <p style={{ fontSize: 11, color: '#2A2A2A', fontFamily: 'Crimson Pro, serif', fontStyle: 'italic' }}>Hidden rooms unlock. Colors darken. Secrets surface.</p>
          </div>
          <div style={{ display: 'flex', gap: 16, fontFamily: 'JetBrains Mono' }}>
            {[{ v: pad(countdown.h), l: 'HRS' }, { v: pad(countdown.m), l: 'MIN' }, { v: pad(countdown.s), l: 'SEC' }].map(({ v, l }) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 28, fontWeight: 800, color: '#FF2E2E', lineHeight: 1 }}>{v}</p>
                <p style={{ fontSize: 8, color: '#333', letterSpacing: '0.12em', marginTop: 3 }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ───────────────────────────────────────── */}
      <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', overflowY: 'auto', background: 'rgba(5,5,5,0.4)' }}>
        {/* Identity */}
        <div style={{ padding: '32px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: 9, color: '#333', letterSpacing: '0.2em', fontFamily: 'JetBrains Mono', marginBottom: 20 }}>YOUR IDENTITY</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <motion.div
              animate={{ boxShadow: [`0 0 0px ${color}`, `0 0 16px ${color}66`, `0 0 0px ${color}`] }}
              transition={{ duration: 3, repeat: Infinity }}
              style={{ width: 48, height: 48, borderRadius: '50%', background: color || '#FF2E2E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, flexShrink: 0 }}
            >
              {(identity || 'G')[0]}
            </motion.div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.04em', color: '#F0F0F0' }}>{identity || 'GHOST_00'}</p>
              <p style={{ fontSize: 9, color: '#FF2E2E', letterSpacing: '0.12em', marginTop: 3 }}>RANK: {(currentTitle || 'Newcomer').toUpperCase()}</p>
            </div>
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6, marginBottom: 16 }}>
            <p style={{ fontSize: 9, color: '#333', letterSpacing: '0.16em', fontFamily: 'JetBrains Mono', marginBottom: 4 }}>MENTAL STATE</p>
            <p style={{ fontSize: 13, color: '#888', fontFamily: 'Crimson Pro, serif', fontStyle: 'italic' }}>{mentalState}</p>
          </div>
          <p style={{ fontSize: 11, color: '#2A2A2A', lineHeight: 1.7, fontFamily: 'Crimson Pro, serif', fontStyle: 'italic' }}>
            You are the watcher. You listen. You observe. You understand the chaos.
          </p>
        </div>

        {/* Mood + Intent */}
        <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: 9, color: '#333', letterSpacing: '0.2em', fontFamily: 'JetBrains Mono', marginBottom: 14 }}>CURRENT MOOD</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {MOODS.map(m => (
              <button key={m.id} id={`mood-${m.id}`} onClick={() => setSelectedMood(m.id)}
                style={{
                  padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 10,
                  background: selectedMood === m.id ? 'rgba(255,46,46,0.12)' : 'transparent',
                  border: selectedMood === m.id ? '1px solid rgba(255,46,46,0.35)' : '1px solid rgba(255,255,255,0.06)',
                  color: selectedMood === m.id ? '#FF2E2E' : '#444', fontFamily: 'Space Grotesk', transition: 'all 0.15s',
                }}
              >{m.icon} {m.label}</button>
            ))}
          </div>
          <p style={{ fontSize: 9, color: '#333', letterSpacing: '0.2em', fontFamily: 'JetBrains Mono', marginBottom: 12 }}>I WANT TO...</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {INTENTS.map(i => (
              <button key={i.id} id={`intent-${i.id}`} onClick={() => setSelectedIntent(i.id)}
                style={{
                  padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 10,
                  background: selectedIntent === i.id ? 'rgba(255,46,46,0.12)' : 'transparent',
                  border: selectedIntent === i.id ? '1px solid rgba(255,46,46,0.35)' : '1px solid rgba(255,255,255,0.06)',
                  color: selectedIntent === i.id ? '#FF2E2E' : '#444', fontFamily: 'Space Grotesk', transition: 'all 0.15s',
                }}
              >{i.label}</button>
            ))}
          </div>
        </div>

        {/* Enter CTA */}
        <div style={{ padding: '24px' }}>
          {selectedRoom && selectedRoomData ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div style={{ padding: '16px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', border: `1px solid ${selectedRoomData.color}33`, marginBottom: 16 }}>
                <p style={{ fontSize: 9, color: '#333', letterSpacing: '0.16em', fontFamily: 'JetBrains Mono', marginBottom: 6 }}>ENTERING</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: selectedRoomData.color }}>{selectedRoomData.label}</p>
                <p style={{ fontSize: 11, color: '#444', marginTop: 4, fontFamily: 'Crimson Pro, serif', fontStyle: 'italic' }}>{selectedRoomData.tagline}</p>
              </div>
              <motion.button id="find-room-btn" onClick={handleEnterRoom} disabled={!isConnected}
                whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(255,46,46,0.3)' }} whileTap={{ scale: 0.98 }}
                style={{
                  width: '100%', padding: '14px', background: isConnected ? '#FF2E2E' : '#1A1A1A',
                  border: 'none', borderRadius: 6, color: isConnected ? '#fff' : '#333',
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.2em', cursor: isConnected ? 'pointer' : 'not-allowed', fontFamily: 'Space Grotesk',
                }}
              >{isConnected ? 'FIND MY STRANGER' : 'CONNECTING...'}</motion.button>
            </motion.div>
          ) : (
            <div style={{ padding: '20px', borderRadius: 6, border: '1px dashed rgba(255,255,255,0.06)', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#222', fontFamily: 'Crimson Pro, serif', fontStyle: 'italic' }}>Select a room to enter the void.</p>
            </div>
          )}
          <motion.p animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 4, repeat: Infinity }}
            style={{ fontSize: 9, color: '#1E1E1E', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em', textAlign: 'center', marginTop: 20 }}
          >{(globalCount || 0) + 1247} SOULS INSIDE</motion.p>
        </div>

        {/* Missions */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p style={{ fontSize: 9, color: '#333', letterSpacing: '0.2em', fontFamily: 'JetBrains Mono', marginBottom: 12 }}>MISSIONS</p>
          {[
            { label: 'Join 3 rooms', progress: missions?.find((m: { id: string }) => m.id === 'join-3')?.progress || 0, goal: 3 },
            { label: 'Stay for a full session', progress: missions?.find((m: { id: string }) => m.id === 'stay-full')?.progress || 0, goal: 1 },
          ].map(mission => (
            <div key={mission.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <p style={{ fontSize: 10, color: '#444' }}>{mission.label}</p>
                <p style={{ fontSize: 9, color: '#333', fontFamily: 'JetBrains Mono' }}>{mission.progress}/{mission.goal}</p>
              </div>
              <div style={{ height: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 1 }}>
                <div style={{ height: '100%', width: `${(mission.progress / mission.goal) * 100}%`, background: '#FF2E2E', borderRadius: 1, transition: 'width 0.5s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
