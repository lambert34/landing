# G64 v0.1

**Current stage: Phase 0 — Foundation**

G64 is the foundation of an international, non-custodial digital-asset platform. This repository implements **Phase 0 only**: application shells, modular backend structure, shared packages, and local infrastructure. It does not implement accounts, asset operations, custody, or blockchain connectivity.

## Requirements

- Node.js 24 LTS
- pnpm 10.28.1
- Docker with Compose for local PostgreSQL, Redis, and database migrations

## Get started

```bash
cp .env.example .env
pnpm install
pnpm infra:up
pnpm db:migrate
pnpm dev
```

The consumer web app runs at `http://localhost:3000`, admin at `http://localhost:3001`, and API at `http://localhost:4000/api`.

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Use `pnpm --filter @g64/web dev`, `pnpm --filter @g64/admin dev`, `pnpm --filter @g64/api dev`, or `pnpm --filter @g64/worker dev` to run one application. See [local development](docs/LOCAL_DEVELOPMENT.md) and [architecture](docs/ARCHITECTURE.md).
