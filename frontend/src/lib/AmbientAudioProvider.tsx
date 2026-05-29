'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface AmbientAudioContextType {
  ambientEnabled: boolean;
  setAmbientEnabled: (enabled: boolean) => void;
  currentRoom: string;
  setCurrentRoom: (room: string) => void;
  triggerEvent: (eventType: 'rumble' | 'crackle' | 'glitch' | 'pulse') => void;
}

const AmbientAudioContext = createContext<AmbientAudioContextType>({
  ambientEnabled: false,
  setAmbientEnabled: () => {},
  currentRoom: 'landing',
  setCurrentRoom: () => {},
  triggerEvent: () => {},
});

export const useAmbientAudio = () => useContext(AmbientAudioContext);

// Audio nodes refs for procedural synthesis
interface SynthGraph {
  ctx: AudioContext;
  analyser: AnalyserNode;
  masterGain: GainNode;
  
  // Base Noise
  whiteNoiseSource: AudioBufferSourceNode;
  noiseFilter: BiquadFilterNode;
  rainGain: GainNode;
  staticGain: GainNode;
  buzzGain: GainNode;
  
  // Drones & Oscs
  droneOscs: OscillatorNode[];
  droneGain: GainNode;
  
  // Synth Pads
  padOscs: OscillatorNode[];
  padGains: GainNode[];
  padMasterGain: GainNode;
  
  // Reverb/Delay lines
  delayNode: DelayNode;
  delayFeedback: GainNode;
  
  // LFOs for modulation
  lfos: OscillatorNode[];
}

