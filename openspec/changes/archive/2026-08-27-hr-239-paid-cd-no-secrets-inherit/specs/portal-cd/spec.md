# Delta for portal-cd

## MODIFIED Requirements

### Requirement: Paid CD does not inherit repository secrets

`portal-cd-paid-caller.yml` MUST NOT pass `secrets: inherit` (or any repository-secret map) to `web-portal-cd-academy.yml`. Paid CD authenticates with GitHub OIDC (`vars.AWS_ROLE_TO_ASSUME`). The caller job `refuse-non-paid` MUST fail if Environment `AWS_ACTUAL` contains `AWS_ACCESS_KEY_ID`. Academy CD MUST pass Vocareum keys as workflow_dispatch inputs and MUST NOT use `secrets: inherit`.

(Previously: Paid CD inherits secrets — `secrets: inherit` required so the reusable workflow could refuse Vocareum keys.)

#### Scenario: Paid caller YAML
- GIVEN `.github/workflows/portal-cd-paid-caller.yml`
- WHEN the `portal-cd` job is inspected
- THEN it does not contain `secrets: inherit`
- AND comments state that paid CD uses OIDC and must not inherit repository secrets

#### Scenario: Semgrep secrets-inherit
- GIVEN Security Testing Semgrep packs that include `yaml.github-actions.security.secrets-inherit`
- WHEN `portal-cd-paid-caller.yml` is scanned
- THEN there is no ERROR finding for `secrets: inherit` on that file
