'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BrandLogo, Button, Card, Container, Input, PageHeader } from '@g64/ui';
import {
  authErrorMessage,
  clearPendingAuth,
  loadPendingAuth,
  requestOtp,
  savePendingAuth,
  verifyOtp,
  type PendingAuth,
} from '../../lib/auth';


export default function Verify() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAuth | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const value = loadPendingAuth();
    if (!value) {
      router.replace('/login');
      return;
    }
    setPending(value);

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [router]);

  const expiresIn = useMemo(
    () => (pending ? Math.max(0, Math.ceil((pending.expiresAt - now) / 1000)) : 0),
    [pending, now],
  );
  const resendIn = useMemo(
    () => (pending ? Math.max(0, Math.ceil((pending.resendAt - now) / 1000)) : 0),
    [pending, now],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending || loading || code.length !== 6) return;

    setLoading(true);
    setError('');

    try {
      const result = await verifyOtp(pending.challengeId, code);
      if (!result.authenticated) throw new Error('Session was not created');
      clearPendingAuth();
      router.replace('/wallet');
    } catch (verifyError) {
      setError(authErrorMessage(verifyError));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!pending || resending || resendIn > 0) return;

    setResending(true);
    setError('');

    try {
      const response = await requestOtp(pending.email, pending.purpose);
      const next = savePendingAuth(pending.email, pending.purpose, response);
      setPending(next);
      setCode('');
      setNow(Date.now());
    } catch (requestError) {
      setError(authErrorMessage(requestError));
    } finally {
      setResending(false);
    }
  }

  if (!pending) {
    return (
      <Container className="auth-page">
        <Link href="/" className="auth-brand" aria-label="G64 home">
          <BrandLogo imageSrc="/brand/logo.svg" />
        </Link>
        <Card className="auth-card">
          <PageHeader eyebrow="Verify" title="Checking your request…" />
        </Card>
      </Container>
    );
  }

  return (
    <Container className="auth-page">
      <Link href="/" className="auth-brand" aria-label="G64 home">
        <BrandLogo imageSrc="/brand/logo.svg" />
      </Link>

      <Card className="auth-card">
        <PageHeader
          eyebrow="Verification"
          title="Check your email"
          description={`We sent a 6-digit code to ${pending.email}`}
        />

        <form onSubmit={submit}>
          <label>
            Verification code
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="000000"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              autoFocus
              disabled={loading}
            />
          </label>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading || code.length !== 6 || expiresIn === 0}>
            {loading ? 'Verifying…' : expiresIn === 0 ? 'Code expired' : 'Verify and continue'}
          </Button>
        </form>

        <div className="verify-meta">
          <span>{expiresIn > 0 ? `Code expires in ${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, '0')}` : 'This code has expired.'}</span>
          <button type="button" onClick={resend} disabled={resending || resendIn > 0}>
            {resending ? 'Sending…' : resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
          </button>
        </div>

        <p className="auth-footnote">
          Wrong email? <Link href={pending.purpose === 'signup' ? '/signup' : '/login'}>Go back</Link>
        </p>
      </Card>
    </Container>
  );
}
