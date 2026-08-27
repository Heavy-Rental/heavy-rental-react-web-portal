# Delta for product-features

## MODIFIED Requirements

### Requirement: Environment spec tracks pipelines

`specification/Spec-project-environment.md` MUST describe the same pipeline set as `openspec/specs/ci-pipelines/spec.md` and `openspec/specs/portal-cd/spec.md` (Fast Feedback, Integration, Release, Security Report, Academy CD, paid CD). Paid CD MUST be documented as OIDC without `secrets: inherit` (ADR-0006).

#### Scenario: Pipeline count
- GIVEN `Spec-project-environment.md`
- WHEN a contributor reads CI/CD requirements
- THEN they are not told that only three caller pairs exist
- AND Academy vs paid CD, no `secrets: inherit` on paid CD, and `Heavy-Rental/...` defaults are documented
