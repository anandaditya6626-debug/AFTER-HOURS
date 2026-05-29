'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TimePhase = 'dawn' | 'day' | 'dusk' | 'night' | 'midnight' | 'deepNight';

export type WeatherState = 'clear' | 'rain' | 'fog' | 'storm' | 'blackout' | 'static';

export interface WorldStateContextType {
  // Time tracking
  timePhase: TimePhase;
  isLateNight: boolean;

  // Midnight transformation
  isMidnightEvent: boolean;
  midnightTriggered: boolean;
  showMidnightBanner: boolean;

  // Mode flags (settable by other systems)
  isDreamMode: boolean;
  setDreamMode: (v: boolean) => void;
  isSignalLost: boolean;
  setSignalLost: (v: boolean) => void;
  isBurnout: boolean;
  setBurnout: (v: boolean) => void;
  weatherState: WeatherState;
  setWeatherState: (v: WeatherState) => void;

  // Heartbeat
  heartbeatActive: boolean;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_ACCENT = '#FF2E2E';
const DEFAULT_ACCENT_GLOW = 'rgba(255,46,46,0.15)';
const MIDNIGHT_ACCENT = '#7B2D8B';
const MIDNIGHT_ACCENT_GLOW = 'rgba(123,45,139,0.15)';

const MIDNIGHT_EVENT_DURATION_MS = 60_000;
const MIDNIGHT_BANNER_DURATION_MS = 8_000;
const TIME_PHASE_POLL_MS = 30_000;
const MIDNIGHT_CHECK_POLL_MS = 1_000;

const SESSION_KEY_MIDNIGHT = 'ah_midnight_triggered';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeTimePhase(date: Date): TimePhase {
  const h = date.getHours();
  if (h >= 1 && h < 5) return 'deepNight';
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  if (h >= 20 && h < 24) return 'night';
  // h === 0 (midnight hour, 12AM–1AM)
  return 'midnight';
}

function isLateNightPhase(phase: TimePhase): boolean {
  return phase === 'midnight' || phase === 'deepNight';
}

function isMidnightWindow(date: Date): boolean {
  // True for the first 60 seconds after 00:00:00
  return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() < 60;
}

function setCSSVar(name: string, value: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty(name, value);
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

const WorldStateContext = createContext<WorldStateContextType>({
  timePhase: 'night',
  isLateNight: false,

  isMidnightEvent: false,
  midnightTriggered: false,
  showMidnightBanner: false,

  isDreamMode: false,
  setDreamMode: () => {},
  isSignalLost: false,
  setSignalLost: () => {},
  isBurnout: false,
  setBurnout: () => {},
  weatherState: 'clear',
  setWeatherState: () => {},

  heartbeatActive: false,
});

// ─── Provider ────────────────────────────────────────────────────────────────

export const WorldStateProvider = ({ children }: { children: ReactNode }) => {
  // ── Time phase ───────────────────────────────────────────────────────────
  const [timePhase, setTimePhase] = useState<TimePhase>(() => computeTimePhase(new Date()));
  const isLateNight = isLateNightPhase(timePhase);

  // ── Midnight event ───────────────────────────────────────────────────────
  const [isMidnightEvent, setIsMidnightEvent] = useState(false);
  const [midnightTriggered, setMidnightTriggered] = useState(false);
  const [showMidnightBanner, setShowMidnightBanner] = useState(false);

  // ── Mode flags ───────────────────────────────────────────────────────────
  const [isDreamMode, setDreamMode] = useState(false);
  const [isSignalLost, setSignalLost] = useState(false);
  const [isBurnout, setBurnout] = useState(false);
  const [weatherState, setWeatherState] = useState<WeatherState>('clear');

  // ── Heartbeat ────────────────────────────────────────────────────────────
  const heartbeatActive = isMidnightEvent || isDreamMode || isBurnout;
  const rafRef = useRef<number | null>(null);
  const midnightEventTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Restore session state on mount ───────────────────────────────────────
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY_MIDNIGHT);
      if (stored === 'true') {
        setMidnightTriggered(true);
      }
    } catch {
      // sessionStorage not available (SSR safety)
    }
  }, []);

  // ── Time phase polling (every 30s) ──────────────────────────────────────
  useEffect(() => {
    const update = () => setTimePhase(computeTimePhase(new Date()));
    update();
    const id = setInterval(update, TIME_PHASE_POLL_MS);
    return () => clearInterval(id);
  }, []);

  // ── Midnight detection (every 1s) ──────────────────────────────────────
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const inWindow = isMidnightWindow(now);

      if (inWindow && !isMidnightEvent) {
        // Midnight just struck — fire the event
        setIsMidnightEvent(true);
        setMidnightTriggered(true);
        setShowMidnightBanner(true);

        try {
          sessionStorage.setItem(SESSION_KEY_MIDNIGHT, 'true');
        } catch {
          // ignore
        }

        // Apply midnight CSS
        setCSSVar('--midnight-active', '1');
        setCSSVar('--accent', MIDNIGHT_ACCENT);
        setCSSVar('--accent-glow', MIDNIGHT_ACCENT_GLOW);

        // Clear midnight event after 60 seconds
        midnightEventTimerRef.current = setTimeout(() => {
          setIsMidnightEvent(false);
          setCSSVar('--midnight-active', '0');
        }, MIDNIGHT_EVENT_DURATION_MS);

        // Clear banner after 8 seconds
        bannerTimerRef.current = setTimeout(() => {
          setShowMidnightBanner(false);
        }, MIDNIGHT_BANNER_DURATION_MS);
      }
    };

    // Run check at ~1s intervals, but only around relevant hours
    // We still run every second for precision — the check itself is cheap
    const id = setInterval(check, MIDNIGHT_CHECK_POLL_MS);

    // Also run immediately
    check();

    return () => {
      clearInterval(id);
      if (midnightEventTimerRef.current) clearTimeout(midnightEventTimerRef.current);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
    // We intentionally only depend on isMidnightEvent to avoid re-registering
    // the interval on every state change. The closure captures what it needs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMidnightEvent]);

  // ── Reset accent colors at 1 AM ────────────────────────────────────────
  useEffect(() => {
    if (timePhase !== 'midnight') {
      // We've left the midnight hour — reset accent colors
      setCSSVar('--accent', DEFAULT_ACCENT);
      setCSSVar('--accent-glow', DEFAULT_ACCENT_GLOW);
    }
  }, [timePhase]);

  // ── Heartbeat CSS variable ─────────────────────────────────────────────
  useEffect(() => {
    setCSSVar('--heartbeat-active', heartbeatActive ? '1' : '0');

    if (!heartbeatActive) {
      setCSSVar('--heartbeat-opacity', '0');
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    // 60 BPM = 1 beat per 1000ms
    // Cycle: 0→0.5 beat ramps 0.3→0.8, 0.5→1.0 beat ramps 0.8→0.3
    const BEAT_DURATION_MS = 1000;
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = (timestamp - startTime) % BEAT_DURATION_MS;
      const progress = elapsed / BEAT_DURATION_MS;

      // Smooth sine-based pulse: oscillates between 0.3 and 0.8
      const opacity = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(progress * Math.PI * 2 - Math.PI / 2));
      setCSSVar('--heartbeat-opacity', opacity.toFixed(3));

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [heartbeatActive]);

  // ── Memoised setters (stable references) ───────────────────────────────
  const handleSetDreamMode = useCallback((v: boolean) => setDreamMode(v), []);
  const handleSetSignalLost = useCallback((v: boolean) => setSignalLost(v), []);
  const handleSetBurnout = useCallback((v: boolean) => setBurnout(v), []);
  const handleSetWeatherState = useCallback((v: WeatherState) => setWeatherState(v), []);

  // ── Context value ──────────────────────────────────────────────────────
  const value: WorldStateContextType = {
    timePhase,
    isLateNight,

    isMidnightEvent,
    midnightTriggered,
    showMidnightBanner,

    isDreamMode,
    setDreamMode: handleSetDreamMode,
    isSignalLost,
    setSignalLost: handleSetSignalLost,
    isBurnout,
    setBurnout: handleSetBurnout,
    weatherState,
    setWeatherState: handleSetWeatherState,

    heartbeatActive,
  };

  return (
    <WorldStateContext.Provider value={value}>
      {children}
    </WorldStateContext.Provider>
  );
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export const useWorldState = (): WorldStateContextType => {
  const ctx = useContext(WorldStateContext);
  if (ctx === undefined) {
    throw new Error('useWorldState must be used within a <WorldStateProvider>');
  }
  return ctx;
};
