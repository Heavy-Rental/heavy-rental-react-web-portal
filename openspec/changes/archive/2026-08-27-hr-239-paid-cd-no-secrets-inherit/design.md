# Design: Paid CD no repository-secret inherit

## Context

In-force ADRs before this change: ADR-0001, ADR-0002, ADR-0003, **ADR-0004** (inherit), ADR-0005.

HR-239 had restored `secrets: inherit` on the paid caller. Security Testing Semgrep (community packs including GitHub Actions least-privilege) ERROR on that pattern.

Paid path:

- Caller `refuse-non-paid` uses `environment: AWS_ACTUAL`, checks `secrets.AWS_ACCESS_KEY_ID` is empty and `vars.AWS_ROLE_TO_ASSUME` is set.
- Reusable jobs also set `environment: AWS_ACTUAL`, so environment **variables** (OIDC role, region, image) remain available without inherit.
- Auth is `aws-actions/configure-aws-credentials` via `resolve-aws-profile` profile `AWS_ACTUAL`.

## Goals / Non-Goals

Goals:

- Semgrep `secrets-inherit` clean on the paid caller.
- Paid CD still runs (OIDC + environment vars).
- Docs/ADRs/OpenSPDD match YAML.

Non-goals:

- Changing Academy CD (still input-driven Vocareum keys).
- Declaring unused `AWS_*` secrets on `workflow_call` “just in case.”
- Suppressing Semgrep with `nosemgrep`.

## Decisions

### Decision: Omit secrets on the paid reusable call

Restore the HR-232 comment: OIDC needs no repository secrets. Caller refusal remains the Vocareum-key gate.

Alternatives: (a) explicit `secrets:` map of AWS keys — still widens the reusable workflow’s secret surface and contradicts “OIDC only”; (b) `nosemgrep` — hides the finding without reducing privilege.

### Decision: Supersede ADR-0004, do not edit it

ADR-0006 is accepted with `Supersedes: adr/0004-paid-portal-cd-inherits-github-secrets.md`. ADR-0004 file is frozen.

## Risks / Trade-offs

- [Reusable workflow cannot read repository-level secrets on paid] → Mitigation: none needed; paid must not use them. If a named secret is required later, pass only that key on both `workflow_call` and the caller.
- [Environment secrets on AWS_ACTUAL still visible to jobs with `environment:`] → Mitigation: `refuse-non-paid` fails if `AWS_ACCESS_KEY_ID` is set on that environment.

## Migration Plan

1. Delete `secrets: inherit` from the paid caller; document OIDC + Semgrep in comments.
2. Add ADR-0006; update `adr/README.md` in-force index.
3. MODIFY `openspec/specs/portal-cd`; update `Spec-project-environment.md` and README.
4. OpenSPDD `/spdd-sync`: new canvas for this fix; stamp the previous canvas so it cannot restore inherit.
5. Archive this change.

Rollback: restoring inherit re-breaks Semgrep and contradicts ADR-0006 (would need a new superseding ADR).

## Open Questions

None.
