'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { BrandLogo, Button, Card, Container, Input, PageHeader } from '@g64/ui';
import {
  authErrorMessage,
  getSession,
  requestOtp,
  savePendingAuth,
  type AuthPurpose,
} from '../lib/auth';

const copy = {
  signup: {
    eyebrow: 'Create account',
    title: 'Start with G64',
    description: 'Enter your email. We’ll send you a one-time verification code.',
    submit: 'Continue',
    footer: 'Already have an account?',
    footerLink: 'Sign in',
    footerHref: '/login',
  },
  login: {
    eyebrow: 'Sign in',
    title: 'Welcome back',
    description: 'Enter your email. We’ll send you a one-time verification code.',
    submit: 'Continue',
    footer: 'New to G64?',
    footerLink: 'Create account',
    footerHref: '/signup',
  },
} as const;

export function AuthEmailForm({ purpose }: { purpose: AuthPurpose }) {
  const router = useRouter();
  const content = copy[purpose];
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getSession()
      .then((session) => {
        if (active && session.authenticated) router.replace('/wallet');
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const normalized = email.trim().toLowerCase();
    if (!normalized) return;

    setLoading(true);
    setError('');

    try {
      const response = await requestOtp(normalized, purpose);
      savePendingAuth(normalized, purpose, response);
      router.push('/verify');
    } catch (requestError) {
      setError(authErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container className="auth-page">
      <Link href="/" className="auth-brand" aria-label="G64 home">
        <BrandLogo imageSrc="/brand/logo.svg" />
      </Link>

      <Card className="auth-card">
        <PageHeader
          eyebrow={content.eyebrow}
          title={content.title}
          description={content.description}
        />

        <form onSubmit={submit}>
          <label>
            Email address
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
              disabled={loading || checkingSession}
            />
          </label>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading || checkingSession || !email.trim()}>
            {loading ? 'Sending code…' : checkingSession ? 'Checking session…' : content.submit}
          </Button>
        </form>

        <p className="auth-footnote">
          {content.footer}{' '}
          <Link href={content.footerHref}>{content.footerLink}</Link>
        </p>
        <p className="auth-security-note">No password. Your verification code expires in 10 minutes.</p>
      </Card>
    </Container>
  );
}
