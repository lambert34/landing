import '@g64/ui/styles.css';
import './web.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://crypto-g64.ru'),
  title: 'G64 — Digital assets made simple',
  description: 'A secure, non-custodial platform for managing digital assets.',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: '/brand/fav.svg',
    shortcut: '/brand/fav.svg',
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
