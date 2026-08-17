import { mono, display, sans } from "../../../lib/styles";

const STEPS = [
  "Parsing project specifications…",
  "Identifying equipment requirements…",
  "Matching to available fleet…",
  "Calculating rental costs…",
  "Preparing your quotation…",
];

export function AnalysingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6" style={sans}>
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-8" />
        <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-3" style={mono}>Processing</p>
        <h2 className="text-4xl font-black text-foreground leading-none mb-6" style={display}>ANALYSING SPECS</h2>
        <div className="flex flex-col gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-3 text-left">
              <div className="w-4 h-4 border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: `${i * 0.4}s` }} />
              </div>
              <p className="text-sm text-muted-foreground">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
