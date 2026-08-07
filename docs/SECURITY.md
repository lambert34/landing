# Security principles

Phase 0 establishes boundaries rather than implementing asset or identity security.

- The backend never stores user private keys, recovery material, or signing secrets.
- Environment variables are validated at runtime; real secrets are excluded from source control.
- PostgreSQL is the system of record and schemas are changed through reviewed migrations.
- Inputs introduced in later phases must be validated at trust boundaries with least-privilege access.
- Dependencies remain minimal and CI enforces lint, strict types, tests, and production builds.
- No analytics, third-party scripts, custody, network integrations, or asset operations are present.
- Local Docker credentials are development-only and must never be reused in deployed environments.

Security-sensitive functionality requires separate threat modelling and review in its own phase.
