## Summary

<!-- What does this PR do and why? -->

## Changes

-

## Security checklist

- [ ] No secrets, tokens, or `.env` files committed
- [ ] New/changed API routes have `authenticate` + the correct `requirePermission`
- [ ] No raw error messages or stack traces leaked to clients
- [ ] RBAC matrix + `docs/rbac_access_control.md` updated if permissions changed

## Verification

- [ ] `npm run build` passes
- [ ] Manual check of the affected endpoint(s)
