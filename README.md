# Heavy Rental Web Portal

React + TypeScript + Vite frontend for a heavy machinery rental business.

UI mockup merged from a **Figma Make / Figma AI** design (see `ATTRIBUTIONS.md` for photo credits).

## Features (design prototype)

- **Public portal** — equipment catalog, search/filter, hero, stats, testimonials
- **Customer flow** — onboarding (know / browse / specs), calendar booking, cart, checkout, profile & rental plans
- **Admin dashboard** — fleet, assets, bookings, pricing, analytics charts
- **Employee dashboard** — operational overview
- **Safety / About / Projects** pages
- **Equipment assistant chatbot** (rule-based mock)

### Demo logins

| Email | Role |
|-------|------|
| `john@company.com` | Customer |
| `sarah@company.com` | Admin |

Any non-empty password works in this mockup.

## Stack

- React 19 + TypeScript + Vite 8
- Tailwind CSS v4 (`@tailwindcss/vite`)
- [lucide-react](https://lucide.dev) icons
- [recharts](https://recharts.org) for dashboard charts

## Scripts

```bash
npm install
npm run dev      # local dev server, proxied to the mock API (same as dev:mock)
npm run dev:mock # local dev server, proxied to the mock API server (127.0.0.1:4010)
npm run dev:api  # local dev server, proxied to a Spring Boot backend (localhost:8080)
npm run build    # production build
npm run preview  # preview production build
```

## Project layout

```
src/
  App.tsx                 # Main app shell & public portal
  app/
    CustomerOnboarding.tsx
    AdminDashboard.tsx
    SafetyPage.tsx
    AboutPage.tsx
    ProjectsPage.tsx
    shared.ts             # Shared equipment data / types
  styles/theme.css        # Dark industrial design tokens
  index.css               # Tailwind + fonts entry
```
