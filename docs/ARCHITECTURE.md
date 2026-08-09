# Architecture

G64 is a pnpm TypeScript monorepo. Web and admin are Next.js deployments; API remains one NestJS modular monolith; PostgreSQL is the durable system of record through Drizzle; Redis supplies distributed ephemeral controls; shared packages contain UI, validated configuration, database schema, and transport contracts.

Phase 1A activates the existing Auth module with passwordless OTP, SMTP delivery, opaque server-side sessions, audit events, and Redis rate limiting. Database and Redis are reusable API infrastructure modules. The API remains independently deployable and exposes liveness plus database/Redis readiness. It is provider-neutral and consumes standard PostgreSQL, Redis, and SMTP connection settings.

No microservices or filesystem/process-memory authentication state is introduced. Frontend integration and all wallet/blockchain capabilities remain outside Phase 1A.
