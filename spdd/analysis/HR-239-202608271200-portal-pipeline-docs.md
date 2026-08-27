# HR-239 Strategic Analysis: Portal pipeline callers and documentation standard

## Original business requirements

Bring all documentation and specifications up to date, accurate, and consistent using OpenSpec, OpenSPDD, and ADR standards, covering HR-239 portal pipeline caller work (canonical GitHub org, Academy `resolve-aws-profile` copy notes, paid CD `secrets: inherit`) and the existing product SDD tree.

## Domain concepts

### Existing

| Concept | Where it lives | Notes |
| --- | --- | --- |
| Feature SDD | `specification/Spec-*.md` | Informal SDD; still valid for UI/API |
| Caller / reusable workflow | `.github/workflows/portal-*-caller.yml` + `*-pipeline.yml` | `assert-caller` gate |
| Academy vs paid CD | `portal-cd-academy-caller.yml`, `portal-cd-paid-caller.yml` | Shared `web-portal-cd-academy.yml` |
| `resolve-aws-profile` | `.github/actions/resolve-aws-profile` | Academy keys or OIDC |
| `resolve-vocareum-aws` | `.github/actions/resolve-vocareum-aws` | Unused by portal CD |
| Guest health | `web-portal-cd-academy.yml` job `verify` | SSM `GET /` 200–302 |
| Portal ALB | printed in CD summaries | TG health is infra, not this repo |

### New

| Concept | Meaning |
| --- | --- |
| OpenSpec capability | `openspec/specs/<name>/spec.md` living behavior |
| Change archive | `openspec/changes/archive/<date>-<slug>/` |
| MADR-short ADR | `adr/NNNN-kebab-title.md`, immutable when accepted |
| ADR review manifest | `openspec/changes/<change>/adr.md` |
| REASONS Canvas | `spdd/prompt/` implementation contract |

## Conceptual relationships

- Specs (what) constrain canvases (how) and are justified by ADRs (why).
- Product SDD is a detail layer under OpenSpec `product-features`.
- YAML is the runtime source when a sentence in markdown disagrees.

## Approach decisions

1. Baseline OpenSpec specs for documentation, environment, CI, CD, and product index — do not OpenSpec-rewrite every UI spec in this change.
2. Five ADRs for the documentation standard and the four pipeline decisions that will be re-litigated without a log.
3. One OpenSPDD canvas for this documentation change; pipeline YAML edits already landed except Fast Feedback org default.
4. Archive the OpenSpec change immediately so the next ticket starts from `openspec/specs/`.

## Risks

| Risk | Mitigation |
| --- | --- |
| Dual sources of truth (`specification/` vs OpenSpec) | Conflict rule: code/YAML → OpenSpec → specification; update both in one change |
| Ticket title implies ALB TG edits | ADR-0005 + portal-cd spec |
| Fast Feedback still `SA62-team1` | Align YAML with Integration/Release |
| Agents skip ADRs | `openspec/config.yaml` rules + `adr/README.md` |

## Acceptance criteria coverage

- [x] OpenSpec schema `spec-driven-with-adr` with proposal/specs/design/adr/tasks
- [x] Durable ADRs at repo-root `adr/`
- [x] OpenSPDD analysis + REASONS Canvas
- [x] Existing environment spec and README match live pipelines
- [x] Product specs indexed, not silently discarded
- [x] Canonical repo string consistent in Fast Feedback, Integration, Release

## Open questions

None. Infra ALB target-group health-check settings are out of this repository.
