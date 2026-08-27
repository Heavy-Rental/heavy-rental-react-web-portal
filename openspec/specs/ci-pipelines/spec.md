# CI Pipelines Specification

## Purpose

GitHub Flow quality gates for the React web portal: Fast Feedback, Integration CI, Release, and Security Report. These pipelines MUST NOT deploy to AWS.

## Requirements

### Requirement: Canonical default application repository

Reusable Fast Feedback, Integration, and Release workflows MUST set `DEFAULT_APP_REPOSITORY` to `Heavy-Rental/heavy-rental-react-web-portal`. Same-repo callers MUST check out `github.repository` at `github.sha` (PR head merge commit on `pull_request`).

#### Scenario: Default owner is Heavy-Rental
- GIVEN `.github/workflows/integration-pipeline.yml`, `fast-feedback-pipeline.yml`, and `release-pipeline.yml`
- WHEN `DEFAULT_APP_REPOSITORY` is read
- THEN each value is `Heavy-Rental/heavy-rental-react-web-portal`
- AND none is `SA62-team1/heavy-rental-react-web-portal`

#### Scenario: Portal PR uses the calling commit
- GIVEN `portal-ci-caller.yml` invokes Integration with empty `app_repository`
- WHEN a pull request targets `develop`
- THEN Integration Check resolves mode `caller` and ref `github.sha`

### Requirement: Fast Feedback is feature-branch Integration only

`portal-fast-feedback-caller.yml` MUST trigger on push to branches other than `master` and `develop`, and on `workflow_dispatch`. It MUST call only `fast-feedback-pipeline.yml`. `portal-ci-caller.yml` MUST NOT `uses:` Fast Feedback.

#### Scenario: Feature branch push
- GIVEN a push to a feature branch
- WHEN Fast Feedback CI runs
- THEN only Integration (checkout, Node 22, `npm ci`, install health) runs
- AND Quality Control, Security Testing, CodeQL, and REST Endpoint Tests do not run

### Requirement: Integration CI gates pull requests to develop

`portal-ci-caller.yml` MUST run on pull requests to `develop`, pushes to `develop`, and `workflow_dispatch`. It MUST be the sole caller of `integration-pipeline.yml`. Jobs MUST include Integration Check (highest priority), Quality Control, Security Testing, CodeQL Analysis, REST Endpoint Tests, and GitHub Flow CI Gate.

#### Scenario: PR Integration reuses Fast Feedback
- GIVEN a pull request into `develop` whose head SHA already has a successful Fast Feedback run
- WHEN Integration Check starts
- THEN it reuses that Fast Feedback run instead of repeating `npm ci` / install health
- AND it MUST NOT invoke `fast-feedback-pipeline.yml` from the CI caller

### Requirement: Release is manual master packaging

`portal-release-caller.yml` MUST be `workflow_dispatch` only. It MUST be the sole caller of `release-pipeline.yml`. Release MUST check out `master`, run Integration and Quality Control, package `vite build --mode api` into nginx, run DAST, then publish public GHCR (`heavy_rental_web_portal:<semver>` and `:latest`) and create the GitHub Release. It MUST NOT trigger on `on: release` or on develop→master pull requests.

#### Scenario: Manual release
- GIVEN `master` contains the intended release
- WHEN an operator runs Actions → Release → Run workflow
- THEN packaging and DAST complete before Publish
- AND Publish creates the GitHub Release (the workflow is not triggered by a pre-existing Release event)

### Requirement: Security Report summarizes existing alerts

`portal-security-report-caller.yml` MUST run weekly (Monday 08:00 UTC) and on `workflow_dispatch`. It MUST call `security-report-pipeline.yml`, which MUST only read existing Code Scanning alerts and MUST NOT run new scans.

#### Scenario: Weekly report
- GIVEN Code Scanning alerts from Integration / Release
- WHEN Security Report runs
- THEN a Job Summary and `security-report.md` artifact are produced
- AND Semgrep, npm audit, Trivy, and CodeQL are not re-executed by that workflow

### Requirement: Caller gates

Each reusable pipeline MUST refuse callers other than its designated `portal-*-caller.yml` via an `assert-caller` job.

#### Scenario: Wrong caller
- GIVEN a workflow other than `portal-ci-caller.yml` attempts `uses:` `integration-pipeline.yml`
- WHEN `assert-caller` runs
- THEN the job fails with an error that only `portal-ci-caller.yml` is allowed
