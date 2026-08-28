# ADR-0002: Canonical GitHub repository is Heavy-Rental/heavy-rental-react-web-portal

- Status: accepted
- Date: 2026-08-27
- Tags: ci, github, repository

## Context

Reusable CI workflows (`integration-pipeline.yml`, `fast-feedback-pipeline.yml`, `release-pipeline.yml`) carry `DEFAULT_APP_REPOSITORY` for remote-override checkout when a caller is not the portal repo itself. After the move to the `Heavy-Rental` GitHub organization, some workflows still defaulted to `SA62-team1/heavy-rental-react-web-portal`. Same-repo callers ignore the default (`github.repository` + `github.sha`), so day-to-day PR CI still worked, but remote overrides, copied pipeline comments, and docs could target a stale fork.

## Decision

The canonical application repository is `Heavy-Rental/heavy-rental-react-web-portal`. Every reusable workflow `DEFAULT_APP_REPOSITORY` MUST use that owner/name. Documentation, OpenSpec specs, and copy-install comments MUST use the same string. `SA62-team1/heavy-rental-react-web-portal` is historical only.

## Consequences

- Changing org or repo name requires a new ADR that supersedes this one, plus a coordinated YAML update.
- Callers MAY still pass `app_repository` / `app_ref` inputs to override checkout; the default is the production source of truth, not a hard lock.
- Fast Feedback, Integration, and Release defaults MUST stay identical except for `DEFAULT_APP_REF` (`develop` vs `master` on Release).
