# Architecture

G64 Phase 0 is a pnpm TypeScript monorepo.

- **Web** — Next.js App Router consumer experience, with landing, account UI previews, and a non-operational portfolio shell.
- **Admin** — visually distinct Next.js internal workspace using shared primitives.
- **API** — a NestJS modular monolith. Auth, users, wallets, prices, transactions, swaps, faucet, and admin modules are inert boundaries; Health exposes only `GET /api/health`.
- **Worker** — a small validated-config process that starts healthy but schedules no work.
- **PostgreSQL** — persistent relational storage managed with Drizzle ORM; Phase 0 has only a users table.
- **Redis** — locally provisioned infrastructure reserved for health verification; no caching or queues exist.
- **Shared packages** — UI primitives/tokens, validated configuration, database schema/migrations, and transport types.

Applications remain deployment units inside one codebase; the backend is not split into microservices.

> User private keys will never be stored by the G64 backend.
