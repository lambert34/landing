# Security principles

- G64 authentication is passwordless; passwords are not collected or stored.
- OTP plaintext is never stored or logged. PostgreSQL stores only HMAC-SHA256 digests keyed by a server-only pepper; challenges expire, lock after five attempts, and are atomically consumed to prevent replay.
- Raw high-entropy session tokens are never stored. PostgreSQL stores SHA-256 hashes, authentication state is server-side, and logout revokes the record.
- Session cookies are HttpOnly, Secure in production, SameSite=Lax, and inaccessible to application JavaScript. Auth tokens must never be put in localStorage, sessionStorage, or IndexedDB.
- Redis rate-limit keys use keyed hashes rather than plaintext email/IP. Authenticated mutations validate Origin, and credentialed CORS is restricted to `WEB_URL`.
- Logs and audit events exclude OTPs, cookies, tokens, peppers, credentials, and connection URLs.
- Private wallet keys and all blockchain key management remain out of scope. Phase 1A contains no mnemonic, signing, custody, or blockchain implementation.

Production secrets belong only in deployment environment variables. PostgreSQL is changed through reviewed migrations, dependencies remain minimal, and CI enforces lint, strict types, tests, and builds.
