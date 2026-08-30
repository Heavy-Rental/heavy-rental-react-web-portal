# Portal CD Specification

## Purpose

Manual deploy, configure, and health of the React portal on existing `asg-portal` guests. Not CI. Not Terraform.

## Requirements

### Requirement: Split Academy and paid callers

Portal CD MUST expose two `workflow_dispatch` callers: `Web Portal CD (Academy)` (`portal-cd-academy-caller.yml`, environment `academy` only) and `Web Portal CD (paid)` (`portal-cd-paid-caller.yml`, environment `AWS_ACTUAL` only). Both MUST call `web-portal-cd-academy.yml`. Actions MUST be `deploy`, `configure-only`, or `verify`.

#### Scenario: Academy refuses paid environment
- GIVEN Academy CD dispatch
- WHEN `aws_environment` is not `academy`
- THEN job `Assert Environment academy` fails
- AND it tells the operator to use Web Portal CD (paid)

#### Scenario: Paid refuses Vocareum environment
- GIVEN paid CD dispatch
- WHEN `aws_environment` is not `AWS_ACTUAL`
- THEN job `Assert Environment AWS_ACTUAL` fails
- AND it tells the operator to use Web Portal CD (Academy)

### Requirement: resolve-aws-profile authenticates CD

Reusable portal CD MUST authenticate with `.github/actions/resolve-aws-profile` (Academy Vocareum keys or paid GitHub OIDC). Copy/install comments on Academy CD MUST list `resolve-aws-profile` and MUST state that `resolve-vocareum-aws` is not used on this path.

#### Scenario: Paid OIDC
- GIVEN environment `AWS_ACTUAL` with `vars.AWS_ROLE_TO_ASSUME` set and no `AWS_ACCESS_KEY_ID`
- WHEN `resolve-aws-profile` runs with `profile=AWS_ACTUAL`
- THEN AWS credentials are configured via GitHub OIDC
- AND the action fails if Vocareum form keys or `AWS_ACCESS_KEY_ID` are present

#### Scenario: Academy copy comments
- GIVEN `.github/workflows/portal-cd-academy-caller.yml` header comments
- WHEN an operator reads how CD is installed in this repo
- THEN `resolve-aws-profile` already lives at `.github/actions/resolve-aws-profile/action.yml`
- AND the comments say not to copy `resolve-vocareum-aws` into the portal CD path
- AND they MUST NOT require a `deploy-pipeline/resolve-aws-profile/` source that this tree does not contain

### Requirement: Paid CD does not inherit repository secrets

`portal-cd-paid-caller.yml` MUST NOT pass `secrets: inherit` (or any repository-secret map) to `web-portal-cd-academy.yml`. Paid CD authenticates with GitHub OIDC (`vars.AWS_ROLE_TO_ASSUME`). The caller job `refuse-non-paid` MUST fail if Environment `AWS_ACTUAL` contains `AWS_ACCESS_KEY_ID`. Academy CD MUST pass Vocareum keys as workflow_dispatch inputs and MUST NOT use `secrets: inherit`.

#### Scenario: Paid caller YAML
- GIVEN `.github/workflows/portal-cd-paid-caller.yml`
- WHEN the `portal-cd` job is inspected
- THEN it does not contain `secrets: inherit`
- AND comments state that paid CD uses OIDC and must not inherit repository secrets

#### Scenario: Semgrep secrets-inherit
- GIVEN Security Testing Semgrep packs that include `yaml.github-actions.security.secrets-inherit`
- WHEN `portal-cd-paid-caller.yml` is scanned
- THEN there is no ERROR finding for `secrets: inherit` on that file

### Requirement: Guest GET / is the CD health gate

Job `Health GET /` (`verify`) MUST SSM-curl `http://127.0.0.1/` on InService + SSM Online `asg-portal` guests and MUST succeed if at least one guest returns 200, 301, or 302. REST `/api` failure MUST NOT fail this job. This job MUST NOT modify ALB target-group health-check configuration.

#### Scenario: Verify after deploy
- GIVEN `action=deploy` and Ansible compose succeeded
- WHEN `Health GET /` runs
- THEN it issues SSM `AWS-RunShellScript` `curl` of `http://127.0.0.1/`
- AND it fails only if no guest returns 200–302
- AND a failing `/api` is ignored

#### Scenario: Health-only dispatch
- GIVEN `action=verify`
- WHEN CD runs
- THEN Ansible compose is skipped
- AND `Health GET /` still runs after assert-lab and discover-targets succeed

### Requirement: Discover live asg-portal

CD MUST require Auto Scaling group `asg-portal` with desired capacity greater than 0, at least one InService instance, at least one SSM Online instance, and secret `heavy-rental/portal`. Missing ASG MUST tell the operator to run infra CD first.

#### Scenario: Empty ASG
- GIVEN `asg-portal` desired capacity 0
- WHEN Discover asg-portal runs
- THEN the job fails
- AND the error says to scale via infra, not portal CD
