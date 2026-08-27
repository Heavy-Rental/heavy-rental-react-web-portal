# Delta for product-features

## Purpose

Index of product SDD under `specification/`.

## ADDED Requirements

### Requirement: Feature specs are enumerated and current

The product SDD set MUST match `specification/README.md`. Adding, renaming, or retiring a feature spec MUST update that README and this capability in the same change.

#### Scenario: Contributor finds the index
- GIVEN the repository root
- WHEN they open `specification/README.md` or `openspec/specs/product-features/spec.md`
- THEN every feature spec file is listed

### Requirement: Environment spec tracks pipelines

`specification/Spec-project-environment.md` MUST describe the same pipeline set as `openspec/specs/ci-pipelines/spec.md` and `openspec/specs/portal-cd/spec.md`.

#### Scenario: Pipeline count
- GIVEN `Spec-project-environment.md`
- WHEN a contributor reads CI/CD requirements
- THEN they are not told that only three caller pairs exist
