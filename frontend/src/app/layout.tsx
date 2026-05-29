import type { Metadata } from 'next';
import './globals.css';
import { ClientProviders } from '@/components/ClientProviders';

export const metadata: Metadata = {
  title: 'AfterHours — Where strangers become honest.',
  description: 'An anonymous, real-time underground social platform. No identity. No memory. No trace. Only the night.',
  keywords: ['anonymous chat', 'strangers', 'underground', 'real-time', 'ephemeral', 'afterhours'],
  openGraph: {
    title: 'AfterHours',
    description: 'Where strangers become honest.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500;700;800&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Cinematic Overlays */}
        <div className="grain-overlay" aria-hidden="true" />
        <div className="scanlines-overlay" aria-hidden="true" />

        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
