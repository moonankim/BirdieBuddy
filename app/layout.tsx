import type { ReactNode } from 'react';
import type { Viewport } from 'next';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };
import {SessionProvider} from '@/lib/session';
import {Providers} from '@/components/chat/providers';
import {Shell} from '@/components/chat/shell';
import './globals.css';
export default function RootLayout({children}:{children:ReactNode}) {
  return <html lang="ko">
    <head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&display=swap" />
    </head>
    <body><SessionProvider><main className="mx-auto min-h-screen max-w-[480px] px-5 pb-12" style={{background:'var(--surface-screen)'}}><Providers><Shell>{children}</Shell></Providers></main></SessionProvider></body>
  </html>;
}
