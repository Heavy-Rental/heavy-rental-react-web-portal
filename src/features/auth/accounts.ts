import type { Role } from "../../app/types";

// Demo accounts mapped to real mock/db.json seed users (Spec-mock-api-server.md)
// so a real numeric userId can be resolved at login — see handleLogin in App().
// The password is a fixed demo value compared client-side only (Spec-frontend-authentication.md
// FR-010) — not real security, since it ships visible in the client bundle.
export const ACCOUNTS: Record<
  string,
  { role: Role; name: string; password: string }
> = {
  "alex.tan@example.sg": {
    role: "customer",
    name: "Alex Tan",
    password: "customer123",
  },
  "ravi.kumar@example.sg": {
    role: "admin",
    name: "Ravi Kumar",
    password: "admin123",
  },
};
