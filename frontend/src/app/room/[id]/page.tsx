'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useParams } from 'next/navigation';
import { useSocket } from '@/lib/SocketProvider';
import { useIdentity } from '@/lib/IdentityProvider';
import { useAmbientAudio } from '@/lib/AmbientAudioProvider';

interface Message { id: string; socketId: string; identity: string; color: string; text: string; timestamp: number; isSystem?: boolean; type?: string; }
interface RoomUser { socketId: string; identity: string; color: string; peerId: string; }
interface RoomData { roomId: string; roomType: string; users: RoomUser[]; prompts: string[]; endsAt: number; duration: number; }

const ROOM_LABELS: Record<string, string> = { deepTalk: 'DEEP TALK', confessions: 'CONFESSIONS', chill: 'CHILL', voiceRoom: 'VOICE ROOM' };
const ROOM_RULES = ['Be real.', 'No names.', 'No judging.', 'Stay until the timer ends.'];

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;
  const { socket } = useSocket();
  const { identity, color, peerId, completeSession } = useIdentity();
  const { setCurrentRoom } = useAmbientAudio();

  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, { stream: MediaStream; identity: string; color: string }>>({});
  const [sessionEnded, setSessionEnded] = useState(false);
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<string>('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomUsersRef = useRef<RoomUser[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourcesRef = useRef<Record<string, MediaStreamAudioSourceNode>>({});
  const socketRef = useRef(socket);
  const identityRef = useRef(identity);
  const peersRef = useRef<Record<string, { stream: MediaStream; identity: string; color: string }>>({});

  // Keep refs in sync
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { roomUsersRef.current = roomUsers; }, [roomUsers]);
  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { identityRef.current = identity; }, [identity]);
  useEffect(() => { peersRef.current = peers; }, [peers]);

  // ── Ensure AudioContext is ready (must be called from user gesture) ──────
  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      console.log('[Audio] AudioContext created');
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().then(() => {
        console.log('[Audio] AudioContext resumed');
      });
    }
    return audioContextRef.current;
  }, []);

  // ── Play remote audio stream via Web Audio API ───────────────────────────
  const playRemoteAudio = useCallback((peerId: string, stream: MediaStream) => {
    const ctx = audioContextRef.current;
    if (!ctx) {
      console.warn('[Audio] No AudioContext — cannot play remote audio');
      return;
    }

    // Cleanup old source for this peer
    if (audioSourcesRef.current[peerId]) {
      try { audioSourcesRef.current[peerId].disconnect(); } catch { /* */ }
    }

    try {
      const source = ctx.createMediaStreamSource(stream);
      source.connect(ctx.destination);
      audioSourcesRef.current[peerId] = source;
      console.log(`[Audio] ✅ Playing audio from peer ${peerId} via AudioContext`);
    } catch (err) {
      console.error(`[Audio] Failed to play remote audio from ${peerId}:`, err);
    }
  }, []);

  // ── Auto-initialize AudioContext on any user gesture ────────────────────
  useEffect(() => {
    const handleGesture = () => {
      if (!audioContextRef.current || audioContextRef.current.state === 'suspended') {
        console.log('[Audio] User gesture detected — initializing/resuming AudioContext');
        const ctx = ensureAudioContext();
        ctx.resume().then(() => {
          // Play any audio streams that we have but haven't started playing yet
          Object.entries(peersRef.current).forEach(([sid, peer]) => {
            const hasAudio = peer.stream.getAudioTracks().length > 0;
            if (hasAudio && !audioSourcesRef.current[sid]) {
              console.log(`[Audio] Gesture triggered play for peer ${peer.identity} (${sid})`);
              playRemoteAudio(sid, peer.stream);
            }
          });
        });
      }
    };
    window.addEventListener('click', handleGesture);
    window.addEventListener('keydown', handleGesture);
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, [ensureAudioContext, playRemoteAudio]);

  // Use randomUUID for guaranteed unique IDs
  const addMsg = useCallback((text: string, type: string) => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      socketId: 'system', identity: 'system', color: '#555',
      text, timestamp: Date.now(), isSystem: true, type,
    }]);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Load from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('afterhours_room');
    if (stored) {
      try {
        const data: RoomData = JSON.parse(stored);
        if (data.roomId === roomId) {
          setRoomData(data); setRoomUsers(data.users);
          if (data.prompts?.length) setCurrentPrompt(data.prompts[0]);
          setCurrentRoom(data.roomType);
          sessionStorage.removeItem('afterhours_room');
        }
      } catch { /**/ }
    }
  }, [roomId, setCurrentRoom]);

  // Redirect guard
  useEffect(() => { const t = setTimeout(() => setLoadingTimeout(true), 10000); return () => clearTimeout(t); }, []);
  useEffect(() => { if (loadingTimeout && !roomData) router.push('/lobby'); }, [loadingTimeout, roomData, router]);

  // Timer
  useEffect(() => {
    if (!roomData) return;
    const tick = () => { const r = Math.max(0, roomData.endsAt - Date.now()); setTimeLeft(r); if (r === 0) clearInterval(timerRef.current!); };
    tick(); timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current!);
  }, [roomData]);

  // Prompt rotation
  useEffect(() => {
    if (!roomData?.prompts?.length) return;
    setCurrentPrompt(roomData.prompts[0]);
    const iv = setInterval(() => { setCurrentPrompt(p => { const i = roomData.prompts.indexOf(p); return roomData.prompts[(i + 1) % roomData.prompts.length]; }); }, 60000);
    return () => clearInterval(iv);
  }, [roomData]);

  // ── Create or get a peer connection ──────────────────────────────────────
  const getOrCreatePC = useCallback((targetSocketId: string, targetIdentity: string, targetColor: string): RTCPeerConnection => {
    // Reuse existing connection if it's still alive
    const existing = peerConnectionsRef.current[targetSocketId];
    if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
      return existing;
    }

    // Close dead connection if any
    if (existing) {
      try { existing.close(); } catch { /* */ }
    }

    console.log(`[WebRTC] Creating new PeerConnection for ${targetIdentity} (${targetSocketId})`);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionsRef.current[targetSocketId] = pc;

    // Handle incoming remote tracks
    pc.ontrack = (e) => {
      const [remoteStream] = e.streams;
      console.log(`[WebRTC] 🎵 ontrack from ${targetIdentity}: kind=${e.track.kind}, readyState=${e.track.readyState}`);

      if (e.track.kind === 'audio') {
        console.log(`[WebRTC] 🔊 Received AUDIO track from ${targetIdentity}`);
        setVoiceStatus(`Connected to ${targetIdentity}`);
        playRemoteAudio(targetSocketId, remoteStream);
      }

      // Update peers state for video display
      setPeers(prev => ({
        ...prev,
        [targetSocketId]: { stream: remoteStream, identity: targetIdentity, color: targetColor },
      }));
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current?.emit('peer-signal', {
          to: targetSocketId,
          signal: { type: 'ice-candidate', candidate: e.candidate },
          from: socketRef.current.id,
          identity: identityRef.current,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state for ${targetIdentity}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'connected') {
        setVoiceStatus(`Voice connected with ${targetIdentity}`);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state for ${targetIdentity}: ${pc.connectionState}`);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setPeers(prev => { const u = { ...prev }; delete u[targetSocketId]; return u; });
        setVoiceStatus('');
        // Cleanup audio source
        if (audioSourcesRef.current[targetSocketId]) {
          try { audioSourcesRef.current[targetSocketId].disconnect(); } catch { /* */ }
          delete audioSourcesRef.current[targetSocketId];
        }
      }
    };

    return pc;
  }, [playRemoteAudio]);

  // ── Send an offer to a specific peer ─────────────────────────────────────
  const sendOfferTo = useCallback(async (targetSocketId: string, targetIdentity: string, targetColor: string) => {
    const s = socketRef.current;
    if (!s) return;

    const pc = getOrCreatePC(targetSocketId, targetIdentity, targetColor);

    // Add local tracks if we have any before creating the offer
    const stream = localStreamRef.current;
    if (stream) {
      const senders = pc.getSenders();
      stream.getTracks().forEach(t => {
        const alreadyAdded = senders.some(sender => sender.track === t);
        if (!alreadyAdded) {
          console.log(`[WebRTC] Offerer adding local ${t.kind} track to PC for ${targetIdentity}`);
          pc.addTrack(t, stream);
        }
      });
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log(`[WebRTC] 📤 Sending offer to ${targetIdentity} (${targetSocketId})`);
      s.emit('peer-signal', {
        to: targetSocketId,
        signal: { type: 'offer', sdp: offer.sdp },
        from: s.id,
        identity: identityRef.current,
      });
    } catch (err) {
      console.error(`[WebRTC] Failed to create/send offer to ${targetIdentity}:`, err);
    }
  }, [getOrCreatePC]);

  // ── Connect to all peers in the room ─────────────────────────────────────
  const connectToAllPeers = useCallback(async () => {
    const currentUsers = roomUsersRef.current;
    const s = socketRef.current;
    if (!s) return;

    console.log(`[WebRTC] Connecting to ${currentUsers.length - 1} other peers in room`);

    for (const user of currentUsers) {
      if (user.socketId === s.id) continue;
      await sendOfferTo(user.socketId, user.identity, user.color);
    }
  }, [sendOfferTo]);

  // ── Add new tracks to existing connections and renegotiate ────────────────
  const renegotiateAllPeers = useCallback(async (stream: MediaStream) => {
    const s = socketRef.current;
    if (!s) return;

    for (const [sid, pc] of Object.entries(peerConnectionsRef.current)) {
      if (pc.connectionState === 'closed') continue;

      const senders = pc.getSenders();
      for (const track of stream.getTracks()) {
        const existingSender = senders.find(sender => sender.track?.kind === track.kind);
        if (existingSender) {
          console.log(`[WebRTC] Replacing ${track.kind} track for ${sid}`);
          await existingSender.replaceTrack(track);
        } else {
          console.log(`[WebRTC] Adding new ${track.kind} track for ${sid}`);
          pc.addTrack(track, stream);
        }
      }

      // Renegotiate
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        s.emit('peer-signal', {
          to: sid,
          signal: { type: 'offer', sdp: offer.sdp },
          from: s.id,
          identity: identityRef.current,
        });
        console.log(`[WebRTC] 📤 Sent renegotiation offer to ${sid}`);
      } catch (err) {
        console.error(`[WebRTC] Renegotiation failed for ${sid}:`, err);
      }
    }
  }, []);

  // ── Socket events ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    if (!roomData) socket.emit('get-room', { roomId });

    socket.on('room-joined', (data: RoomData) => {
      setRoomData(data); setRoomUsers(data.users);
      if (data.prompts?.length) setCurrentPrompt(data.prompts[0]);
      setCurrentRoom(data.roomType);
    });

    socket.on('user-joined', (data: { socketId: string; identity: string; color: string; peerId: string; users: RoomUser[] }) => {
      setRoomUsers(data.users);
      addMsg(`${data.identity} has entered the room.`, 'join');

      // If we have a local stream, send offer to the new user after a short delay
      if (localStreamRef.current && data.socketId !== socket.id) {
        setTimeout(() => {
          console.log(`[WebRTC] New user ${data.identity} joined — sending offer`);
          sendOfferTo(data.socketId, data.identity, data.color);
        }, 1000);
      }
    });

    socket.on('user-left', (data: { socketId: string; identity: string; users: RoomUser[] }) => {
      setRoomUsers(data.users);
      addMsg(`${data.identity} has left.`, 'leave');
      setPeers(prev => { const u = { ...prev }; delete u[data.socketId]; return u; });
      // Cleanup peer connection
      if (peerConnectionsRef.current[data.socketId]) {
        peerConnectionsRef.current[data.socketId].close();
        delete peerConnectionsRef.current[data.socketId];
      }
      // Cleanup audio source
      if (audioSourcesRef.current[data.socketId]) {
        try { audioSourcesRef.current[data.socketId].disconnect(); } catch { /* */ }
        delete audioSourcesRef.current[data.socketId];
      }
      setVoiceStatus('');
    });

    socket.on('chat-message', (msg: Message) => setMessages(prev => [...prev, msg]));
    socket.on('system-message', (data: { text: string; type: string }) => addMsg(data.text, data.type));
    socket.on('typing-start', ({ socketId, identity: t }: { socketId: string; identity: string }) => {
      if (socketId !== socket.id) setTypingUsers(prev => ({ ...prev, [socketId]: t }));
    });
    socket.on('typing-stop', ({ socketId }: { socketId: string }) => setTypingUsers(prev => { const u = { ...prev }; delete u[socketId]; return u; }));
    socket.on('new-prompt', ({ prompt }: { prompt: string }) => setCurrentPrompt(prompt));
    socket.on('session-end', () => { completeSession(); setSessionEnded(true); setTimeout(() => router.push('/end'), 2000); });

    // ── WebRTC signaling handler ───────────────────────────────────────────
    socket.on('peer-signal', async ({ from, signal, identity: ri }: {
      from: string;
      signal: { type: string; sdp?: string; candidate?: RTCIceCandidateInit };
      identity: string;
    }) => {
      const ru = roomUsersRef.current.find(u => u.socketId === from);
      const peerColor = ru?.color || '#FF2E2E';

      if (signal.type === 'offer') {
        console.log(`[WebRTC] 📥 Received offer from ${ri} (${from})`);

        // Handle offer glare: if we both sent offers simultaneously,
        // the peer with the "higher" socket ID wins (becomes the offerer)
        const existingPC = peerConnectionsRef.current[from];
        if (existingPC && existingPC.signalingState === 'have-local-offer') {
          // Glare! Both sides sent offers. Lower ID yields.
          if (socket.id! > from) {
            console.log(`[WebRTC] ⚡ Offer glare with ${ri} — we win, ignoring their offer`);
            return; // We keep our offer, they'll accept it
          }
          console.log(`[WebRTC] ⚡ Offer glare with ${ri} — we yield, accepting their offer`);
          // Close our connection and accept theirs
          existingPC.close();
          delete peerConnectionsRef.current[from];
        }

        // Get or create PC (reuses if possible)
        const pc = getOrCreatePC(from, ri, peerColor);

        try {
          // 1. Set remote description FIRST to configure transceivers in the correct order
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));

          // 2. Add local tracks AFTER setting remote description to avoid m-line mismatch
          const stream = localStreamRef.current;
          if (stream) {
            const senders = pc.getSenders();
            stream.getTracks().forEach(t => {
              const alreadyAdded = senders.some(sender => sender.track === t);
              if (!alreadyAdded) {
                console.log(`[WebRTC] Answerer adding local ${t.kind} track to PC for ${ri}`);
                pc.addTrack(t, stream);
              }
            });
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('peer-signal', {
            to: from,
            signal: { type: 'answer', sdp: answer.sdp },
            from: socket.id,
            identity,
          });
          console.log(`[WebRTC] 📤 Sent answer to ${ri}`);
        } catch (err) {
          console.error(`[WebRTC] Failed to handle offer from ${ri}:`, err);
        }

      } else if (signal.type === 'answer') {
        console.log(`[WebRTC] 📥 Received answer from ${ri}`);
        const pc = peerConnectionsRef.current[from];
        if (pc && pc.signalingState === 'have-local-offer') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
            console.log(`[WebRTC] ✅ Answer applied from ${ri}`);
          } catch (err) {
            console.error(`[WebRTC] Failed to set answer from ${ri}:`, err);
          }
        } else {
          console.warn(`[WebRTC] Ignoring answer from ${ri} — PC state: ${pc?.signalingState}`);
        }

      } else if (signal.type === 'ice-candidate' && signal.candidate) {
        const pc = peerConnectionsRef.current[from];
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch { /* ICE candidate errors are usually harmless */ }
        }
      }
    });

    return () => {
      ['room-joined','user-joined','user-left','chat-message','system-message',
       'typing-start','typing-stop','new-prompt','session-end','peer-signal',
      ].forEach(e => socket.off(e));
    };
  }, [socket, router, completeSession, getOrCreatePC, sendOfferTo, identity, roomId, addMsg]);

  // ── Chat handlers ────────────────────────────────────────────────────────
  const sendMessage = () => {
    if (!inputText.trim() || !socket || !roomId) return;
    socket.emit('chat-message', { roomId, text: inputText.trim(), identity, color });
    socket.emit('typing-stop', { roomId }); setInputText('');
  };
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value); if (!socket) return;
    socket.emit('typing-start', { roomId, identity });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => socket.emit('typing-stop', { roomId }), 1500);
  };
  const handleLeave = () => {
    socket?.emit('leave-room', { roomId });
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    Object.values(audioSourcesRef.current).forEach(s => { try { s.disconnect(); } catch { /* */ } });
    audioSourcesRef.current = {};
    localStream?.getTracks().forEach(t => t.stop());
    router.push('/lobby');
  };

  const showMediaError = (msg: string) => {
    setMediaError(msg);
    setTimeout(() => setMediaError(null), 5000);
  };

  // ── Microphone toggle ───────────────────────────────────────────────────
  const toggleMic = async () => {
    // Always ensure AudioContext is ready (user gesture)
    ensureAudioContext();

    if (isMicOn) {
      // TURN OFF — stop audio tracks
      console.log('[Media] Turning mic OFF');
      localStream?.getAudioTracks().forEach(t => {
        t.stop();
        // Remove from all peer connections
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track === t);
          if (sender) {
            try { pc.removeTrack(sender); } catch { /* */ }
          }
        });
      });
      setIsMicOn(false);
      setVoiceStatus('');
    } else {
      // TURN ON — acquire mic and connect to peers
      try {
        console.log('[Media] Requesting microphone...');
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[Media] ✅ Microphone acquired, tracks:', audioStream.getAudioTracks().length);

        // Merge with existing video stream if any
        const currentStream = localStreamRef.current;
        let combinedStream: MediaStream;

        if (currentStream && currentStream.getVideoTracks().length > 0) {
          combinedStream = new MediaStream([
            ...currentStream.getVideoTracks(),
            ...audioStream.getAudioTracks(),
          ]);
        } else {
          combinedStream = audioStream;
        }

        // Update state and ref immediately
        localStreamRef.current = combinedStream;
        setLocalStream(combinedStream);
        setIsMicOn(true);
        setVoiceStatus('Mic on — connecting...');

        // Connect to peers
        const existingPeerCount = Object.keys(peerConnectionsRef.current).filter(
          sid => peerConnectionsRef.current[sid].connectionState !== 'closed'
        ).length;

        if (existingPeerCount > 0) {
          console.log(`[WebRTC] Renegotiating with ${existingPeerCount} existing peers`);
          await renegotiateAllPeers(combinedStream);
        } else {
          console.log('[WebRTC] No existing peers — initiating connections');
          await connectToAllPeers();
        }
      } catch (err: unknown) {
        const e = err as Error;
        console.error('[Media] Mic error:', e);
        if (e.name === 'NotAllowedError') showMediaError('Microphone permission denied. Click the 🔒 icon in your address bar to allow it.');
        else if (e.name === 'NotFoundError') showMediaError('No microphone found on this device.');
        else showMediaError('Could not access microphone: ' + e.message);
      }
    }
  };

  // ── Camera toggle ────────────────────────────────────────────────────────
  const toggleCam = async () => {
    ensureAudioContext();

    if (isCamOn) {
      localStream?.getVideoTracks().forEach(t => {
        t.stop();
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track === t);
          if (sender) { try { pc.removeTrack(sender); } catch { /* */ } }
        });
      });
      setLocalStream(prev => {
        if (!prev) return null;
        const audioTracks = prev.getAudioTracks();
        if (audioTracks.length > 0) {
          const audioOnly = new MediaStream(audioTracks);
          localStreamRef.current = audioOnly;
          return audioOnly;
        }
        localStreamRef.current = null;
        return null;
      });
      setIsCamOn(false);
    } else {
      if (!navigator.mediaDevices?.getUserMedia) {
        showMediaError('Camera API not available. Make sure you are on localhost or HTTPS.');
        return;
      }
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        console.log('[Media] ✅ Camera acquired');

        const currentStream = localStreamRef.current;
        let combinedStream: MediaStream;

        if (currentStream && currentStream.getAudioTracks().length > 0) {
          combinedStream = new MediaStream([
            ...currentStream.getAudioTracks(),
            ...videoStream.getVideoTracks(),
          ]);
        } else {
          combinedStream = videoStream;
        }

        localStreamRef.current = combinedStream;
        setLocalStream(combinedStream);
        setIsCamOn(true);

        const existingPeerCount = Object.keys(peerConnectionsRef.current).filter(
          sid => peerConnectionsRef.current[sid].connectionState !== 'closed'
        ).length;

        if (existingPeerCount > 0) {
          await renegotiateAllPeers(combinedStream);
        } else {
          await connectToAllPeers();
        }
      } catch (err: unknown) {
        const e = err as Error;
        if (e.name === 'NotAllowedError') showMediaError('Camera permission denied. Click the 🔒 icon in the address bar → Site settings → Allow camera.');
        else if (e.name === 'NotFoundError') showMediaError('No camera found on this device.');
        else if (e.name === 'NotReadableError') showMediaError('Camera is already in use by another app. Close it and try again.');
        else if (e.name === 'OverconstrainedError') showMediaError('Camera does not support the requested resolution.');
        else showMediaError(`Camera error (${e.name}): ${e.message}`);
      }
    }
  };

  // ── Assign srcObject AFTER React renders the <video> element ─────────────
  useEffect(() => {
    if (isCamOn && localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
    if (!isCamOn && localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, [isCamOn, localStream]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      Object.values(audioSourcesRef.current).forEach(s => { try { s.disconnect(); } catch { /* */ } });
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const formatTime = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const isCritical = timeLeft < 60000 && timeLeft > 0;
  const ts = (ms: number) => { const d = new Date(ms); return `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`; };
  const roomShortId = roomId?.split('-')[0]?.toUpperCase().slice(0, 5) || '?????';

  if (!roomData) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#080808' }}>
      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ fontSize: 28, color: '#FF2E2E', marginBottom: 16 }}>◉</motion.div>
      <p style={{ fontSize: 12, color: '#444', fontFamily: 'JetBrains Mono', letterSpacing: '0.1em' }}>Entering the room...</p>
    </div>
  );

  return (
    <div id="room-page" style={{ height: '100vh', display: 'grid', gridTemplateColumns: '220px 1fr 88px', background: '#080808', fontFamily: 'Space Grotesk, sans-serif', color: '#F5F5F5', overflow: 'hidden' }}>

      {/* Session end overlay */}
      <AnimatePresence>
        {sessionEnded && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 24, color: '#555', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>This moment no longer exists.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media permission error toast */}
      <AnimatePresence>
        {mediaError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              zIndex: 200, background: '#1a0a0a', border: '1px solid rgba(255,46,46,0.4)',
              borderRadius: 10, padding: '14px 20px', maxWidth: 440,
              display: 'flex', alignItems: 'flex-start', gap: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>🎥</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#FF2E2E', marginBottom: 4 }}>Camera / Mic Access Failed</p>
              <p style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>{mediaError}</p>
            </div>
            <button onClick={() => setMediaError(null)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 16, flexShrink: 0, padding: 0 }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LEFT SIDEBAR — Participants ─────────────── */}
      <div style={{ borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(255,255,255,0.01)' }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <p style={{ fontSize: 9, color: '#555', letterSpacing: '0.14em' }}>ROOM:</p>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>{ROOM_LABELS[roomData.roomType] || roomData.roomType.toUpperCase()}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: '#FF2E2E', fontFamily: 'JetBrains Mono' }}>#{roomShortId}</span>
            <button onClick={handleLeave} id="leave-room-btn"
              style={{ padding: '4px 10px', background: 'rgba(255,46,46,0.1)', border: '1px solid rgba(255,46,46,0.2)', borderRadius: 4, color: '#FF2E2E', fontSize: 9, letterSpacing: '0.12em', cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif' }}>
              LEAVE
            </button>
          </div>
        </div>

        {/* Participants */}
        <div style={{ padding: '14px 16px', flex: 1, overflowY: 'auto' }}>
          <p style={{ fontSize: 9, color: '#555', letterSpacing: '0.14em', marginBottom: 12 }}>PARTICIPANTS ({roomUsers.length})</p>
          {roomUsers.map(u => (
            <div key={u.socketId} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: u.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {u.identity[0]}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600 }}>{u.identity}</p>
                <p style={{ fontSize: 9, color: '#555', letterSpacing: '0.1em' }}>{u.socketId === socket?.id ? 'YOU' : 'STRANGER'}</p>
              </div>
            </div>
          ))}
          {roomUsers.length < 2 && (
            <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ padding: '10px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 8, textAlign: 'center' }}>
              <p style={{ fontSize: 10, color: '#333' }}>Waiting...</p>
            </motion.div>
          )}
        </div>

        {/* Video thumbnails */}
        {(isCamOn || Object.keys(peers).length > 0) && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {isCamOn && (
              <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 8, aspectRatio: '16/9', background: '#111' }}>
                <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            {Object.entries(peers).map(([sid, peer]) => (
              <div key={sid} style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 8, aspectRatio: '16/9', background: '#111', position: 'relative' }}>
                <video autoPlay playsInline ref={el => { if (el) el.srcObject = peer.stream; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 9, color: peer.color, background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4 }}>
                  {peer.identity}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── CENTER — Chat ─────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Voice status indicator */}
        {voiceStatus && (
          <div style={{ padding: '6px 24px', background: 'rgba(30,200,100,0.08)', borderBottom: '1px solid rgba(30,200,100,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#1ec864' }} />
            <span style={{ fontSize: 10, color: '#1ec864', letterSpacing: '0.08em' }}>{voiceStatus.toUpperCase()}</span>
          </div>
        )}

        {/* Prompt banner */}
        {currentPrompt && (
          <motion.div key={currentPrompt} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
            <p style={{ fontSize: 9, color: '#555', letterSpacing: '0.18em', marginBottom: 4 }}>TODAY&apos;S PROMPT</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 15, color: '#DDDDDD', fontStyle: 'italic' }}>{currentPrompt}</p>
              <button onClick={() => socket?.emit('request-prompt', { roomId, roomType: roomData.roomType })}
                style={{ fontSize: 9, color: '#444', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}>
                NEXT →
              </button>
            </div>
          </motion.div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, color: '#2A2A2A', fontStyle: 'italic', textAlign: 'center' }}>The silence speaks.<br />Break it.</p>
            </div>
          )}
          {messages.map(msg => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              {msg.isSystem ? (
                <div style={{ textAlign: 'center', padding: '4px 0' }}>
                  <span style={{ fontSize: 11, color: '#333', fontStyle: 'italic' }}>{msg.text}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: msg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {msg.identity[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: msg.color }}>{msg.identity}</span>
                      <span style={{ fontSize: 10, color: '#333' }}>{ts(msg.timestamp)}</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#CCCCCC', lineHeight: 1.6 }}>{msg.text}</p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
          {Object.values(typingUsers).length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>?</div>
              <div style={{ display: 'flex', gap: 3, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 12 }}>
                {[0, 1, 2].map(i => <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} style={{ width: 5, height: 5, borderRadius: '50%', background: '#666' }} />)}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 16px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <input id="chat-input" type="text" value={inputText} onChange={handleInput}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
              maxLength={500}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#F5F5F5', fontSize: 13, fontFamily: 'Space Grotesk, sans-serif' }}
            />
            <button id="send-message-btn" onClick={sendMessage} disabled={!inputText.trim()}
              style={{ padding: '8px 20px', background: inputText.trim() ? '#FF2E2E' : 'transparent', border: inputText.trim() ? 'none' : '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: inputText.trim() ? '#fff' : '#444', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', cursor: inputText.trim() ? 'pointer' : 'default', fontFamily: 'Space Grotesk, sans-serif', transition: 'all 0.15s' }}>
              SEND
            </button>
          </div>
        </div>
      </div>

      {/* ── RIGHT SIDEBAR — Controls + Timer + Rules ── */}
      <div style={{ borderLeft: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 8px', gap: 6 }}>

        {/* MIC button */}
        <button id="toggle-mic-btn" onClick={toggleMic}
          title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
          style={{
            width: '100%', padding: '10px 4px', borderRadius: 10, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 18,
            background: isMicOn ? 'rgba(255,46,46,0.15)' : 'rgba(255,255,255,0.04)',
            border: isMicOn ? '1px solid rgba(255,46,46,0.4)' : '1px solid rgba(255,255,255,0.08)',
            transition: 'all 0.15s',
          }}>
          🎤
          <span style={{ fontSize: 8, color: isMicOn ? '#FF2E2E' : '#555', letterSpacing: '0.08em' }}>{isMicOn ? 'ON' : 'MIC'}</span>
        </button>

        {/* CAM button */}
        <button id="toggle-cam-btn" onClick={toggleCam}
          title={isCamOn ? 'Turn off camera' : 'Turn on camera'}
          style={{
            width: '100%', padding: '10px 4px', borderRadius: 10, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 18,
            background: isCamOn ? 'rgba(255,46,46,0.2)' : 'rgba(255,255,255,0.04)',
            border: isCamOn ? '2px solid #FF2E2E' : '1px solid rgba(255,255,255,0.08)',
            boxShadow: isCamOn ? '0 0 12px rgba(255,46,46,0.3)' : 'none',
            transition: 'all 0.15s',
          }}>
          📷
          <span style={{ fontSize: 8, color: isCamOn ? '#FF2E2E' : '#555', letterSpacing: '0.08em' }}>{isCamOn ? 'ON' : 'CAM'}</span>
        </button>

        <div style={{ flex: 1 }} />

        {/* Timer */}
        <div style={{ textAlign: 'center', width: '100%', padding: '8px 4px' }}>
          <p style={{ fontSize: 7, color: '#555', letterSpacing: '0.14em', marginBottom: 4 }}>TIME LEFT</p>
          <p style={{ fontSize: 16, fontWeight: 800, fontFamily: 'JetBrains Mono', color: isCritical ? '#FF2E2E' : '#888', lineHeight: 1 }}>
            {timeLeft > 0 ? formatTime(timeLeft) : '—'}
          </p>
        </div>

        {/* Room rules */}
        <div style={{ padding: '10px 4px', borderTop: '1px solid rgba(255,255,255,0.06)', width: '100%' }}>
          <p style={{ fontSize: 7, color: '#FF2E2E', letterSpacing: '0.12em', textAlign: 'center', marginBottom: 6 }}>RULES</p>
          {ROOM_RULES.map((rule, i) => (
            <p key={i} style={{ fontSize: 7, color: '#444', marginBottom: 3, textAlign: 'center', lineHeight: 1.4 }}>{i + 1}. {rule}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
