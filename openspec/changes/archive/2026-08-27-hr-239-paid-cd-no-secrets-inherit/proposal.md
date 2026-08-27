# Proposal: HR-239 paid CD must not inherit repository secrets

## Why

Semgrep `yaml.github-actions.security.secrets-inherit` flags `secrets: inherit` on `portal-cd-paid-caller.yml` as an ERROR. Inherit grants the reusable CD workflow every repository secret. Paid CD authenticates with GitHub OIDC (`vars.AWS_ROLE_TO_ASSUME`); repository-secret inherit is unnecessary and fails Security Testing.

ADR-0004 had required inherit so the reusable workflow could refuse Vocareum keys. That check already runs on the caller (`refuse-non-paid`).

## What Changes

- Remove `secrets: inherit` from `portal-cd-paid-caller.yml`. Do not pass a repository-secret map and do not use `nosemgrep`.
- Keep `refuse-non-paid` as the mixed-credential gate (fail if `AWS_ACCESS_KEY_ID` is set on `AWS_ACTUAL`).
- Accept ADR-0006 superseding ADR-0004.
- MODIFY OpenSpec `portal-cd` and environment SDD so they no longer require inherit.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `portal-cd` — paid caller MUST NOT inherit repository secrets (Semgrep + OIDC).
- `product-features` — environment index scenario must document no inherit.
- `documentation-system` — in-force OpenSPDD canvas is `spdd/README.md`; walk ADR `Supersedes:`.

## Impact

- YAML: `.github/workflows/portal-cd-paid-caller.yml`
- Docs: `adr/0006-*.md`, `openspec/specs/portal-cd`, `specification/Spec-project-environment.md`, README, OpenSPDD canvas
- No application runtime change. Paid CD still deploys via OIDC + `environment: AWS_ACTUAL` variables.
