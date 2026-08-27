# ADR-0005: Portal CD health is guest GET /, not ALB target-group configuration

- Status: accepted
- Date: 2026-08-27
- Tags: cd, health-check, alb, nginx

## Context

Ticket HR-239 is titled around an ALB target-group health-check fix. In this repository, portal CD does not call `elbv2 modify-target-group` or change ALB health-check path/port/matcher. Target-group health is infra (Terraform / infra CD). What this repo owns is:

- nginx on each `asg-portal` guest serving the SPA at `/` and proxying `/api/` to `REST_BASE_URL` (REST ALB host via `$proxy_host`).
- Ansible `Portal GET / is up` against `http://127.0.0.1/` (200/301/302).
- CD job `verify` (`Health GET /`): SSM `curl` of `http://127.0.0.1/` on InService + SSM Online guests. A failing `/api` MUST NOT fail that job. The portal ALB DNS name is printed in the job summary when present.

## Decision

Portal CD `action=verify` (and the post-deploy verify after `deploy` / `configure-only`) MUST treat success as at least one SSM-online guest returning HTTP 200, 301, or 302 for `GET /` on loopback. It MUST NOT require ALB target-group health, public ALB HTTP, or REST `/api` success. ALB target-group health-check path, interval, and matcher remain infra CD concerns.

## Consequences

- Docs and specs MUST NOT claim this repo patches ALB target-group health checks.
- Operators diagnosing "unhealthy targets" after a green portal CD run should look at infra TG settings and security groups, not at the CD verify job.
- Changing CD to gate on ALB TG health requires a new ADR that supersedes this one.
