# Product Features Specification

## Purpose

Index of product SDD under `specification/`. OpenSpec does not duplicate every UI requirement; each file below remains the detailed contract for that feature. Agents MUST load the linked file before changing that area.

## Requirements

### Requirement: Feature specs are enumerated and current

The product SDD set MUST match `specification/README.md`. Adding, renaming, or retiring a feature spec MUST update that README and this requirement's scenario list in the same change.

#### Scenario: Contributor finds the index
- GIVEN the repository root
- WHEN they open `specification/README.md` or `openspec/specs/product-features/spec.md`
- THEN every `specification/Spec-*.md` and `specification/features/**/*.md` is listed with its role

### Requirement: UI and booking business rules

Customer and admin UI MUST follow `specification/Spec-ui-heavy-machinery-portal.md` (catalog types, one booking = one delivery and return, shared dates, 30% deposit, full payment two days before delivery, one rental plan per user).

#### Scenario: Deposit rate
- GIVEN a quote total
- WHEN deposit is calculated in the portal
- THEN the amount is 30% of the rental value as specified in `Spec-ui-heavy-machinery-portal.md`

### Requirement: API, auth, mock, and checkout contracts

Frontend API integration, authentication, mock server, REST reference, Stripe checkout, cart, postal-code, admin, and related bugfix specs MUST remain the source of detailed behavior as listed in `specification/README.md`.

#### Scenario: Stripe checkout change
- GIVEN a change to deposit payment
- WHEN an agent implements it
- THEN it reads `specification/Spec-stripe-payment-checkout.md` and related feature specs
- AND it adds an OpenSpec delta if the observable contract changes

### Requirement: Environment spec tracks pipelines

`specification/Spec-project-environment.md` MUST describe the same pipeline set as `openspec/specs/ci-pipelines/spec.md` and `openspec/specs/portal-cd/spec.md` (Fast Feedback, Integration, Release, Security Report, Academy CD, paid CD). Paid CD MUST be documented as GitHub OIDC without `secrets: inherit` (ADR-0006).

#### Scenario: Pipeline count
- GIVEN `Spec-project-environment.md`
- WHEN a contributor reads CI/CD requirements
- THEN they are not told that only three caller pairs exist
- AND Academy vs paid CD, no `secrets: inherit` on paid CD, and `Heavy-Rental/...` defaults are documented
