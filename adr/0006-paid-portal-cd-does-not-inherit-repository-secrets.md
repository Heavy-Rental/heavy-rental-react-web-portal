# ADR-0006: Paid portal CD does not inherit repository secrets

- Status: accepted, supersedes ADR-0004
- Date: 2026-08-27
- Tags: cd, github-actions, secrets, oidc, semgrep
- Supersedes: adr/0004-paid-portal-cd-inherits-github-secrets.md

## Context

ADR-0004 required `secrets: inherit` on `portal-cd-paid-caller.yml` so `web-portal-cd-academy.yml` could read `secrets.AWS_ACCESS_KEY_ID` (refuse Vocareum keys on `AWS_ACTUAL`) and Environment fallbacks. That restore tripped Semgrep `yaml.github-actions.security.secrets-inherit` (ERROR in this repo’s Security Testing pack): inherit grants the called workflow every repository secret, which violates least privilege.

Paid CD authenticates with GitHub OIDC (`vars.AWS_ROLE_TO_ASSUME` + `id-token: write`). The caller job `refuse-non-paid` already runs with `environment: AWS_ACTUAL` and fails if `secrets.AWS_ACCESS_KEY_ID` is set. Reusable-workflow jobs that specify `environment: AWS_ACTUAL` still receive that environment’s **variables** (and environment-scoped secrets, if any) without repository-secret inherit.

## Decision

`portal-cd-paid-caller.yml` MUST NOT use `secrets: inherit` and MUST NOT pass a repository-secret map into `web-portal-cd-academy.yml`. Mixed-credential refusal stays on the caller (`refuse-non-paid`). OIDC remains the only paid auth path.

Do not “fix” Semgrep with `nosemgrep` or by passing unused AWS keys “just in case.” If a future paid secret is truly required, add an explicit `secrets:` map of only that name on both the caller and `workflow_call` (still no inherit).

## Consequences

- Semgrep `secrets-inherit` no longer fires on the paid CD caller.
- The reusable workflow cannot see repository-level secrets on the paid path; that is intended.
- Environment `AWS_ACTUAL` variables such as `AWS_ROLE_TO_ASSUME` continue to work because CD jobs set `environment:`.
- ADR-0004 is historical only. Designs MUST follow this ADR.
