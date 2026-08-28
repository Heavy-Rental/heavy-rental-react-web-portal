# Delta for ci-pipelines

## Purpose

GitHub Flow quality gates for the React web portal: Fast Feedback, Integration CI, Release, and Security Report.

## ADDED Requirements

### Requirement: Canonical default application repository

Reusable Fast Feedback, Integration, and Release workflows MUST set `DEFAULT_APP_REPOSITORY` to `Heavy-Rental/heavy-rental-react-web-portal`.

#### Scenario: Default owner is Heavy-Rental
- GIVEN `.github/workflows/integration-pipeline.yml`, `fast-feedback-pipeline.yml`, and `release-pipeline.yml`
- WHEN `DEFAULT_APP_REPOSITORY` is read
- THEN each value is `Heavy-Rental/heavy-rental-react-web-portal`
- AND none is `SA62-team1/heavy-rental-react-web-portal`

### Requirement: Fast Feedback is feature-branch Integration only

`portal-fast-feedback-caller.yml` MUST trigger on push to branches other than `master` and `develop`. `portal-ci-caller.yml` MUST NOT `uses:` Fast Feedback.

#### Scenario: Feature branch push
- GIVEN a push to a feature branch
- WHEN Fast Feedback CI runs
- THEN only Integration (checkout, Node 22, `npm ci`, install health) runs

### Requirement: Integration CI gates pull requests to develop

`portal-ci-caller.yml` MUST be the sole caller of `integration-pipeline.yml`. Jobs MUST include Integration Check, Quality Control, Security Testing, CodeQL Analysis, REST Endpoint Tests, and GitHub Flow CI Gate.

#### Scenario: PR Integration reuses Fast Feedback
- GIVEN a pull request into `develop` whose head SHA already has a successful Fast Feedback run
- WHEN Integration Check starts
- THEN it reuses that Fast Feedback run instead of repeating `npm ci` / install health

### Requirement: Release is manual master packaging

`portal-release-caller.yml` MUST be `workflow_dispatch` only and MUST NOT trigger on `on: release`.

#### Scenario: Manual release
- GIVEN `master` contains the intended release
- WHEN an operator runs Actions → Release → Run workflow
- THEN packaging and DAST complete before Publish

### Requirement: Security Report summarizes existing alerts

Security Report MUST only read existing Code Scanning alerts and MUST NOT run new scans.

#### Scenario: Weekly report
- GIVEN Code Scanning alerts from Integration / Release
- WHEN Security Report runs
- THEN a Job Summary and `security-report.md` artifact are produced

### Requirement: Caller gates

Each reusable pipeline MUST refuse callers other than its designated `portal-*-caller.yml`.

#### Scenario: Wrong caller
- GIVEN a workflow other than `portal-ci-caller.yml` attempts `uses:` `integration-pipeline.yml`
- WHEN `assert-caller` runs
- THEN the job fails
