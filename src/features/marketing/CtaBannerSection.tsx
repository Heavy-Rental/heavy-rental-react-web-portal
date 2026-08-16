import { display } from "../../lib/styles";

export function CtaBannerSection({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="py-16 bg-primary relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(0,0,0,.3) 40px,rgba(0,0,0,.3) 41px),repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(0,0,0,.3) 40px,rgba(0,0,0,.3) 41px)",
        }}
      />
      <div className="relative max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-primary-foreground leading-none" style={display}>
            READY TO RENT?
          </h2>
          <p className="text-primary-foreground/70 mt-1 text-sm">
            Sign in to book equipment, track orders, and manage your fleet.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={onSignIn}
            className="px-6 py-3 bg-primary-foreground text-primary font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-all"
          >
            Sign In as Customer
          </button>
          <button
            onClick={onSignIn}
            className="px-6 py-3 border-2 border-primary-foreground text-primary-foreground font-bold text-sm tracking-widest uppercase hover:bg-primary-foreground/10 transition-all"
          >
            Employee Login
          </button>
        </div>
      </div>
    </section>
  );
}
