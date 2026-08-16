import { useState } from "react";
import { X } from "lucide-react";
import type { Role } from "../../app/types";
import { mono, display, sans } from "../../lib/styles";
import { ACCOUNTS } from "./accounts";

export function LoginModal({
  onLogin,
  onClose,
}: {
  onLogin: (role: Role, name: string, email: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.toLowerCase().trim();
    const account = ACCOUNTS[normalizedEmail];
    if (!account || password !== account.password) {
      setError("Invalid email or password.");
      return;
    }
    await onLogin(account.role, account.name, normalizedEmail);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="bg-card border border-border w-full max-w-md"
        style={sans}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <span className="text-xl font-black text-foreground" style={display}>
            SIGN IN
          </span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              placeholder="you@company.com"
              required
              autoFocus
              className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="••••••••"
              required
              className="w-full bg-secondary/50 border border-border px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            className="w-full py-3 font-bold text-sm tracking-widest uppercase bg-primary hover:brightness-110 text-primary-foreground transition-all mt-1"
          >
            Sign In
          </button>
          <p className="text-xs text-muted-foreground text-center" style={mono}>
            Customer: alex.tan@example.sg / customer123 · Admin:
            ravi.kumar@example.sg / admin123
          </p>
        </form>
      </div>
    </div>
  );
}
