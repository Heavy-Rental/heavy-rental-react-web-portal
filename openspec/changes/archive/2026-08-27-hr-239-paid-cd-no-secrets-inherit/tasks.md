# Tasks

## 1. YAML

- [x] 1.1 Remove `secrets: inherit` from `portal-cd-paid-caller.yml`
- [x] 1.2 Comment OIDC + Semgrep `secrets-inherit` + `refuse-non-paid`
- [x] 1.3 Do not add `nosemgrep` or an AWS key `secrets:` map

## 2. ADRs

- [x] 2.1 Add `adr/0006-paid-portal-cd-does-not-inherit-repository-secrets.md` superseding ADR-0004
- [x] 2.2 Update `adr/README.md` in-force index (0004 superseded, 0006 in force)
- [x] 2.3 Write this change-local `adr.md` manifest

## 3. OpenSpec living specs

- [x] 3.1 MODIFY `openspec/specs/portal-cd` paid-secrets requirement
- [x] 3.2 Update `openspec/config.yaml` CI/CD facts
- [x] 3.3 Update `openspec/specs/product-features` pipeline-count scenario

## 4. SDD and README

- [x] 4.1 Update `specification/Spec-project-environment.md` FR-014, scenario 7, assumptions, changelog
- [x] 4.2 Update root `README.md` paid CD sentence

## 5. OpenSPDD

- [x] 5.1 Add analysis + REASONS Canvas for this fix
- [x] 5.2 Sync prior canvas so it cannot restore inherit
- [x] 5.3 Point `spdd/README.md` at the current in-force canvas
