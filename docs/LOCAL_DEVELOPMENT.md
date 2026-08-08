# Local development

1. Install Node.js 24 LTS and pnpm 10.
2. Run `cp .env.example .env` and `pnpm install`.
3. Start PostgreSQL and Redis with `pnpm infra:up`.
4. Apply schema changes with `pnpm db:migrate`.
5. Start everything with `pnpm dev`, or target one workspace with `pnpm --filter <workspace> dev`.

Ports: web `3000`, admin `3001`, API `4000`, PostgreSQL `5432`, Redis `6379`. Verify the API at `curl http://localhost:4000/api/health`. Stop infrastructure using `pnpm infra:down`.
