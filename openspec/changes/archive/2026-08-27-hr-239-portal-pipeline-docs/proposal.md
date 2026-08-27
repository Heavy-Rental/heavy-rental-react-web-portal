# Proposal: HR-239 portal pipeline callers and documentation standard

## Why

HR-239 updated React web portal deploy/CI callers (canonical GitHub org, paid CD `secrets: inherit`, Academy copy notes for `resolve-aws-profile`) without a living spec, design contract, or ADR. Existing SDD (`specification/Spec-project-environment.md`, README) still described a three-pipeline world and a stale `src/` layout. Ticket wording about ALB target-group health checks does not match what this repo implements (guest `GET /` via SSM).

## What Changes

- Adopt OpenSpec `spec-driven-with-adr`, OpenSPDD REASONS Canvas, and MADR-short ADRs as the documentation standard (ADR-0001).
- Record durable pipeline decisions (canonical repo, split CD + `resolve-aws-profile`, paid `secrets: inherit`, CD health = guest HTTP) as ADR-0002–0005.
- Align reusable CI `DEFAULT_APP_REPOSITORY` to `Heavy-Rental/heavy-rental-react-web-portal` (including Fast Feedback, which still said `SA62-team1`).
- Update `specification/Spec-project-environment.md` and README so they match live workflows.
- Index remaining product specs; do not rewrite UI SDD that is still accurate.

## Capabilities

### New Capabilities

- `documentation-system` — OpenSpec + OpenSPDD + ADR collaboration rules
- `project-environment` — runtime and scripts (OpenSpec form of environment SDD)
- `ci-pipelines` — Fast Feedback, Integration, Release, Security Report
- `portal-cd` — Academy/paid CD, AWS profile, secrets, health
- `product-features` — index of `specification/` feature SDD

### Modified Capabilities

- None (first OpenSpec baseline).

## Impact

- Docs: `openspec/`, `adr/`, `spdd/`, `specification/README.md`, `specification/Spec-project-environment.md`, `README.md`
- YAML: `.github/workflows/fast-feedback-pipeline.yml` (`DEFAULT_APP_REPOSITORY`)
- Already landed (commit `8e6007d`): integration default repo, Academy copy comments, paid `secrets: inherit`
- No application runtime or UI behavior change
