'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type WeatherState = 'clear' | 'rain' | 'fog' | 'storm' | 'blackout' | 'static';

interface WeatherContextType {
  weather: WeatherState;
  isTransitioning: boolean;
  forceWeather: (state: WeatherState) => void;
}

// ─── CSS Variable Map ────────────────────────────────────────────────────────

const WEATHER_CSS: Record<WeatherState, Record<string, string>> = {
  clear: {
    '--weather-grain': '0.035',
    '--weather-hue': '0',
    '--weather-saturation': '0%',
    '--weather-brightness': '1',
    '--weather-blur': '0',
    '--weather-contrast': '1',
  },
  rain: {
    '--weather-grain': '0.05',
    '--weather-hue': '210',
    '--weather-saturation': '15%',
    '--weather-brightness': '0.85',
    '--weather-blur': '0',
    '--weather-contrast': '1.05',
  },
  fog: {
    '--weather-grain': '0.02',
    '--weather-hue': '220',
    '--weather-saturation': '10%',
    '--weather-brightness': '0.7',
    '--weather-blur': '2',
    '--weather-contrast': '0.9',
  },
  storm: {
    '--weather-grain': '0.08',
    '--weather-hue': '280',
    '--weather-saturation': '25%',
    '--weather-brightness': '0.9',
    '--weather-blur': '0',
    '--weather-contrast': '1.15',
  },
  blackout: {
    '--weather-grain': '0',
    '--weather-hue': '0',
    '--weather-saturation': '0%',
    '--weather-brightness': '0.05',
    '--weather-blur': '0',
    '--weather-contrast': '0.5',
  },
  static: {
    '--weather-grain': '0.12',
    '--weather-hue': '0',
    '--weather-saturation': '0%',
    '--weather-brightness': '0.95',
    '--weather-blur': '0',
    '--weather-contrast': '1.1',
  },
};

const ALL_STATES: WeatherState[] = ['clear', 'rain', 'fog', 'storm', 'blackout', 'static'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Random integer in [min, max] inclusive */
const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/** Random float in [min, max) */
const randFloat = (min: number, max: number) =>
  Math.random() * (max - min) + min;

/** Pick a random weather state, never the same as `current` */
const pickNext = (current: WeatherState): WeatherState => {
  const candidates = ALL_STATES.filter((s) => s !== current);
  return candidates[Math.floor(Math.random() * candidates.length)];
};

/** Apply CSS variables to :root */
const applyWeatherCSS = (state: WeatherState) => {
  const vars = WEATHER_CSS[state];
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
};

// ─── Context ─────────────────────────────────────────────────────────────────

const WeatherContext = createContext<WeatherContextType>({
  weather: 'clear',
  isTransitioning: false,
  forceWeather: () => {},
});

export const useWeather = () => useContext(WeatherContext);

// ─── Provider ────────────────────────────────────────────────────────────────

export const WeatherProvider = ({ children }: { children: React.ReactNode }) => {
  const [weather, setWeather] = useState<WeatherState>('clear');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const weatherRef = useRef<WeatherState>('clear');
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blackoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transition to a new weather state with crossfade
  const transitionTo = useCallback((next: WeatherState) => {
    // Begin crossfade
    setIsTransitioning(true);

    // Apply CSS variables immediately for the new state
    applyWeatherCSS(next);

    // Update React state
    setWeather(next);
    weatherRef.current = next;

    // Clear transitioning flag after 3s crossfade
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 3000);

    // Blackout special case: max 4 seconds, then auto-transition out
    if (next === 'blackout') {
      if (blackoutTimerRef.current) clearTimeout(blackoutTimerRef.current);
      blackoutTimerRef.current = setTimeout(() => {
        const afterBlackout = pickNext('blackout');
        transitionTo(afterBlackout);
      }, 4000);
    }
  }, []);

  // Schedule the next automatic weather cycle
  const scheduleCycle = useCallback(() => {
    if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);

    // 8–20 minutes in milliseconds
    const delay = randInt(8 * 60 * 1000, 20 * 60 * 1000);

    cycleTimerRef.current = setTimeout(() => {
      const next = pickNext(weatherRef.current);
      transitionTo(next);

      // Don't schedule next cycle if blackout — the blackout timer handles the exit,
      // and we'll schedule the next cycle from there
      if (next !== 'blackout') {
        scheduleCycle();
      } else {
        // After blackout ends (4s), the transitionTo callback will fire,
        // and we need to schedule the next cycle from there
        setTimeout(() => scheduleCycle(), 4100);
      }
    }, delay);
  }, [transitionTo]);

  // Force weather from external API (e.g., terminal commands)
  const forceWeather = useCallback(
    (state: WeatherState) => {
      // Cancel any pending automatic cycle
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
      if (blackoutTimerRef.current) clearTimeout(blackoutTimerRef.current);

      transitionTo(state);

      // If blackout, auto-exit handled inside transitionTo.
      // Schedule next automatic cycle after forced state settles.
      if (state !== 'blackout') {
        scheduleCycle();
      } else {
        setTimeout(() => scheduleCycle(), 4100);
      }
    },
    [transitionTo, scheduleCycle],
  );

  // Initialize on mount
  useEffect(() => {
    applyWeatherCSS('clear');
    scheduleCycle();

    return () => {
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      if (blackoutTimerRef.current) clearTimeout(blackoutTimerRef.current);
    };
  }, [scheduleCycle]);

  const value = useMemo<WeatherContextType>(
    () => ({ weather, isTransitioning, forceWeather }),
    [weather, isTransitioning, forceWeather],
  );

  return (
    <WeatherContext.Provider value={value}>
      {children}
    </WeatherContext.Provider>
  );
};

