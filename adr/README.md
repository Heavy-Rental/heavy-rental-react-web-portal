# Architecture Decision Records

Durable architecture log for `heavy-rental-react-web-portal`.

These files are the **why** of the system. OpenSpec specs (`openspec/specs/`) are the **what**. OpenSPDD REASONS canvases (`spdd/prompt/`) are the **how** for a given change.

## Standard

- Format: [MADR-short](https://adr.github.io/madr/) (title, status/date, context, decision, consequences).
- Location: this folder only (`adr/NNNN-kebab-title.md`). Never store durable ADRs inside `openspec/changes/`.
- Numbering: monotonic four-digit sequence. Numbers are never reused.
- Immutability: an **accepted** ADR is frozen. To change a decision, add a new ADR whose Status is `accepted, supersedes ADR-NNNN` and whose `Supersedes:` field names the prior file. Do not edit the old file.
- In-force set: walk `Supersedes:` links. Only accepted ADRs that are not superseded constrain new designs.

## In-force index

| ID | File | Decision |
| --- | --- | --- |
| ADR-0001 | [0001-adopt-openspec-openspdd-and-madr.md](0001-adopt-openspec-openspdd-and-madr.md) | OpenSpec `spec-driven-with-adr` + OpenSPDD + MADR |
| ADR-0002 | [0002-canonical-github-repository-heavy-rental.md](0002-canonical-github-repository-heavy-rental.md) | Canonical repo is `Heavy-Rental/heavy-rental-react-web-portal` |
| ADR-0003 | [0003-split-portal-cd-academy-and-paid-via-resolve-aws-profile.md](0003-split-portal-cd-academy-and-paid-via-resolve-aws-profile.md) | Split CD callers; shared `resolve-aws-profile` |
| ADR-0004 | [0004-paid-portal-cd-inherits-github-secrets.md](0004-paid-portal-cd-inherits-github-secrets.md) | Paid CD caller uses `secrets: inherit` |
| ADR-0005 | [0005-portal-cd-health-is-guest-http-not-alb-target-group.md](0005-portal-cd-health-is-guest-http-not-alb-target-group.md) | Portal CD `verify` is guest `GET /`, not ALB TG config |

## New ADR

1. Take the next sequence number.
2. Copy the MADR-short sections from an existing file.
3. Set Status to `accepted` only after the design is implemented.
4. Reference the file from `openspec/changes/<change>/adr.md` (review manifest).
5. Update the in-force index in this README.
