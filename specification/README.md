# Specifications

Product and environment SDD for the Heavy Rental React web portal.

This folder is **detailed feature SDD**. Living behavior contracts, change proposals, and architectural why live in:

| Layer | Path | Standard |
| --- | --- | --- |
| What (behavior) | [`openspec/specs/`](../openspec/specs/) | OpenSpec `spec-driven-with-adr` |
| How (implementation contract) | [`spdd/prompt/`](../spdd/prompt/) | OpenSPDD REASONS Canvas |
| Why (architecture) | [`adr/`](../adr/) | MADR-short ADRs |

On conflict: running code / `.github/workflows/` wins, then OpenSpec specs, then this folder. Fix the stale file in the same change.

Canonical GitHub repository: `Heavy-Rental/heavy-rental-react-web-portal`.

## Environment and delivery

| Spec | Role | OpenSpec capability |
| --- | --- | --- |
| [Spec-project-environment.md](Spec-project-environment.md) | Node 22, npm scripts, GitHub Flow CI/CD + portal CD (paid CD: OIDC, no `secrets: inherit`, ADR-0006) | `project-environment`, `ci-pipelines`, `portal-cd` |

## Product UI and booking

| Spec | Role |
| --- | --- |
| [Spec-ui-heavy-machinery-portal.md](Spec-ui-heavy-machinery-portal.md) | Singapore UI business rules |
| [Spec-equipment-card-detail-changes.md](Spec-equipment-card-detail-changes.md) | Equipment card / detail |
| [Spec-browse-equipment-date-validation.md](Spec-browse-equipment-date-validation.md) | Browse date validation |
| [features/Spec-rental-plan-cart-checkout.md](features/Spec-rental-plan-cart-checkout.md) | Rental plan cart checkout |
| [features/ask-rental-plan-optional-site-address.md](features/ask-rental-plan-optional-site-address.md) | Optional site address |
| [Spec-site-address-postal-code-validation.md](Spec-site-address-postal-code-validation.md) | Postal code validation |
| [features/postal-code-validation-execution-plan.md](features/postal-code-validation-execution-plan.md) | Postal code execution plan |
| [features/spring contract/postal-code-validation.md](features/spring%20contract/postal-code-validation.md) | Spring postal-code contract |
| [features/spring contract/rental-plan-site-address.md](features/spring%20contract/rental-plan-site-address.md) | Spring site-address contract |

## API, auth, mock, payments

| Spec | Role |
| --- | --- |
| [Spec-frontend-api-integration.md](Spec-frontend-api-integration.md) | Vite proxy / API mode |
| [features/api-contract-for-frontend.md](features/api-contract-for-frontend.md) | Frontend API contract |
| [Spec-rest-api-reference.md](Spec-rest-api-reference.md) | REST reference |
| [Spec-frontend-authentication.md](Spec-frontend-authentication.md) | Auth session |
| [Spec-login-logout-manual-test-guide.md](Spec-login-logout-manual-test-guide.md) | Login/logout test guide |
| [Spec-mock-api-server.md](Spec-mock-api-server.md) | Mock API (VS Code extension) |
| [Spec-stripe-payment-checkout.md](Spec-stripe-payment-checkout.md) | Stripe deposit checkout |
| [Spec-dynamic-pricing-e2e.md](Spec-dynamic-pricing-e2e.md) | Dynamic pricing E2E |
| [Spec-cart-hydration-and-duplicate-add-fixes.md](Spec-cart-hydration-and-duplicate-add-fixes.md) | Cart hydration |

## Admin, employee, customer bugfixes

| Spec | Role |
| --- | --- |
| [Spec-admin-asset-records.md](Spec-admin-asset-records.md) | Admin assets |
| [Spec-admin-dashboard-api-mode-fixes.md](Spec-admin-dashboard-api-mode-fixes.md) | Admin API-mode fixes |
| [Spec-admin-overview-real-data-wiring.md](Spec-admin-overview-real-data-wiring.md) | Admin overview wiring |
| [Spec-asset-records-maintenance-status-fix.md](Spec-asset-records-maintenance-status-fix.md) | Maintenance status |
| [Spec-customer-portal-bugfixes.md](Spec-customer-portal-bugfixes.md) | Customer portal bugfixes |

OpenSpec index: [`openspec/specs/product-features/spec.md`](../openspec/specs/product-features/spec.md).
