# ADR-0001: Adopt OpenSpec, OpenSPDD, and MADR as the documentation standard

- Status: accepted
- Date: 2026-08-27
- Tags: documentation, openspec, openspdd, adr

## Context

Product behavior lived in `specification/*.md` (informal SDD). Pipeline and architecture decisions lived in GitHub Actions comments, commit messages, and ticket titles. That mix drifted: `Spec-project-environment.md` still described three CI pipelines after Academy/paid CD, security-report, and caller gates existed; README layout no longer matched `src/`; HR-239 pipeline caller changes had no spec, no design contract, and no durable decision record.

OpenSpec's default `spec-driven` schema archives `design.md` with the change, so architectural rationale disappears from the living tree. OpenSPDD's REASONS Canvas is an executable design contract (norms + safeguards), which specs and ADRs do not replace.

## Decision

Use three complementary artifacts, all in this repository:

1. **OpenSpec** with schema `spec-driven-with-adr` (`openspec/config.yaml`). Living behavior is `openspec/specs/`. Each change uses `proposal → specs → design → adr → tasks`.
2. **OpenSPDD** REASONS Canvas under `spdd/analysis/` and `spdd/prompt/` for implementation contracts (Requirements, Entities, Approach, Structure, Operations, Norms, Safeguards).
3. **MADR-short ADRs** under `adr/NNNN-kebab-title.md`. Accepted ADRs are immutable. Change-local `openspec/changes/<change>/adr.md` is a review manifest only.

`specification/` remains the detailed product SDD. OpenSpec `product-features` maps each file. On conflict, the running code / workflow YAML wins; then OpenSpec specs; then `specification/` is updated in the same change.

## Consequences

- Future pipeline or architecture work MUST add or supersede ADRs and OpenSpec deltas before treating docs as done.
- Agents MUST read in-force ADRs during design.
- We accept extra ceremony on small UI tweaks: those changes MAY skip a new durable ADR (manifest records "none") but MUST NOT contradict in-force ADRs.
- Duplicate narrative across OpenSpec, OpenSPDD, and `specification/` is a maintenance cost; the mapping in `specification/README.md` and `openspec/specs/product-features/spec.md` is the consistency check.
