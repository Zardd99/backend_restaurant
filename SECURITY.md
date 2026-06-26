# Security Policy

## Reporting a Vulnerability

Please **do not** open a public issue for security problems.

Report vulnerabilities privately via GitHub's **"Report a vulnerability"** button
under this repository's **Security** tab (Private vulnerability reporting), or by
emailing the maintainer. You can expect an initial acknowledgement within
**72 hours** and a remediation plan once the report is triaged.

## Supported Versions

Only the latest released state of the `main` branch is supported with security
updates.

## Handling Secrets

- Never commit credentials. Secret scanning **push protection** is enabled on
  this repository and will block pushes containing detected secrets.
- Runtime configuration (`MONGODB_URI`, `JWT_SECRET`, `SMTP_*`, Upstash Redis
  tokens, etc.) lives in the deployment provider's environment dashboard, never
  in the repository.
- If a secret is ever exposed, **rotate it immediately** and purge it from
  history before considering the incident resolved.
