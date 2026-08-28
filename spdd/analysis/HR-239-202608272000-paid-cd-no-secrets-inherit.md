# HR-239 Strategic Analysis: Paid CD no repository-secret inherit

## Original business requirements

Remove Semgrep ERROR `yaml.github-actions.security.secrets-inherit` from `portal-cd-paid-caller.yml` without breaking paid portal CD. Keep documentation (OpenSpec, OpenSPDD, ADR) consistent with the YAML.

## Domain concepts

### Existing

| Concept | Current role |
| --- | --- |
| `secrets: inherit` | Forbidden on paid CD after this change (Semgrep + least privilege) |
| GitHub OIDC | Paid auth: `vars.AWS_ROLE_TO_ASSUME` + `id-token: write` |
| `refuse-non-paid` | Caller gate: environment must be `AWS_ACTUAL`, no `AWS_ACCESS_KEY_ID`, role var set |
| `environment: AWS_ACTUAL` | Supplies environment **variables** to reusable jobs without inherit |
| ADR-0004 | Historical; superseded |
| ADR-0006 | In-force paid-secrets decision |

## Approach decisions

1. Delete inherit; do not pass an AWS key secret map; do not `nosemgrep`.
2. Leave mixed-key refusal on the caller.
3. New OpenSpec change with MODIFIED `portal-cd` requirement; archive after apply.
4. New OpenSPDD canvas; stamp the previous canvas so agents cannot restore inherit from it.

## Risks

| Risk | Mitigation |
| --- | --- |
| Paid CD missing a repository secret | None required; OIDC uses vars. Named map later if needed |
| Agents re-apply ADR-0004 | Walk `Supersedes:`; ADR-0006 is in force |

## Acceptance criteria coverage

- [x] No `secrets: inherit` on paid caller
- [x] `refuse-non-paid` unchanged
- [x] ADR-0006 supersedes ADR-0004 (file 0004 untouched)
- [x] OpenSpec living `portal-cd` + environment SDD + README match YAML
- [x] OpenSPDD current canvas forbids inherit

## Open questions

None.
