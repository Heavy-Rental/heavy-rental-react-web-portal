# Design: HR-239 portal pipeline docs and caller alignment

## Context

Branch `HR-239-update-react-web-portal-deploy-pipeline-with-alb-target-group-heath-check-fix`. Code already on the branch:

- `integration-pipeline.yml` default repo `Heavy-Rental/heavy-rental-react-web-portal`
- Academy CD comments use `resolve-aws-profile`; do not copy `resolve-vocareum-aws`
- Paid CD job has `secrets: inherit`

`fast-feedback-pipeline.yml` still defaulted to `SA62-team1/...`. `release-pipeline.yml` already used `Heavy-Rental`. Portal CD `verify` curls guest `GET /`; it does not change ALB target groups.

In-force ADRs before this change: none.

## Goals / Non-Goals

Goals:

- One documentation stack agents can follow (OpenSpec behavior, OpenSPDD contract, MADR why).
- Specs that match YAML, including Fast Feedback org default.
- Explicit statement that ALB TG health is infra, not this CD job.

Non-goals:

- Rewriting every product `Spec-*.md` into OpenSpec deltas.
- Terraform / target-group health-check code.
- Removing leftover `resolve-vocareum-aws` from the tree (unused, not CD).
- Deleting template leftovers (`BLANK_README.md`, generic `CHANGELOG.md`).

## Decisions

### Decision: Three-layer docs, not a single folder

OpenSpec specs describe observable behavior. OpenSPDD canvases bind implementation (file paths, workflow keys, safeguards). ADRs persist why. `specification/` stays as historical product SDD with an index.

Alternatives: (a) convert all SDD into OpenSpec only — high rewrite cost, loses existing review history; (b) ADRs only — no testable scenarios; (c) OpenSPDD only — no living behavior archive.

### Decision: Archive this change as the baseline

There were no prior `openspec/specs/`. Requirements are written as current-state specs and this folder is archived so the next change uses deltas.

### Decision: Fix Fast Feedback default repo in the same change

Leaving `SA62-team1` in Fast Feedback would make ADR-0002 and `ci-pipelines` immediately false. Same-repo callers ignore the default, so the YAML edit is consistency, not a PR-CI behavior change.

### Decision: Do not claim ALB TG health is implemented here

Document actual `verify` behavior and record ADR-0005 so the ticket title cannot override the code.

## Risks / Trade-offs

- [Duplicate sources] → Mitigation: conflict rule in `openspec/config.yaml` (code/YAML, then OpenSpec, then `specification/`).
- [Agents ignore ADRs] → Mitigation: config `rules.design` and ADR-0001; change-local `adr.md` lists in-force files.
- [Product specs still informal] → Mitigation: `product-features` index; migrate per change when those features move.

## Migration Plan

1. Add `openspec/config.yaml`, specs, ADRs, OpenSPDD analysis + canvas.
2. Align Fast Feedback `DEFAULT_APP_REPOSITORY`.
3. Update `Spec-project-environment.md` and README.
4. Archive this change under `openspec/changes/archive/2026-08-27-hr-239-portal-pipeline-docs/`.

Rollback: delete the new doc trees and revert the Fast Feedback one-line default; pipeline callers from `8e6007d` stay.

## Open Questions

None remaining. ALB TG configuration stays in infra by ADR-0005.