export const AmbientAudioProvider = ({ children }: { children: React.ReactNode }) => {
  const [ambientEnabled, setAmbientEnabledState] = useState(false);
  const [currentRoom, setCurrentRoomState] = useState('landing');
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const graphRef = useRef<SynthGraph | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const eventTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMidnightRef = useRef(false);

  // Main Audio Initializer
  const initAudio = () => {
    if (typeof window === 'undefined') return;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      return;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      audioCtxRef.current = ctx;

      // Master output block
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 3.0); // Smooth main volume fade-in

      analyser.connect(ctx.destination);
      masterGain.connect(analyser);

      // Reverb delay unit
      const delayNode = ctx.createDelay(1.0);
      delayNode.delayTime.setValueAtTime(0.6, ctx.currentTime);
      const delayFeedback = ctx.createGain();
      delayFeedback.gain.setValueAtTime(0.55, ctx.currentTime);
      
      // Delay feedback loop
      delayNode.connect(delayFeedback);
      delayFeedback.connect(delayNode);
      delayNode.connect(masterGain);

      // ─── 1. PROCEDURAL NOISE SOURCES ───
      const noiseBuffer = createNoiseBuffer(ctx);
      const whiteNoiseSource = ctx.createBufferSource();
      whiteNoiseSource.buffer = noiseBuffer;
      whiteNoiseSource.loop = true;

      // Noise gain splits
      const rainGain = ctx.createGain();
      rainGain.gain.setValueAtTime(0, ctx.currentTime);
      const staticGain = ctx.createGain();
      staticGain.gain.setValueAtTime(0, ctx.currentTime);
      const buzzGain = ctx.createGain();
      buzzGain.gain.setValueAtTime(0, ctx.currentTime);

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(450, ctx.currentTime); // Deep rain profile

      const staticFilter = ctx.createBiquadFilter();
      staticFilter.type = 'bandpass';
      staticFilter.frequency.setValueAtTime(1800, ctx.currentTime);
      staticFilter.Q.setValueAtTime(0.7, ctx.currentTime);

      // Connect noise branch
      whiteNoiseSource.connect(noiseFilter);
      noiseFilter.connect(rainGain);
      rainGain.connect(masterGain);

      whiteNoiseSource.connect(staticFilter);
      staticFilter.connect(staticGain);
      staticGain.connect(masterGain);

      // ─── 2. INDUSTRIAL DRONE HUM ───
      const droneOscs: OscillatorNode[] = [];
      const droneGain = ctx.createGain();
      droneGain.gain.setValueAtTime(0, ctx.currentTime);

      // Low frequency hums detuned slightly to create slow acoustic beating
      const droneFreqs = [54.8, 109.6, 82.2];
      droneFreqs.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        osc.type = index === 2 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.3, ctx.currentTime);
        
        // Lowpass filter to ensure sub-bass frequencies are clean
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(120, ctx.currentTime);

        osc.connect(oscGain);
        oscGain.connect(filter);
        filter.connect(droneGain);
        osc.start();
        droneOscs.push(osc);
      });
      droneGain.connect(masterGain);

      // ─── 3. CINEMATIC SYNTH PADS (A-Minor 7th) ───
      const padOscs: OscillatorNode[] = [];
      const padGains: GainNode[] = [];
      const padMasterGain = ctx.createGain();
      padMasterGain.gain.setValueAtTime(0, ctx.currentTime);

      // Frequency map: A2 (110Hz), C3 (130.8Hz), E3 (164.8Hz), G3 (196Hz)
      const chordFreqs = [110.0, 130.81, 164.81, 196.00];
      const lfos: OscillatorNode[] = [];

      chordFreqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        // Add tiny detune for analog warmth
        osc.detune.setValueAtTime((Math.random() - 0.5) * 8, ctx.currentTime);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320, ctx.currentTime);

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.0, ctx.currentTime);

        // Procedural volume swells using very slow LFO oscillators
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.04 + idx * 0.015, ctx.currentTime); // slow rates (0.04Hz, 0.055Hz etc)
        
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.18, ctx.currentTime); // Swell amount

        lfo.connect(lfoGain);
        // Connect LFO gain directly to oscillator volume gain parameter
        lfoGain.connect(oscGain.gain);
        
        lfo.start();
        osc.connect(filter);
        filter.connect(oscGain);
        oscGain.connect(padMasterGain);
        
        osc.start();
        padOscs.push(osc);
        padGains.push(oscGain);
        lfos.push(lfo);
      });
      
      padMasterGain.connect(masterGain);
      padMasterGain.connect(delayNode); // Feed pads to delay for spacious reverb

      // ─── 4. ELECTRICAL BUZZ HUM ───
      const buzzOsc = ctx.createOscillator();
      buzzOsc.type = 'sawtooth';
      buzzOsc.frequency.setValueAtTime(50, ctx.currentTime); // European/Asians AC mains hum
      
      const buzzFilter = ctx.createBiquadFilter();
      buzzFilter.type = 'bandpass';
      buzzFilter.frequency.setValueAtTime(100, ctx.currentTime);
      buzzFilter.Q.setValueAtTime(8, ctx.currentTime); // super thin notch to simulate neon buzz
      
      buzzOsc.connect(buzzFilter);
      buzzFilter.connect(buzzGain);
      buzzGain.connect(masterGain);
      buzzOsc.start();

      // Start global source
      whiteNoiseSource.start();

      graphRef.current = {
        ctx,
        analyser,
        masterGain,
        whiteNoiseSource,
        noiseFilter,
        rainGain,
        staticGain,
        buzzGain,
        droneOscs,
        droneGain,
        padOscs,
        padGains,
        padMasterGain,
        delayNode,
        delayFeedback,
        lfos,
      };

      // Set up visual analysis loop
      startAnalysisLoop(analyser);

      // Trigger default room mix
      applySoundscape(currentRoom);

      // Start random dynamic background sound events
      startEventScheduler();

      // Start midnight watchdog loop
      startMidnightWatchdog();

      console.log('[AudioEngine] Procedural engine initialized successfully');
    } catch (err) {
      console.error('[AudioEngine] Failed to initialize Web Audio context:', err);
    }
  };

  // Initialize consent state from localStorage on client-side mount
  useEffect(() => {
    const saved = localStorage.getItem('ah_ambient_enabled');
    if (saved === 'true') {
      setAmbientEnabledState(true);
      initAudio();
    }
  }, []);

  // Update localStorage when consent changes
  const setAmbientEnabled = (enabled: boolean) => {
    localStorage.setItem('ah_ambient_enabled', enabled ? 'true' : 'false');
    setAmbientEnabledState(enabled);
    if (enabled) {
      initAudio();
    } else {
      shutdownAudio();
    }
  };

  const setCurrentRoom = (room: string) => {
    setCurrentRoomState(room);
    if (ambientEnabled && graphRef.current) {
      applySoundscape(room);
    }
  };

  // Helper to create a procedural White Noise buffer
  const createNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
    const bufferSize = 4 * ctx.sampleRate; // 4 seconds of noise
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  };


  const shutdownAudio = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (eventTimerRef.current) {
      clearTimeout(eventTimerRef.current);
      eventTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    if (graphRef.current) {
      const g = graphRef.current;
      try {
        g.masterGain.gain.setValueAtTime(g.masterGain.gain.value, g.ctx.currentTime);
        g.masterGain.gain.linearRampToValueAtTime(0, g.ctx.currentTime + 0.5); // Fast smooth shutdown fade
        setTimeout(() => {
          g.whiteNoiseSource.stop();
          g.droneOscs.forEach(o => o.stop());
          g.padOscs.forEach(o => o.stop());
          g.lfos.forEach(o => o.stop());
          audioCtxRef.current?.close();
          audioCtxRef.current = null;
          graphRef.current = null;
        }, 600);
      } catch {
        audioCtxRef.current = null;
        graphRef.current = null;
      }
    }
  };

  // Crossfade room values
  const applySoundscape = (room: string) => {
    const g = graphRef.current;
    if (!g) return;

    const ctx = g.ctx;
    const now = ctx.currentTime;
    const fadeDuration = 3.0; // 3 seconds smooth transition

    const ramp = (node: GainNode, target: number) => {
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(target, now + fadeDuration);
    };

    // Darkened multiplier if midnight heartbeat mode is running
    const darkScale = isMidnightRef.current ? 1.25 : 1.0;

    switch (room) {
      case 'landing':
        // Soft drone and pads, low static
        ramp(g.rainGain, 0.015);
        ramp(g.staticGain, 0.03 * darkScale);
        ramp(g.droneGain, 0.25 * darkScale);
        ramp(g.padMasterGain, 0.3);
        ramp(g.buzzGain, 0.005);
        break;

      case 'lobby':
        // Chill city hum: light rain, low hum, pads active
        ramp(g.rainGain, 0.04);
        ramp(g.staticGain, 0.02 * darkScale);
        ramp(g.droneGain, 0.2 * darkScale);
        ramp(g.padMasterGain, 0.4);
        ramp(g.buzzGain, 0.008);
        break;

      case 'void':
        // Dark industrial hum, heavy drones, thick static hiss
        ramp(g.rainGain, 0.01);
        ramp(g.staticGain, 0.12 * darkScale);
        ramp(g.droneGain, 0.55 * darkScale);
        ramp(g.padMasterGain, 0.08); // pads are almost silent
        ramp(g.buzzGain, 0.02);      // louder neon hum
        break;

      case 'confessions':
        // Soft analog hiss, soft rain, high emotional pads
        ramp(g.rainGain, 0.15);      // Heavy rain
        ramp(g.staticGain, 0.06 * darkScale);
        ramp(g.droneGain, 0.1 * darkScale);
        ramp(g.padMasterGain, 0.6);  // loudest synth swells
        ramp(g.buzzGain, 0.002);
        break;

      case 'deepTalk':
        // Rain, city rumbling, emotional pads
        ramp(g.rainGain, 0.12);
        ramp(g.staticGain, 0.04 * darkScale);
        ramp(g.droneGain, 0.35 * darkScale);
        ramp(g.padMasterGain, 0.5);
        ramp(g.buzzGain, 0.005);
        break;

      case 'chill':
        // Lo-fi urban vibes: high vinyl static, moderate drones
        ramp(g.rainGain, 0.05);
        ramp(g.staticGain, 0.08 * darkScale);
        ramp(g.droneGain, 0.18 * darkScale);
        ramp(g.padMasterGain, 0.35);
        ramp(g.buzzGain, 0.004);
        break;

      case 'voiceRoom':
        // Muffled sub-bass club vibrations
        ramp(g.rainGain, 0.01);
        ramp(g.staticGain, 0.05 * darkScale);
        ramp(g.droneGain, 0.45 * darkScale); // heavy sub hum
        ramp(g.padMasterGain, 0.15);
        ramp(g.buzzGain, 0.01);
        break;

      case 'end':
      case 'hidden':
        // Corrupted soundscapes, heavy neon buzz, high static interference
        ramp(g.rainGain, 0.02);
        ramp(g.staticGain, 0.22 * darkScale);
        ramp(g.droneGain, 0.5 * darkScale);
        ramp(g.padMasterGain, 0.1);
        ramp(g.buzzGain, 0.06);       // very loud electric crackle hum
        break;

      default:
        ramp(g.rainGain, 0.03);
        ramp(g.staticGain, 0.04);
        ramp(g.droneGain, 0.2);
        ramp(g.padMasterGain, 0.3);
        ramp(g.buzzGain, 0.005);
    }
  };

  // ─── RANDOM BACKGROUND AUDIO EVENTS ───
  const startEventScheduler = () => {
    const triggerNext = () => {
      // Schedule next event in 15 to 45 seconds
      const delay = 15000 + Math.random() * 30000;
      eventTimerRef.current = setTimeout(() => {
        if (!ambientEnabled) return;
        
        const events: ('rumble' | 'crackle' | 'glitch' | 'pulse')[] = ['rumble', 'crackle', 'glitch', 'pulse'];
        const randomEvent = events[Math.floor(Math.random() * events.length)];
        triggerEvent(randomEvent);
        triggerNext();
      }, delay);
    };
    triggerNext();
  };

  const triggerEvent = (eventType: 'rumble' | 'crackle' | 'glitch' | 'pulse') => {
    const g = graphRef.current;
    if (!g) return;

    const ctx = g.ctx;
    const now = ctx.currentTime;

    console.log(`[AudioEngine] 🔊 Triggering dynamic ambient event: ${eventType}`);

    if (eventType === 'rumble') {
      // Train passing: Low sub-bass sweep (40Hz to 60Hz) peaking slowly
      const rumbleOsc = ctx.createOscillator();
      rumbleOsc.type = 'sine';
      rumbleOsc.frequency.setValueAtTime(32, now);
      rumbleOsc.frequency.linearRampToValueAtTime(45, now + 6);
      rumbleOsc.frequency.linearRampToValueAtTime(30, now + 12);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(60, now);

      const rumbleGain = ctx.createGain();
      rumbleGain.gain.setValueAtTime(0, now);
      rumbleGain.gain.linearRampToValueAtTime(0.22, now + 5.5); // swell in
      rumbleGain.gain.linearRampToValueAtTime(0.001, now + 12); // swell out

      rumbleOsc.connect(filter);
      filter.connect(rumbleGain);
      rumbleGain.connect(g.masterGain);

      rumbleOsc.start(now);
      rumbleOsc.stop(now + 12.2);

    } else if (eventType === 'crackle') {
      // Neon / Electrical Short circuit crackle
      const bursts = Math.floor(Math.random() * 5) + 3;
      let timeOffset = 0;

      for (let i = 0; i < bursts; i++) {
        const duration = 0.02 + Math.random() * 0.08;
        const clickOsc = ctx.createOscillator();
        clickOsc.type = 'sawtooth';
        clickOsc.frequency.setValueAtTime(1200 + Math.random() * 1000, now + timeOffset);

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(4000, now + timeOffset);

        const clickGain = ctx.createGain();
        clickGain.gain.setValueAtTime(0.001, now + timeOffset);
        clickGain.gain.linearRampToValueAtTime(0.08, now + timeOffset + 0.002);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + duration);

        clickOsc.connect(filter);
        filter.connect(clickGain);
        clickGain.connect(g.masterGain);

        clickOsc.start(now + timeOffset);
        clickOsc.stop(now + timeOffset + duration + 0.05);

        timeOffset += duration + Math.random() * 0.15;
      }

    } else if (eventType === 'glitch') {
      // Radio frequency static burst
      const glitchDuration = 0.4 + Math.random() * 0.6;
      
      const bufferSize = ctx.sampleRate * glitchDuration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = buffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(2500, now);
      // Modulate filter cutoff rapidly using a sine wave oscillator (LFO)
      const mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.setValueAtTime(35, now); // rapid modulation rate (35Hz)
      
      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(1500, now); // frequency delta

      mod.connect(modGain);
      modGain.connect(bandpass.frequency);

      const glitchGain = ctx.createGain();
      glitchGain.gain.setValueAtTime(0.001, now);
      glitchGain.gain.linearRampToValueAtTime(0.12, now + 0.05);
      glitchGain.gain.setValueAtTime(0.12, now + glitchDuration - 0.05);
      glitchGain.gain.linearRampToValueAtTime(0.001, now + glitchDuration);

      noiseSrc.connect(bandpass);
      bandpass.connect(glitchGain);
      glitchGain.connect(g.masterGain);

      mod.start(now);
      noiseSrc.start(now);
      mod.stop(now + glitchDuration + 0.05);
      noiseSrc.stop(now + glitchDuration + 0.05);

    } else if (eventType === 'pulse') {
      // Heavy deep sub drone swell (like wind blowing against dynamic mic)
      const swellOsc = ctx.createOscillator();
      swellOsc.type = 'sine';
      swellOsc.frequency.setValueAtTime(40, now);

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(50, now);

      const swellGain = ctx.createGain();
      swellGain.gain.setValueAtTime(0.001, now);
      swellGain.gain.linearRampToValueAtTime(0.28, now + 2);
      swellGain.gain.linearRampToValueAtTime(0.001, now + 5);

      swellOsc.connect(lowpass);
      lowpass.connect(swellGain);
      swellGain.connect(g.masterGain);

      swellOsc.start(now);
      swellOsc.stop(now + 5.2);
    }
  };

  // ─── 5. MIDNIGHT WATCHDOG & HEARTBEAT SYNTESIS ───
  const startMidnightWatchdog = () => {
    const checkMidnight = () => {
      const hrs = new Date().getHours();
      // Force midnight features between 12:00 AM and 5:00 AM (night mode)
      const isMidnightTime = hrs === 0 || hrs === 1 || hrs === 2 || hrs === 3 || hrs === 4;
      
      if (isMidnightTime && !isMidnightRef.current) {
        console.log('[AudioEngine] ⏰ Midnight system detected. Dark ambience activated.');
        isMidnightRef.current = true;
        // Re-crossfade current room to apply dark multiplier
        applySoundscape(currentRoom);
        // Start sub heartbeat pulse synthesizer
        startHeartbeatSynth();
      } else if (!isMidnightTime && isMidnightRef.current) {
        console.log('[AudioEngine] ☀️ Sunrise cycle. Resetting midnight parameters.');
        isMidnightRef.current = false;
        applySoundscape(currentRoom);
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = null;
        }
      }
    };
    
    checkMidnight();
    // Check time state every 30 seconds
    heartbeatTimerRef.current = setInterval(checkMidnight, 30000);
  };

  // Periodic heartbeat double-thump synthesizer (triggered at midnight)
  const startHeartbeatSynth = () => {
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);

    const triggerHeartbeat = () => {
      const g = graphRef.current;
      if (!g) return;

      const ctx = g.ctx;
      const now = ctx.currentTime;

      // Double-thump heartbeat details
      // First thump
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(65, now);
      osc1.frequency.exponentialRampToValueAtTime(25, now + 0.12);

      const gain1 = ctx.createGain();
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc1.connect(gain1);
      gain1.connect(g.masterGain);
      osc1.start(now);
      osc1.stop(now + 0.18);

      // Second thump (0.28 seconds later, slightly lower frequency and louder)
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(55, now + 0.28);
      osc2.frequency.exponentialRampToValueAtTime(25, now + 0.42);

      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.001, now + 0.28);
      gain2.gain.linearRampToValueAtTime(0.24, now + 0.30);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc2.connect(gain2);
      gain2.connect(g.masterGain);
      osc2.start(now + 0.28);
      osc2.stop(now + 0.48);
    };

    // Trigger double thump every 1.6 seconds
    heartbeatTimerRef.current = setInterval(() => {
      if (ambientEnabled) triggerHeartbeat();
    }, 1600);
  };

  // ─── 6. MASTER ANALYSER LOOP (EXPORTS CSS VARIABLES) ───
  const startAnalysisLoop = (analyser: AnalyserNode) => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    let lastBass = 0;
    let lastTreble = 0;

    const analyze = () => {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
      
      analyser.getByteFrequencyData(dataArray);

      // Low frequencies (Bass): bins 0 - 8 (approx 0Hz - 170Hz at 44.1kHz sample rate)
      let bassSum = 0;
      for (let i = 0; i < 8; i++) {
        bassSum += dataArray[i];
      }
      const rawBass = bassSum / 8 / 255; // Normalize 0 to 1

      // High frequencies (Treble): bins 60 - 128 (approx 1.2kHz - 2.5kHz)
      let trebleSum = 0;
      for (let i = 60; i < 120; i++) {
        trebleSum += dataArray[i];
      }
      const rawTreble = trebleSum / 60 / 255; // Normalize 0 to 1

      // Smooth values using easy lerp (ease damping)
      const bass = lastBass + (rawBass - lastBass) * 0.15;
      const treble = lastTreble + (rawTreble - lastTreble) * 0.18;
      
      lastBass = bass;
      lastTreble = treble;

      const masterVol = (bass + treble) / 2;

      // Update global CSS custom variables on :root
      // These drive browser animations smoothly with 0% React re-render tax!
      const root = document.documentElement;
      
      // Glow expansion scales up to 1.3 based on bass presence
      root.style.setProperty('--audio-glow', String(1 + bass * 0.32));
      
      // Treble flicker for VHS grain adjustments
      root.style.setProperty('--audio-flicker', String(Math.max(0.1, treble * 1.5)));
      
      // Master average volume
      root.style.setProperty('--audio-level', String(masterVol));

      // screen vibration: shakes offset by 1.5px max during bass hits/events
      if (bass > 0.3) {
        const shakeX = (Math.random() - 0.5) * bass * 2.0;
        const shakeY = (Math.random() - 0.5) * bass * 2.0;
        root.style.setProperty('--audio-vibration-x', `${shakeX}px`);
        root.style.setProperty('--audio-vibration-y', `${shakeY}px`);
      } else {
        root.style.setProperty('--audio-vibration-x', '0px');
        root.style.setProperty('--audio-vibration-y', '0px');
      }

      animationFrameRef.current = requestAnimationFrame(analyze);
    };

    analyze();
  };

  // Automatically start AudioContext on mouse click / interaction gesture if consent is given
  useEffect(() => {
    const autoPlayOnInteraction = () => {
      if (ambientEnabled && audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().then(() => {
          console.log('[AudioEngine] 🔊 AudioContext auto-resumed via user click gesture');
        });
      }
    };
    
    window.addEventListener('click', autoPlayOnInteraction);
    return () => {
      window.removeEventListener('click', autoPlayOnInteraction);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [ambientEnabled]);

  return (
    <AmbientAudioContext.Provider
      value={{
        ambientEnabled,
        setAmbientEnabled,
        currentRoom,
        setCurrentRoom,
        triggerEvent,
      }}
    >
      {children}
    </AmbientAudioContext.Provider>
  );
};
