# ADR Review Manifest

## ADR Review Completed

- Date: 2026-08-27
- Reviewer: HR-239 paid CD Semgrep secrets-inherit fix
- Change: `hr-239-paid-cd-no-secrets-inherit`

## In-Force ADR Context Reviewed

- `adr/0001-adopt-openspec-openspdd-and-madr.md` — documentation stack
- `adr/0002-canonical-github-repository-heavy-rental.md` — canonical repo
- `adr/0003-split-portal-cd-academy-and-paid-via-resolve-aws-profile.md` — split CD + `resolve-aws-profile`
- `adr/0004-paid-portal-cd-inherits-github-secrets.md` — **superseded by this change**
- `adr/0005-portal-cd-health-is-guest-http-not-alb-target-group.md` — CD health unchanged

## Repository-Level ADRs Created

- `adr/0006-paid-portal-cd-does-not-inherit-repository-secrets.md` — paid CD MUST NOT use `secrets: inherit`; OIDC + caller `refuse-non-paid`

## Notes

ADR-0004 file was not edited. In-force set is ADR-0001, 0002, 0003, 0005, 0006.
