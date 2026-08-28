# ADR-0003: Split portal CD into Academy and paid callers over resolve-aws-profile

- Status: accepted
- Date: 2026-08-27
- Tags: cd, aws, oidc, academy

## Context

Portal app CD must run in AWS Academy (Vocareum Learner Lab keys + session token) and in a billed account (GitHub OIDC, `AWS_ROLE_TO_ASSUME`). Mixing those credential styles is unsafe: Vocareum keys on `AWS_ACTUAL`, or OIDC on Academy, either fail or confuse operators. An older composite action `resolve-vocareum-aws` only understood Academy keys. A later action `resolve-aws-profile` selects Academy keys vs paid OIDC and refuses mixed secrets.

## Decision

- Two dispatch callers: `portal-cd-academy-caller.yml` (environment `academy` only) and `portal-cd-paid-caller.yml` (environment `AWS_ACTUAL` only).
- Both call the same reusable workflow `web-portal-cd-academy.yml`.
- AWS authentication in that reusable workflow MUST use `.github/actions/resolve-aws-profile`.
- Do not copy or invoke `.github/actions/resolve-vocareum-aws` on the portal CD path. That action may remain in the tree as unused legacy; it is not part of portal CD.

## Consequences

- Install/copy comments on Academy CD MUST list `resolve-aws-profile`, not `resolve-vocareum-aws`.
- Adding a third AWS profile requires extending `resolve-aws-profile` (or a superseding ADR), not a third copy of the compose playbook.
- Terraform / infra apply stays out of portal CD (compose + nginx + health only).
