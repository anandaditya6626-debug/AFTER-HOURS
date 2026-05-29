'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

type InsomniaTitle =
  | 'Nightwalker'
  | 'Sleep Deprived'
  | 'Static Mind'
  | 'Awake Entity'
  | 'Digital Ghost';

interface InsomniaContextType {
  /** Whether the current hour falls between 12 AM and 5 AM */
  isLateNight: boolean;
  /** Number of consecutive late-night dates logged */
  consecutiveNights: number;
  /** Title derived from consecutive nights, null when not late night */
  insomniaTitle: InsomniaTitle | null;
  /** 0-5 insomnia severity level */
  insomniaLevel: number;
  /** Minutes elapsed since the provider mounted */
  sessionMinutes: number;
  /** True once sessionMinutes >= 45 */
  isBurnout: boolean;
  /** Raw date strings stored in localStorage */
  nightLog: string[];
}

const STORAGE_KEY = 'ah_insomnia_log';

const TITLES: Record<number, InsomniaTitle> = {
  1: 'Nightwalker',
  2: 'Sleep Deprived',
  3: 'Static Mind',
  4: 'Awake Entity',
  5: 'Digital Ghost',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns 'YYYY-MM-DD' for today in local time */
function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns true if the current hour is between 0 (12 AM) and 4 (inclusive → before 5 AM) */
function isLateHour(): boolean {
  const h = new Date().getHours();
  return h >= 0 && h < 5;
}

/** Parse a 'YYYY-MM-DD' string into a Date at midnight local time */
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Count how many consecutive nights (ending at the most recent entry)
 * appear in a sorted array of date strings.
 * Dates must be sequential — any gap resets the counter.
 */
function countConsecutive(dates: string[]): number {
  if (dates.length === 0) return 0;

  // De-duplicate and sort ascending
  const unique = [...new Set(dates)].sort();
  let streak = 1;

  for (let i = unique.length - 1; i > 0; i--) {
    const curr = parseDate(unique[i]);
    const prev = parseDate(unique[i - 1]);
    const diffMs = curr.getTime() - prev.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function titleForCount(n: number): InsomniaTitle | null {
  if (n <= 0) return null;
  if (n >= 5) return TITLES[5];
  return TITLES[n] ?? null;
}

function levelForCount(n: number): number {
  return Math.min(n, 5);
}

/** Linearly interpolate between a and b by t ∈ [0,1] */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'AM' : 'AM'; // We're always between 12AM-5AM
  const display = h === 0 ? 12 : h;
  return `${display}:${m} AM`;
}

// ── Context ────────────────────────────────────────────────────────────────────

const InsomniaContext = createContext<InsomniaContextType>({
  isLateNight: false,
  consecutiveNights: 0,
  insomniaTitle: null,
  insomniaLevel: 0,
  sessionMinutes: 0,
  isBurnout: false,
  nightLog: [],
});

// ── Provider ───────────────────────────────────────────────────────────────────

export const InsomniaProvider = ({ children }: { children: ReactNode }) => {
  const [isLateNight, setIsLateNight] = useState(false);
  const [nightLog, setNightLog] = useState<string[]>([]);
  const [consecutiveNights, setConsecutiveNights] = useState(0);
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [isBurnout, setIsBurnout] = useState(false);

  const sessionStartRef = useRef<number>(Date.now());
  const loggedThisSessionRef = useRef(false);
  const burnoutRafRef = useRef<number | null>(null);
  const minuteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Mount: check time, log session, load history ──
  useEffect(() => {
    sessionStartRef.current = Date.now();

    const late = isLateHour();
    setIsLateNight(late);

    // Load existing log
    let log: string[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) log = JSON.parse(raw);
      if (!Array.isArray(log)) log = [];
    } catch {
      log = [];
    }

    if (late && !loggedThisSessionRef.current) {
      const today = todayDateString();
      if (!log.includes(today)) {
        log.push(today);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
      }
      loggedThisSessionRef.current = true;
    }

    setNightLog(log);
    setConsecutiveNights(late ? countConsecutive(log) : 0);

    return () => {
      if (burnoutRafRef.current !== null) cancelAnimationFrame(burnoutRafRef.current);
      if (minuteIntervalRef.current !== null) clearInterval(minuteIntervalRef.current);
    };
  }, []);

  // ── Session timer: update sessionMinutes every 15 s for efficiency ──
  useEffect(() => {
    const tick = () => {
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 60000);
      setSessionMinutes(elapsed);
    };

    minuteIntervalRef.current = setInterval(tick, 15_000);
    tick();

    return () => {
      if (minuteIntervalRef.current !== null) clearInterval(minuteIntervalRef.current);
    };
  }, []);

  // ── Burnout detection ──
  useEffect(() => {
    if (sessionMinutes >= 45 && !isBurnout) {
      setIsBurnout(true);
    }
  }, [sessionMinutes, isBurnout]);

  // ── Burnout CSS variable ramp ──
  useEffect(() => {
    if (!isBurnout) {
      // Reset CSS vars
      document.documentElement.style.setProperty('--burnout-level', '0');
      document.documentElement.style.setProperty('--burnout-blur', '0');
      document.documentElement.style.setProperty('--burnout-brightness', '1');
      return;
    }

    const RAMP_DURATION_MS = 10 * 60 * 1000; // 10 minutes
    const rampStart = Date.now();

    function ramp() {
      const elapsed = Date.now() - rampStart;
      const t = Math.min(elapsed / RAMP_DURATION_MS, 1);

      const level = lerp(0, 1, t);
      const blur = lerp(0, 1.5, t);
      const brightness = lerp(1, 0.6, t);

      document.documentElement.style.setProperty('--burnout-level', level.toFixed(4));
      document.documentElement.style.setProperty('--burnout-blur', blur.toFixed(4));
      document.documentElement.style.setProperty('--burnout-brightness', brightness.toFixed(4));

      if (t < 1) {
        burnoutRafRef.current = requestAnimationFrame(ramp);
      }
    }

    burnoutRafRef.current = requestAnimationFrame(ramp);

    return () => {
      if (burnoutRafRef.current !== null) cancelAnimationFrame(burnoutRafRef.current);
    };
  }, [isBurnout]);

  const insomniaTitle = isLateNight ? titleForCount(consecutiveNights) : null;
  const insomniaLevel = isLateNight ? levelForCount(consecutiveNights) : 0;

  return (
    <InsomniaContext.Provider
      value={{
        isLateNight,
        consecutiveNights,
        insomniaTitle,
        insomniaLevel,
        sessionMinutes,
        isBurnout,
        nightLog,
      }}
    >
      {children}
    </InsomniaContext.Provider>
  );
};

