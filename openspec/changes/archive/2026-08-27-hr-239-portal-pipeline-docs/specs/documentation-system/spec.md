# Delta for documentation-system

## Purpose

How this repository records behavior, design contracts, and architectural decisions so humans and agents use one consistent stack: OpenSpec, OpenSPDD, and MADR.

## ADDED Requirements

### Requirement: OpenSpec is the living behavior contract

The repository MUST keep current system behavior in `openspec/specs/<capability>/spec.md` using OpenSpec requirement and scenario format. Schema MUST be `spec-driven-with-adr` in `openspec/config.yaml`.

#### Scenario: Agent reads current behavior
- GIVEN a clone of `Heavy-Rental/heavy-rental-react-web-portal`
- WHEN an agent needs the current CI/CD or documentation contract
- THEN it reads `openspec/specs/` and `openspec/config.yaml`

### Requirement: Changes follow proposal-specs-design-adr-tasks

Every behavioral or architectural change MUST produce OpenSpec artifacts in order `proposal → specs → design → adr → tasks` under `openspec/changes/<slug>/`. Durable ADRs MUST be written under `adr/` when the change introduces a long-lived decision.

#### Scenario: New pipeline change
- GIVEN an in-force documentation standard (ADR-0001)
- WHEN a change alters caller secrets, default repository, or CD health
- THEN `openspec/changes/<slug>/` contains `proposal.md`, delta specs, `design.md`, `adr.md`, and `tasks.md`

### Requirement: OpenSPDD REASONS Canvas is the implementation contract

Implementation work that is more than a one-line comment fix MUST have an OpenSPDD REASONS Canvas at `spdd/prompt/`.

#### Scenario: Docs alignment change
- GIVEN HR-239 documentation alignment
- WHEN an agent implements or updates the documentation stack
- THEN it follows `spdd/prompt/HR-239-202608271200-[Docs]-portal-pipeline-openspec-openspdd-adr.md`

### Requirement: specification/ remains mapped product SDD

Files under `specification/` MUST remain the detailed product feature SDD. On factual conflict with code or workflows, the specification file MUST be updated in the same change as the OpenSpec delta.

#### Scenario: Pipeline fact drifts
- GIVEN `specification/Spec-project-environment.md` disagrees with `.github/workflows/`
- WHEN the conflict is noticed
- THEN OpenSpec `ci-pipelines` / `portal-cd` and `Spec-project-environment.md` are updated together