// ─── Overlay Styles (injected via <style> tag) ──────────────────────────────

const OVERLAY_STYLES = `
  @keyframes weather-raindrop {
    0% { transform: translateY(-10vh); }
    100% { transform: translateY(110vh); }
  }

  @keyframes weather-fog-breathe {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.85; }
  }

  @keyframes weather-storm-flash {
    0%, 100% { opacity: 0; }
    50% { opacity: 1; }
  }

  @keyframes weather-static-burst {
    0% { opacity: 0.9; }
    10% { opacity: 0.7; }
    20% { opacity: 0.95; }
    30% { opacity: 0.5; }
    40% { opacity: 0.8; }
    50% { opacity: 0.6; }
    60% { opacity: 0.85; }
    70% { opacity: 0.4; }
    80% { opacity: 0.75; }
    90% { opacity: 0.9; }
    100% { opacity: 0; }
  }

  @keyframes weather-blackout-in {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }

  @keyframes weather-blackout-hold {
    0%, 100% { opacity: 1; }
  }

  @keyframes weather-blackout-out {
    0% { opacity: 1; }
    100% { opacity: 0; }
  }

  @keyframes weather-screen-tear {
    0% { clip-path: inset(0 0 100% 0); opacity: 0; }
    5% { clip-path: inset(20% 0 75% 0); opacity: 1; }
    10% { clip-path: inset(45% 0 50% 0); opacity: 0.8; }
    15% { clip-path: inset(70% 0 25% 0); opacity: 1; }
    20% { clip-path: inset(10% 0 85% 0); opacity: 0.6; }
    25% { clip-path: inset(0 0 100% 0); opacity: 0; }
    100% { clip-path: inset(0 0 100% 0); opacity: 0; }
  }
`;

// ─── Overlay Base ────────────────────────────────────────────────────────────

const overlayBase: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  pointerEvents: 'none',
  zIndex: 9997,
  overflow: 'hidden',
};

// ─── Rain Overlay ────────────────────────────────────────────────────────────

