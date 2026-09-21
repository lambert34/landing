'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge, BrandLogo, Button, Card } from '@g64/ui';
import { getSession, logout, type AuthUser } from '../lib/auth';

const assets = ['Bitcoin', 'Ethereum', 'USDT', 'TON', 'G64 Token'];

export function WalletClient() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    getSession()
      .then((session) => {
        if (!active) return;
        if (!session.authenticated || !session.user) {
          router.replace('/login');
          return;
        }
        setUser(session.user);
      })
      .catch(() => {
        if (active) router.replace('/login');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function signOut() {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await logout();
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }

  if (loading || !user) {
    return (
      <div className="session-loading">
        <BrandLogo imageSrc="/brand/logo.svg" />
        <span>Loading your account…</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside>
        <Link href="/" aria-label="G64 home">
          <BrandLogo imageSrc="/brand/logo.svg" />
        </Link>

        <nav>
          <Link className="active" href="/wallet">
            Portfolio
          </Link>
          <span>
            Activity <small>Soon</small>
          </span>
        </nav>

        <div className="account-block">
          <span className="account-email">{user.email}</span>
          <button type="button" onClick={signOut} disabled={loggingOut}>
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      <main className="wallet-main">
        <header>
          <div>
            <span className="eyebrow">Portfolio</span>
            <h1>$0.00</h1>
            <p>No assets yet</p>
          </div>

          <div className="wallet-actions">
            <Button disabled>Send</Button>
            <Button variant="secondary" disabled>
              Receive
            </Button>
            <Button variant="secondary" disabled>
              Swap
            </Button>
          </div>
        </header>

        <Card>
          <div className="asset-title">
            <h2>Assets</h2>
            <span>Network</span>
          </div>

          {assets.map((asset) => (
            <div className="asset-row" key={asset}>
              <div className="asset-icon">{asset[0]}</div>
              <strong>{asset}</strong>
              <Badge>Testnet</Badge>
              <span>—</span>
            </div>
          ))}
        </Card>
      </main>
    </div>
  );
}
