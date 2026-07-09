import type { Metadata, Viewport } from 'next';
import { Baloo_2, Quicksand, Gochi_Hand } from 'next/font/google';
import { APP_NAME, APP_TAGLINE } from '@/config/app';
import './globals.css';

const display = Baloo_2({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  variable: '--font-display-src',
  display: 'swap',
});
const body = Quicksand({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-body-src',
  display: 'swap',
});
const hand = Gochi_Hand({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-hand-src',
  display: 'swap',
});

export const metadata: Metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description:
    'A tiny pastel 3D world for long-distance couples: photobooth for two, quizzes, drawing, debates and arcade duels — peer-to-peer, nothing stored, nothing sold.',
};

export const viewport: Viewport = {
  themeColor: '#FFF8F0',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${hand.variable}`}>
      <body
        style={
          {
            // map next/font CSS vars into our design tokens
            '--font-display': `var(--font-display-src), 'Baloo 2', sans-serif`,
            '--font-body': `var(--font-body-src), 'Quicksand', sans-serif`,
            '--font-hand': `var(--font-hand-src), 'Gochi Hand', cursive`,
          } as React.CSSProperties
        }
      >
        <div id="app-root">{children}</div>
      </body>
    </html>
  );
}
