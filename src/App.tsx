import { useState, useRef, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { AdminDashboard } from "./features/admin/AdminDashboard";
import { SafetyPage } from "./app/SafetyPage";
import { AboutPage } from "./app/AboutPage";
import { ProjectsPage } from "./app/ProjectsPage";
import type { Role, View, StoredSession } from "./app/types";
import { assetApi, userApi, setAuthToken, login, logout } from "./app/api";
import { useApiResource } from "./app/useApiResource";
import { issueSession, saveSession, clearSession } from "./app/auth";
import { restoreSession, viewForRole } from "./app/session";
import { AuthLoadingOverlay } from "./components/AuthLoadingOverlay";
import { CartProvider } from "./features/cart/CartContext";
import { CustomerPortal } from "./features/customer/CustomerPortal";
import { EmployeeDashboard } from "./features/employee/EmployeeDashboard";
import { LoginModal } from "./features/auth/LoginModal";
import { ACCOUNTS } from "./features/auth/accounts";
import { MarketingHomePage } from "./features/marketing/MarketingHomePage";

export default function App() {
  const [initialSession] = useState(restoreSession);
  const [view, setView] = useState<View>(
    initialSession.user ? viewForRole(initialSession.user.role) : "portal",
  );
  const [user, setUser] = useState<StoredSession | null>(initialSession.user);
  const [showLogin, setShowLogin] = useState(false);
  const [authOverlay, setAuthOverlay] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [sessionNotice, setSessionNotice] = useState<string | null>(
    initialSession.notice,
  );
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const equipmentRes = useApiResource((signal) => assetApi.list(undefined, signal));
  const equipment = equipmentRes.data ?? [];

  const scheduleExpiry = (session: StoredSession) => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    expiryTimer.current = setTimeout(
      () => {
        clearSession();
        setAuthToken(null);
        setUser(null);
        setView("portal");
        setSessionNotice("Your session has expired. Please log in again.");
      },
      Math.max(0, session.expiresAt - Date.now()),
    );
  };

  // Auto-dismiss the notice a few seconds after it appears, whether it came
  // from the initial-mount restore or from the proactive timer above.
  useEffect(() => {
    if (!sessionNotice) return;
    const t = setTimeout(() => setSessionNotice(null), 3000);
    return () => clearTimeout(t);
  }, [sessionNotice]);

  // Restart the proactive expiry timer for a restored session's remaining TTL.
  useEffect(() => {
    if (initialSession.user) scheduleExpiry(initialSession.user);
    return () => {
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (role: Role, name: string, email: string) => {
    const started = Date.now();
    setAuthOverlay(true);
    setShowLogin(false);
    try {
      const resolveUserId = async (): Promise<number | null> => {
        try {
          const users = await userApi.list();
          return users.find((u) => u.email.toLowerCase() === email)?.id ?? null;
        } catch {
          // no linked account for this email — proceed with id: null (existing behavior)
          return null;
        }
      };
      let session: StoredSession;
      if (import.meta.env.MODE === "api") {
        const password = ACCOUNTS[email]?.password;
        const { accessToken, expiresIn } = await login(email, password);
        // Prime the api client with the real bearer token before calling any
        // other authenticated endpoint (e.g. userApi.list() below) — previously
        // that call fired before login() resolved and always 401'd.
        setAuthToken(accessToken);
        const id = await resolveUserId();
        const issuedAt = Date.now();
        session = {
          token: accessToken,
          id,
          name,
          role,
          issuedAt,
          expiresAt: issuedAt + expiresIn * 1000,
        };
      } else {
        const id = await resolveUserId();
        session = issueSession({ id, name, role });
      }
      const wait = Math.max(0, 500 - (Date.now() - started));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      saveSession(session);
      setAuthToken(session.token);
      setUser(session);
      scheduleExpiry(session);
      setView(viewForRole(role));
    } catch {
      setSessionNotice("Couldn't sign in. Please try again.");
    } finally {
      setAuthOverlay(false);
    }
  };
  const handleLogout = () => {
    if (import.meta.env.MODE === "api") {
      logout().catch(() => {
        // best-effort revoke — still clear the local session even if this fails
      });
    }
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    clearSession();
    setAuthToken(null);
    setUser(null);
    setView("portal");
  };

  if (view === "customer" && user)
    return (
      <CartProvider>
        <CustomerPortal
          userName={user.name}
          userId={user.id}
          onLogout={handleLogout}
        />
      </CartProvider>
    );
  if (view === "dashboard" && user)
    return (
      <EmployeeDashboard
        userName={user.name}
        onLogout={handleLogout}
      />
    );
  if (view === "admin" && user)
    return (
      <AdminDashboard
        userName={user.name}
        onLogout={handleLogout}
      />
    );
  if (view === "safety") return <SafetyPage onHome={() => setView("portal")} />;
  if (view === "about") return <AboutPage onHome={() => setView("portal")} />;
  if (view === "projects")
    return <ProjectsPage onHome={() => setView("portal")} />;

  return (
    <>
      {showLogin && (
        <LoginModal onLogin={handleLogin} onClose={() => setShowLogin(false)} />
      )}
      <AuthLoadingOverlay open={authOverlay} />
      {sessionNotice && (
        <div className="fixed top-4 right-4 z-50 bg-card border border-primary/40 px-4 py-3 text-sm text-foreground flex items-center gap-2 shadow-xl">
          <AlertTriangle size={15} className="text-primary shrink-0" />
          {sessionNotice}
        </div>
      )}
      <MarketingHomePage
        equipment={equipment}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onSignIn={() => setShowLogin(true)}
        onNavigate={(v) => setView(v)}
      />
    </>
  );
}
