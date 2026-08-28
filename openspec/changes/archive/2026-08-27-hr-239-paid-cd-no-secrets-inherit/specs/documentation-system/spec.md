# Delta for documentation-system

## MODIFIED Requirements

### Requirement: OpenSPDD REASONS Canvas is the implementation contract

Implementation work that is more than a one-line comment fix MUST have an OpenSPDD REASONS Canvas at `spdd/prompt/` (and analysis at `spdd/analysis/` when the change is cross-cutting). Canvas sections MUST include Requirements, Entities, Approach, Structure, Operations, Norms, and Safeguards. The in-force canvas is the one listed in `spdd/README.md`. Agents MUST walk `adr/` `Supersedes:` so superseded ADRs are not applied.

#### Scenario: Docs alignment change
- GIVEN HR-239 documentation alignment
- WHEN an agent implements or updates the documentation stack
- THEN it follows the in-force canvas listed in `spdd/README.md` (currently `HR-239-202608272000-[Fix]-ci-paid-cd-no-secrets-inherit.md` for paid secrets)
- AND it does not invent a second documentation tree outside `openspec/`, `adr/`, `spdd/`, and `specification/`
- AND it walks `adr/` `Supersedes:` links so superseded ADRs (for example ADR-0004) are not treated as in force
