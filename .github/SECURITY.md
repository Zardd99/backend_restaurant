# Security Policy

## Supported versions

The `main` branch and the current production deployment (Railway) are supported.

## Reporting a vulnerability

Please **do not open a public issue** for security vulnerabilities.

- Email: lqykim275@gmail.com
- Or use GitHub's private **"Report a vulnerability"** (Security → Advisories).

Include: affected component, reproduction steps, impact, and any suggested fix.
We aim to acknowledge within 72 hours.

## Handling secrets

- Never commit `.env` files or credentials. Production secrets live in the
  **Railway Variables** dashboard (see [docs/security_production.md](../docs/security_production.md)).
- Secret scanning (gitleaks) runs on every push/PR. If a secret is ever
  committed, **rotate it immediately** — removing the commit is not enough.

## Authentication & authorization

- Access control is centralized in [config/rbac.ts](../config/rbac.ts) and
  enforced by the `requirePermission` middleware in [middleware/auth.ts](../middleware/auth.ts).
  See the [RBAC access graph](../docs/rbac_access_control.md).
- Public self-registration can only create `customer` accounts. Staff roles are
  assigned exclusively through the admin-only users API.