// ── Hook ───────────────────────────────────────────────────────────────────────

export const useInsomnia = (): InsomniaContextType => useContext(InsomniaContext);

// ── InsomniaBadge ──────────────────────────────────────────────────────────────

const badgeStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'fixed',
    top: 64,
    right: 16,
    zIndex: 9000,
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
  },
  line: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 8,
    color: '#FF2E2E',
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    lineHeight: 1.6,
    userSelect: 'none' as const,
  },
};

const BADGE_KEYFRAMES = `
@keyframes insomnia-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
@keyframes insomnia-flicker-fast {
  0%   { opacity: 1; }
  5%   { opacity: 0.2; }
  10%  { opacity: 0.9; }
  15%  { opacity: 0.3; }
  20%  { opacity: 1; }
  50%  { opacity: 0.8; }
  55%  { opacity: 0.1; }
  60%  { opacity: 0.95; }
  100% { opacity: 0.7; }
}
`;

export const InsomniaBadge = () => {
  const { isLateNight, insomniaLevel } = useInsomnia();
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    if (!isLateNight) return;

    const update = () => setCurrentTime(formatTime(new Date()));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [isLateNight]);

  if (!isLateNight) return null;

  const flickerClass = insomniaLevel >= 3 ? 'flicker-fast' : '';

  return (
    <>
      <style>{BADGE_KEYFRAMES}</style>
      <div
        style={badgeStyles.wrapper}
        className={flickerClass}
        data-insomnia-badge
      >
        <span
          style={{
            ...badgeStyles.line,
            animation: flickerClass
              ? 'insomnia-flicker-fast 1.2s steps(1) infinite'
              : 'insomnia-pulse 3s ease-in-out infinite',
          }}
        >
          ACTIVE AT {currentTime}
        </span>
        <span
          style={{
            ...badgeStyles.line,
            animation: flickerClass
              ? 'insomnia-flicker-fast 1.2s steps(1) infinite 0.15s'
              : 'insomnia-pulse 3s ease-in-out infinite 0.4s',
          }}
        >
          INSOMNIA DETECTED
        </span>
      </div>
    </>
  );
};

// ── BurnoutBanner ──────────────────────────────────────────────────────────────

const BURNOUT_KEYFRAMES = `
@keyframes burnout-slide-in {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
@keyframes burnout-signal-decay {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
}
`;

const bannerStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9500,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '16px 32px',
    background: 'rgba(255, 46, 46, 0.06)',
    border: '1px solid rgba(255, 46, 46, 0.2)',
    borderRadius: 2,
    backdropFilter: 'blur(8px)',
    animation: 'burnout-slide-in 0.6s ease-out, burnout-signal-decay 4s ease-in-out infinite 0.6s',
  },
  text: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 9,
    color: '#FF2E2E',
    letterSpacing: '0.25em',
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
    userSelect: 'none' as const,
    lineHeight: 1.5,
  },
  button: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 8,
    color: '#080808',
    background: '#FF2E2E',
    border: 'none',
    borderRadius: 1,
    padding: '6px 18px',
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    transition: 'opacity 0.2s ease',
  },
};

export const BurnoutBanner = () => {
  const { isBurnout } = useInsomnia();
  const [dismissed, setDismissed] = useState(false);
  const breakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBreak = useCallback(() => {
    // Immediately set burnout-level to max
    document.documentElement.style.setProperty('--burnout-level', '1');
    document.documentElement.style.setProperty('--burnout-blur', '1.5');
    document.documentElement.style.setProperty('--burnout-brightness', '0.6');

    setDismissed(true);

    // Revert after 5 minutes
    breakTimerRef.current = setTimeout(() => {
      document.documentElement.style.setProperty('--burnout-level', '0');
      document.documentElement.style.setProperty('--burnout-blur', '0');
      document.documentElement.style.setProperty('--burnout-brightness', '1');
    }, 5 * 60 * 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (breakTimerRef.current !== null) clearTimeout(breakTimerRef.current);
    };
  }, []);

  if (!isBurnout || dismissed) return null;

  return (
    <>
      <style>{BURNOUT_KEYFRAMES}</style>
      <div style={bannerStyles.wrapper} data-burnout-banner>
        <span style={bannerStyles.text}>
          EXTENDED SESSION DETECTED — YOUR SIGNAL IS WEAKENING
        </span>
        <button
          style={bannerStyles.button}
          onClick={handleBreak}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '0.8';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '1';
          }}
        >
          [TAKE A BREAK]
        </button>
      </div>
    </>
  );
};
