# Delta for portal-cd

## Purpose

Manual deploy, configure, and health of the React portal on existing `asg-portal` guests.

## ADDED Requirements

### Requirement: Split Academy and paid callers

Portal CD MUST expose `portal-cd-academy-caller.yml` (environment `academy` only) and `portal-cd-paid-caller.yml` (environment `AWS_ACTUAL` only). Both MUST call `web-portal-cd-academy.yml`.

#### Scenario: Academy refuses paid environment
- GIVEN Academy CD dispatch
- WHEN `aws_environment` is not `academy`
- THEN job `Assert Environment academy` fails

### Requirement: resolve-aws-profile authenticates CD

Reusable portal CD MUST authenticate with `.github/actions/resolve-aws-profile`. Copy/install comments MUST NOT instruct operators to copy `resolve-vocareum-aws`.

#### Scenario: Academy copy comments
- GIVEN `.github/workflows/portal-cd-academy-caller.yml` header comments
- WHEN an operator copies CD into this repo
- THEN the listed action is `resolve-aws-profile`
- AND the comments say not to copy `resolve-vocareum-aws`

### Requirement: Paid CD inherits secrets

`portal-cd-paid-caller.yml` MUST pass `secrets: inherit` to `web-portal-cd-academy.yml`.

#### Scenario: Paid caller YAML
- GIVEN `.github/workflows/portal-cd-paid-caller.yml`
- WHEN the `portal-cd` job is inspected
- THEN it contains `secrets: inherit`

### Requirement: Guest GET / is the CD health gate

Job `Health GET /` MUST SSM-curl `http://127.0.0.1/` on `asg-portal` guests and MUST succeed if at least one guest returns 200, 301, or 302. It MUST NOT modify ALB target-group health-check configuration.

#### Scenario: Verify after deploy
- GIVEN `action=deploy` and Ansible compose succeeded
- WHEN `Health GET /` runs
- THEN a failing `/api` is ignored
- AND the job fails only if no guest returns 200–302

### Requirement: Discover live asg-portal

CD MUST require `asg-portal` with desired capacity greater than 0 and at least one SSM Online instance.

#### Scenario: Empty ASG
- GIVEN `asg-portal` desired capacity 0
- WHEN Discover asg-portal runs
- THEN the job fails
