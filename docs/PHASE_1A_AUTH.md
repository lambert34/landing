# Phase 1A authentication

## Architecture and flows

The existing NestJS modular monolith owns passwordless email authentication. `POST /api/auth/otp/request` normalizes an email, applies Redis limits, stores an HMAC digest challenge in PostgreSQL, and sends a six-digit code through SMTP. Login requests for unknown accounts return the same challenge contract but send no mail. `POST /api/auth/otp/verify` locks and atomically consumes the challenge, creates a signup user or updates an existing login user, and creates an opaque server-side session in the same transaction. `GET /api/auth/session` resolves the cookie; `POST /api/auth/logout` validates Origin, revokes the session, and clears it.

## Storage and security

- `auth_challenges`: normalized email, purpose, HMAC-SHA256 digest, expiry, attempts, and consumption time. Plain OTPs are never persisted or logged.
- `sessions`: user relation and SHA-256 token hash, expiry, last-seen, and revocation. The 32-byte raw token exists only in the HttpOnly cookie.
- `auth_audit_events`: security event name, optional user, and keyed subject hash; it contains no authentication secret.
- Redis keys contain HMAC identifiers, never raw email/IP. Atomic scripts enforce one request/60 seconds/email, five/15 minutes/email, and twenty/hour/IP.
- Production cookies are `HttpOnly; Secure; SameSite=Lax; Path=/; Domain=.crypto-g64.ru`. Development omits Domain and Secure. Credentialed CORS permits only `WEB_URL`.

## Environment

Copy `.env.example`. Use independent random secrets of at least 32 bytes for `OTP_PEPPER` and `RATE_LIMIT_PEPPER`. Configure standard `DATABASE_URL` (a TLS pooled URL in serverless production), `REDIS_URL`, `WEB_URL`, SMTP variables, cookie domain/name, and TTLs. Production validation fails fast when secrets, SMTP credentials, URLs, or the `.crypto-g64.ru` cookie domain are missing/insecure.

## Local development and testing

Run `pnpm infra:up`, `pnpm db:migrate`, then `pnpm dev`. Mailpit receives SMTP on `localhost:1025`; its local-only inbox is <http://localhost:8025>. Request a signup OTP, read it in Mailpit, verify it, then request a login OTP for that account. Tests inject repository, rate-limit, and mail doubles and require no cloud service. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## Production deployment checklist

1. Create (do not repurpose the frontend) Vercel project `g64-api` from `lambert34/landing`, Root Directory `apps/api`.
2. Attach a Marketplace-compatible PostgreSQL provider and standard Redis provider near API compute. Require TLS and use a pooled PostgreSQL connection string.
3. Configure all documented environment variables and a production SMTP account; never deploy Mailpit.
4. Deploy, run migrations as a controlled release step, verify `/api/health` and `/api/health/ready`, then attach `api.crypto-g64.ru` manually.
5. Set `WEB_URL=https://crypto-g64.ru`, `API_URL=https://api.crypto-g64.ru`, and later expose that API URL to the frontend. `crypto-g64.ru` is the canonical public site; `www.crypto-g64.ru` should only redirect to it. DNS and production resources are intentionally not created here.

## Phase 1B handoff

Phase 1B may connect signup/login UI with credentialed requests to these contracts. Phase 1A does not change frontend authentication behavior and includes no wallet, blockchain RPC, mnemonic, private-key, or signing implementation.
