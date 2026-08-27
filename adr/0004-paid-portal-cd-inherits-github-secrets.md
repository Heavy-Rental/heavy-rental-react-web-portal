# ADR-0004: Paid portal CD caller inherits GitHub secrets

- Status: accepted
- Date: 2026-08-27
- Tags: cd, github-actions, secrets, oidc

## Context

Paid CD authenticates with GitHub OIDC (`vars.AWS_ROLE_TO_ASSUME`). HR-232 dropped `secrets: inherit` on `portal-cd-paid-caller.yml` for least privilege, on the assumption the reusable workflow needed no repository secrets. The reusable workflow still reads `secrets.AWS_ACCESS_KEY_ID` (to refuse Vocareum keys on `AWS_ACTUAL`) and Environment secrets as fallbacks. Without inherit, those values are empty in the called workflow, so the refuse-mixed-secrets check and Environment fallbacks cannot run as designed.

Academy CD passes Vocareum keys as `workflow_dispatch` inputs on the caller, so it does not use `secrets: inherit`.

## Decision

`portal-cd-paid-caller.yml` MUST pass `secrets: inherit` into `web-portal-cd-academy.yml`. Do not restore the "OIDC needs no secrets" comment as if inherit were forbidden. Academy CD remains input-driven and does not inherit secrets unless a later ADR says otherwise.

## Consequences

- Paid CD can read Environment `AWS_ACTUAL` variables/secrets inside the reusable workflow.
- The reusable workflow can fail closed if `AWS_ACCESS_KEY_ID` is present on paid.
- Least-privilege is weaker than HR-232's no-inherit experiment; that experiment is reversed here. A future tightening MUST keep the refuse-Vocareum-keys check working (explicit `secrets:` map or inherit).
