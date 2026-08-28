# Delta for project-environment

## Purpose

Runtime, package manager, scripts, and local tooling for the React web portal.

## ADDED Requirements

### Requirement: Node 22 and npm ci

Install and CI MUST use Node.js 22 and npm with the committed `package-lock.json`. CI installs with `npm ci`.

#### Scenario: CI install
- GIVEN a GitHub Actions reusable pipeline for this portal
- WHEN Integration Check or Fast Feedback Integration runs
- THEN `NODE_VERSION` is `"22"`
- AND dependencies are installed with `npm ci`

### Requirement: npm scripts

The project MUST provide `dev`, `dev:mock`, `dev:api`, `build`, `lint`, `preview`, `test`, `test:watch`, `test:e2e`, `test:e2e:ui`, and `test:e2e:install`. There MUST NOT be an npm script that starts the mock API server.

#### Scenario: Local mock development
- GIVEN a contributor has Node 22 and has run `npm install`
- WHEN they run `npm run dev`
- THEN Vite starts in mock mode

### Requirement: Vite proxy environment

Local Vite MUST select the backend via `VITE_API_TARGET` from `.env.mock` or `.env.api`.

#### Scenario: API mode hostname
- GIVEN `.env.api`
- WHEN a contributor runs `npm run dev:api`
- THEN the proxy target is the hostname in `VITE_API_TARGET`
