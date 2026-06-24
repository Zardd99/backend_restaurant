# Production Security Hardening

Checklist for keeping the deployed system safe. Pair with the
[RBAC access graph](./rbac_access_control.md) and the repo
[SECURITY.md](../.github/SECURITY.md).

## What's enforced in code

- **Security headers** — `helmet` + `x-powered-by` disabled ([server.ts](../server.ts)).
- **Boot-time env validation** — server refuses to start without `JWT_SECRET` / `MONGO_URI`; warns on weak secret.
- **Rate limiting** — global throttle (2000 / 15 min per IP) + strict auth throttle (10 / 15 min) on `/api/auth/login` and `/register`.
- **No error leakage** — auth/user controllers and the global handler return generic messages; details are logged server-side only.
- **AuthZ** — every router uses `authenticate` + `requirePermission`; public self-registration can only create `customer`.
- **Body size limits** — JSON/urlencoded capped at 1 MB.
- **Cookies** — token cookie is `sameSite=strict` and `secure` over HTTPS (7-day lifetime matching the JWT).

## Backend (Railway)

- [ ] `NODE_ENV=production`.
- [ ] All secrets set in the **Railway Variables** dashboard, never in a committed `.env`:
      `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRE` (e.g. `7d`), `SMTP_*`,
      `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ADMIN_EMAIL`, `MANAGER_EMAIL`.
- [ ] `JWT_SECRET` is a long (≥ 32 char) random string; **rotate** it (invalidates existing tokens).
- [ ] `CORS_ORIGIN` set to the exact Vercel domain; remove ngrok/localhost regexes before going fully public.
- [ ] HTTPS only (Railway provides TLS) — no plaintext endpoints.

## Frontend (Vercel)

- [ ] `NEXT_PUBLIC_API_URL` set with the `https://` prefix.
- [ ] No secrets in `NEXT_PUBLIC_*` vars (these reach the browser).

## Database (MongoDB Atlas)

- [ ] IP allowlist restricted to Railway egress (not `0.0.0.0/0`).
- [ ] Dedicated least-privilege DB user (readWrite on the app DB only).
- [ ] Backups / point-in-time recovery enabled.

## GitHub

- [ ] Branch protection on `main` per [branch-protection.md](../.github/docs/branch-protection.md).
- [ ] Secret scanning + push protection ON; Dependabot alerts ON.
- [ ] CI, CodeQL, and gitleaks checks required to merge.

## Periodic

- [ ] Triage Dependabot PRs weekly; run `npm audit` and fix high/critical.
- [ ] Rotate `JWT_SECRET` and SMTP credentials on a schedule or after any suspected exposure.
- [ ] Re-confirm no `.env` is tracked: `git ls-files | grep -i .env` returns nothing.
