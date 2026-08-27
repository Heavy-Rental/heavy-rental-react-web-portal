# OpenSpec

Living behavior contracts for this portal. Schema: **`spec-driven-with-adr`** (`config.yaml`).

```
openspec/
  config.yaml          # schema, project context, agent rules
  specs/               # current behavior (source of truth)
    documentation-system/
    project-environment/
    ci-pipelines/
    portal-cd/
    product-features/
  changes/
    archive/           # completed changes (proposal, design, adr manifest, tasks, deltas)
```

Artifact order for a new change: `proposal → specs → design → adr → tasks`.

- Durable ADRs: `adr/NNNN-kebab-title.md` (not inside this folder).
- Change-local `adr.md` is a review manifest only.
- Product UI detail stays in `specification/`; `specs/product-features` indexes it.

See [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) and [spec-driven-with-adr](https://github.com/intent-driven-dev/openspec-schemas/tree/main/openspec/schemas/spec-driven-with-adr).
