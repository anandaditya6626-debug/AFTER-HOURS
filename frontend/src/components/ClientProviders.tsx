'use client';

import React, { useState, useCallback } from 'react';

// ── Providers ──
import { AmbientAudioProvider } from '@/lib/AmbientAudioProvider';
import { WorldStateProvider, useWorldState } from '@/lib/WorldStateProvider';
import { InsomniaProvider, InsomniaBadge, BurnoutBanner } from '@/lib/InsomniaEngine';
import { WeatherProvider, WeatherOverlay } from '@/lib/WeatherSystem';
import { PsychObserverProvider } from '@/lib/PsychObserver';
import { MemoryEchoProvider, useMemoryEcho } from '@/lib/MemoryEchoSystem';
import { IdentityProvider } from '@/lib/IdentityProvider';
import { SocketProvider } from '@/lib/SocketProvider';
import { AudioConsentOverlay } from '@/components/AudioConsentOverlay';

// ── Global Components ──
import { SignalInterruption } from '@/components/SignalInterruption';
import { DigitalDreamMode } from '@/components/DigitalDreamMode';
import { ShadowUserFeed } from '@/components/ShadowUserFeed';
import { PhilosophyEngine } from '@/components/PhilosophyEngine';
import { AnalogCameraOverlay } from '@/components/AnalogCameraOverlay';
import { SecretSymbolLayer } from '@/components/SecretSymbolLayer';
import { GlobalActivityMap } from '@/components/GlobalActivityMap';
import { TerminalCommandBar } from '@/components/TerminalCommandBar';

// ── Inner Shell (has access to all contexts) ──
function WorldShell({ children }: { children: React.ReactNode }) {
  const { isDreamMode, setDreamMode, isSignalLost, setSignalLost } = useWorldState();
  const [showRadar, setShowRadar] = useState(false);
  const [forceSignal, setForceSignal] = useState(false);

  const handleCommand = useCallback((cmd: string) => {
    switch (cmd) {
      case '/sleep':
        setDreamMode(true);
        break;
      case '/disconnect':
        setForceSignal(true);
        setTimeout(() => setForceSignal(false), 3000);
        break;
      case '/signal':
        setShowRadar(true);
        break;
      case '/echo':
        // Trigger via context - handled by MemoryEchoProvider internally
        break;
      case '/void':
        window.location.href = '/lobby';
        break;
      case '/weather':
        // Weather cycles are automatic, but this nudges it
        break;
      case '/mayhem':
        setForceSignal(true);
        setDreamMode(true);
        setTimeout(() => setForceSignal(false), 3000);
        break;
      default:
        break;
    }
  }, [setDreamMode]);

  return (
    <>
      {children}

      {/* ── Global Overlays ── */}
      <WeatherOverlay />
      <InsomniaBadge />
      <BurnoutBanner />
      <ShadowUserFeed />
      <PhilosophyEngine />
      <AnalogCameraOverlay />
      <SecretSymbolLayer />
      <AudioConsentOverlay />

      {/* ── Event-Driven Overlays ── */}
      <SignalInterruption autoTrigger={true} forceTrigger={forceSignal} />
      <DigitalDreamMode active={isDreamMode} onEnd={() => setDreamMode(false)} />
      <GlobalActivityMap visible={showRadar} onClose={() => setShowRadar(false)} />

      {/* ── Terminal (press / anywhere) ── */}
      <TerminalCommandBar onCommand={handleCommand} />
    </>
  );
}

// ── Main Client Wrapper ──
export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <WorldStateProvider>
      <AmbientAudioProvider>
        <WeatherProvider>
          <InsomniaProvider>
            <PsychObserverProvider>
              <MemoryEchoProvider>
                <IdentityProvider>
                  <SocketProvider>
                    <WorldShell>
                      {children}
                    </WorldShell>
                  </SocketProvider>
                </IdentityProvider>
              </MemoryEchoProvider>
            </PsychObserverProvider>
          </InsomniaProvider>
        </WeatherProvider>
      </AmbientAudioProvider>
    </WorldStateProvider>
  );
}