const RainOverlay = React.memo(() => {
  const drops = useMemo(() => {
    const result: Array<{
      id: number;
      left: string;
      height: number;
      duration: number;
      delay: number;
    }> = [];
    for (let i = 0; i < 80; i++) {
      result.push({
        id: i,
        left: `${Math.random() * 100}%`,
        height: randFloat(15, 30),
        duration: randFloat(0.5, 1.2),
        delay: randFloat(0, 2),
      });
    }
    return result;
  }, []);

  return (
    <div style={overlayBase}>
      {drops.map((drop) => (
        <div
          key={drop.id}
          style={{
            position: 'absolute',
            left: drop.left,
            top: 0,
            width: '1px',
            height: `${drop.height}px`,
            background: 'rgba(150, 180, 255, 0.15)',
            animation: `weather-raindrop ${drop.duration}s linear ${drop.delay}s infinite`,
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  );
});

RainOverlay.displayName = 'RainOverlay';

// ─── Fog Overlay ─────────────────────────────────────────────────────────────

const FogOverlay = React.memo(() => (
  <div style={overlayBase}>
    <div
      style={{
        position: 'absolute',
        top: '-20%',
        left: '-20%',
        width: '140%',
        height: '140%',
        background:
          'radial-gradient(ellipse at center, rgba(100, 120, 140, 0.08), transparent 70%)',
        filter: 'blur(40px)',
        animation: 'weather-fog-breathe 8s ease-in-out infinite',
        willChange: 'opacity',
      }}
    />
  </div>
));

FogOverlay.displayName = 'FogOverlay';

// ─── Storm Overlay ───────────────────────────────────────────────────────────

const StormOverlay = React.memo(() => {
  const [flashVisible, setFlashVisible] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const scheduleFlash = () => {
      // Off period: 2–6 seconds
      const offDuration = randInt(2000, 6000);

      flashTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setFlashVisible(true);

        // On period: 100ms
        flashTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          setFlashVisible(false);
          scheduleFlash();
        }, 100);
      }, offDuration);
    };

    scheduleFlash();

    return () => {
      mountedRef.current = false;
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // Generate random tear strip positions
  const tearStrips = useMemo(() => {
    const strips: Array<{ id: number; top: string; height: string; delay: number }> = [];
    for (let i = 0; i < 5; i++) {
      strips.push({
        id: i,
        top: `${randInt(5, 90)}%`,
        height: `${randInt(1, 4)}px`,
        delay: randFloat(0, 4),
      });
    }
    return strips;
  }, []);

  return (
    <div style={overlayBase}>
      {/* Lightning flash */}
      {flashVisible && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(255, 255, 255, 0.12)',
          }}
        />
      )}

      {/* Horizontal screen tear strips */}
      {tearStrips.map((strip) => (
        <div
          key={strip.id}
          style={{
            position: 'absolute',
            top: strip.top,
            left: 0,
            width: '100%',
            height: strip.height,
            background: 'rgba(255, 255, 255, 0.06)',
            animation: `weather-screen-tear ${randFloat(3, 6)}s linear ${strip.delay}s infinite`,
            willChange: 'clip-path, opacity',
          }}
        />
      ))}
    </div>
  );
});

StormOverlay.displayName = 'StormOverlay';

// ─── Static Overlay ──────────────────────────────────────────────────────────

const StaticOverlay = React.memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const [calmed, setCalmed] = useState(false);

  useEffect(() => {
    // After 2 seconds of intense noise, calm down
    const calmTimer = setTimeout(() => setCalmed(true), 2000);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution
    canvas.width = 256;
    canvas.height = 256;

    const renderNoise = () => {
      const imageData = ctx.createImageData(256, 256);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const v = Math.random() * 255;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = calmed ? 15 : 40; // Lower alpha when calmed
      }

      ctx.putImageData(imageData, 0, 0);
      animFrameRef.current = requestAnimationFrame(renderNoise);
    };

    renderNoise();

    return () => {
      clearTimeout(calmTimer);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [calmed]);

  return (
    <div style={overlayBase}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
          opacity: calmed ? 0.08 : 0.35,
          transition: 'opacity 1s ease-out',
        }}
      />
    </div>
  );
});

StaticOverlay.displayName = 'StaticOverlay';

// ─── Blackout Overlay ────────────────────────────────────────────────────────

const BlackoutOverlay = React.memo(() => {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    // Fade in: 0.5s → Hold: 3s → Fade out: 0.5s
    const holdTimer = setTimeout(() => setPhase('hold'), 500);
    const outTimer = setTimeout(() => setPhase('out'), 3500);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(outTimer);
    };
  }, []);

  let opacity = 0;
  let transition = 'opacity 0.5s ease-in';

  if (phase === 'in') {
    opacity = 1;
    transition = 'opacity 0.5s ease-in';
  } else if (phase === 'hold') {
    opacity = 1;
    transition = 'none';
  } else {
    opacity = 0;
    transition = 'opacity 0.5s ease-out';
  }

  return (
    <div
      style={{
        ...overlayBase,
        background: '#000000',
        opacity,
        transition,
      }}
    />
  );
});

BlackoutOverlay.displayName = 'BlackoutOverlay';

// ─── Weather Overlay (Main Export) ───────────────────────────────────────────

export const WeatherOverlay = () => {
  const { weather } = useWeather();

  return (
    <>
      {/* Inject keyframe animations once */}
      <style dangerouslySetInnerHTML={{ __html: OVERLAY_STYLES }} />

      {weather === 'rain' && <RainOverlay />}
      {weather === 'fog' && <FogOverlay />}
      {weather === 'storm' && <StormOverlay />}
      {weather === 'static' && <StaticOverlay />}
      {weather === 'blackout' && <BlackoutOverlay />}
      {/* 'clear' renders nothing */}
    </>
  );
};
