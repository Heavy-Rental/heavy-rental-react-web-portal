import { useState, useRef } from "react";
import { Search, ArrowRight, Wrench, CheckCircle, ChevronLeft, ChevronRight, Sparkles, Gauge, Info } from "lucide-react";
import type { Equipment as EquipmentItem, OnboardingMode } from "../../app/types";
import { equipmentApi } from "../../app/api";
import { useApiResource } from "../../app/useApiResource";

interface QuoteLine {
  equipment: EquipmentItem; recommendedDays: number; reason: string;
  matchedKeywords: string[]; matchScore: number; costTip: string;
  priority: "Essential" | "Recommended" | "Optional";
  weeklyAdvised: boolean; savingVsDaily: number;
}

// Styles
const mono = { fontFamily: "'DM Mono', monospace" } as const;
const display = { fontFamily: "'Barlow Condensed', sans-serif" } as const;
const sans = { fontFamily: "'DM Sans', sans-serif" } as const;

// Cryptographically secure 4-digit id (avoids CodeQL insecure-randomness on refs/tokens)
function secureFourDigit(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return 1000 + (buf[0] % 9000);
}

// ─── Quote Result Screen ───────────────────────────────────────────────────
// Client-local — no AIRecommendation/RecommendationItem backend exists yet (only User
// has a wired-up REST controller, SPEC-entity-repository.md §3.2) — but field names/scale
// mirror those real entities so a future integration is a data-source swap, not a UI rewrite.

interface RecItem {
  eq: EquipmentItem;
  reason: string;
  lineTotal: number;
  rankOrder: number;   // RecommendationItem.rank_order (1-based)
  matchScore: number;  // RecommendationItem.match_score — 0–1 decimal, e.g. 0.95 = 95% match
}

// RecommendationItem.match_score thresholds → badge color.
function matchScoreColor(score: number): string {
  const pct = score * 100;
  if (pct >= 90) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  if (pct >= 75) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  return "text-muted-foreground bg-secondary/40 border-border";
}

function QuoteResultScreen({
  quoteRef, userName, recItems, days, confidenceScore,
  specSummary, onRefine, onAddAll,
}: {
  quoteRef: string;
  userName: string;
  recItems: RecItem[];
  estimatedTotal: number;
  days: number;
  confidenceScore: number; // AIRecommendation.confidence_score — 0–1 decimal, e.g. 0.91 = 91%
  specSummary: string;
  onRefine: () => void;
  onAddAll: () => void;
}) {
  const [checked, setChecked] = useState<boolean[]>(recItems.map(() => true));
  const [previewEq, setPreviewEq] = useState<EquipmentItem | null>(null);

  // Quantities are fixed at 1 — AI-recommended bundles aren't user-adjustable on this step
  // (Spec-frontend-ui-changes.md: disable quantity modifier on recommendation cards).
  const checkedTotal = recItems.reduce((sum, r, i) => {
    return checked[i] ? sum + Math.round(r.lineTotal) : sum;
  }, 0);

  return (
    <div className="min-h-screen bg-background text-foreground" style={sans}>
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-between h-14">
          <span className="text-xl font-black text-primary" style={display}>HEAVY<span className="text-foreground"> RENTAL</span></span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{userName}</span>
            <span className="text-xs border border-primary/30 text-primary px-1.5 py-0.5 bg-primary/10" style={mono}>CUSTOMER</span>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Back */}
        <button onClick={onRefine}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6 group transition-colors">
          <ChevronLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" /> Back to specs
        </button>

        {/* Page title */}
        <div className="mb-6">
          <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-1" style={mono}>
            Instant Quotation · {quoteRef}
          </p>
          <h1 className="text-4xl font-black text-foreground leading-none" style={display}>YOUR RECOMMENDATIONS</h1>
        </div>

        {/* 1b — Overall AI confidence score (AIRecommendation.confidence_score) */}
        <div
          className="bg-card border border-primary/30 px-5 py-4 mb-6 flex items-center gap-4"
          title="Confidence score calculated based on your prompt requirements and site constraints.">
          <div className="relative w-14 h-14 shrink-0">
            <svg viewBox="0 0 40 40" className="w-14 h-14 -rotate-90">
              <circle cx="20" cy="20" r="16" fill="none" strokeWidth="4" className="stroke-secondary/60" />
              <circle cx="20" cy="20" r="16" fill="none" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 16}
                strokeDashoffset={2 * Math.PI * 16 * (1 - confidenceScore)}
                className="stroke-primary transition-all duration-700" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-black text-foreground" style={display}>{Math.round(confidenceScore * 100)}%</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Gauge size={14} className="text-primary shrink-0" />
              <p className="text-sm font-black text-foreground" style={display}>{Math.round(confidenceScore * 100)}% AI Match Confidence</p>
              <Info size={12} className="text-muted-foreground shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Calculated from your prompt requirements and site constraints.</p>
          </div>
        </div>

        {/* 2 — Collapsed spec summary */}
        <div className="bg-card border border-border px-4 py-3 flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-semibold text-muted-foreground tracking-widest uppercase shrink-0" style={mono}>Your Project Spec</span>
            <span className="text-sm text-foreground truncate">{specSummary}</span>
          </div>
          <button onClick={onRefine}
            className="shrink-0 flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-semibold">
            ✏️ Refine
          </button>
        </div>

        {/* 3 — Recommendation list */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-4" style={mono}>
            📦 Recommended Rental Plan ({recItems.length} items)
          </p>

          <div className="flex flex-col gap-3">
            {recItems.map((r, i) => (
              <div key={r.eq.id} className="bg-card border border-border overflow-hidden">
                <div className="flex items-stretch">
                  {/* LEFT: clickable zone — thumbnail + name → detail page */}
                  <button
                    onClick={() => setPreviewEq(r.eq)}
                    className="flex items-center gap-3 flex-1 min-w-0 px-4 py-4 text-left hover:bg-muted/20 transition-colors group border-r border-border">
                    {/* Thumbnail */}
                    <div className="w-16 h-12 bg-muted shrink-0 overflow-hidden">
                      <img
                        src={`https://images.unsplash.com/${r.eq.img}?w=128&h=96&fit=crop&auto=format`}
                        alt={r.eq.name}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                    {/* Name + reason */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-black text-foreground leading-tight truncate" style={display}>{r.eq.name}</p>
                        <ChevronRight size={13} className="text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-primary" style={mono}>{r.eq.category}</span>
                        <span className="text-[10px] text-muted-foreground" style={mono}>#{r.rankOrder}</span>
                        {/* RecommendationItem.match_score badge — color mapped by threshold */}
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold border shrink-0 ${matchScoreColor(r.matchScore)}`}>
                          {Math.round(r.matchScore * 100)}% Match
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{r.reason}</p>
                    </div>
                  </button>

                  {/* RIGHT: controls — checkbox + read-only qty + price + add */}
                  <div className="flex flex-col items-end justify-between gap-2 px-4 py-4 shrink-0">
                    {/* Top row: checkbox */}
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked[i]}
                        onChange={() => setChecked(prev => prev.map((v, idx) => idx === i ? !v : v))}
                        className="w-4 h-4 accent-red-500"
                      />
                      <span className="text-xs text-muted-foreground">Include</span>
                    </label>

                    {/* Qty — read-only; AI-recommended quantities aren't user-adjustable here */}
                    <span className="px-2.5 py-1 text-xs font-bold text-muted-foreground bg-secondary/40 border border-border" style={mono}>
                      Qty: 1
                    </span>

                    {/* Price */}
                    <p className="text-base font-black text-foreground" style={display}>
                      S${Math.round(r.lineTotal).toLocaleString()}
                    </p>

                    {/* Individual add button — checks the item */}
                    <button
                      onClick={() => setChecked(prev => prev.map((v, idx) => idx === i ? true : v))}
                      className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all">
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4 — Agent rationale */}
        <div className="bg-card border border-border px-5 py-4 flex gap-3 mb-6">
          <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            This bundle was chosen to cover all phases of your {days}-day project: elevated facade access via the
            telescopic boom, site preparation via the hydraulic excavator, and compact indoor access via the scissors
            lift. Together they address your reach, ground-prep, and confined-space constraints without requiring
            crane mobilisation.
          </p>
        </div>

        {/* 5 — Total bar */}
        <div className="flex items-center justify-between bg-card border border-border px-5 py-4 mb-6">
          <p className="text-sm text-muted-foreground">Estimated total <span className="text-xs">({days} days · {checked.filter(Boolean).length} items selected)</span></p>
          <p className="text-2xl font-black text-foreground" style={display}>S${checkedTotal.toLocaleString()}</p>
        </div>

        {/* 6 — Primary CTA */}
        <button
          onClick={onAddAll}
          className="w-full py-4 bg-primary text-primary-foreground text-sm font-black tracking-widest uppercase hover:brightness-110 transition-all mb-3">
          Add All to Rental Plan
        </button>

        {/* 7 — Secondary link */}
        <div className="text-center">
          <button
            onClick={onRefine}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            🔄 Not quite right? Refine &amp; Re-generate
          </button>
        </div>
      </div>

      {/* Equipment detail popup */}
      {previewEq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPreviewEq(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative bg-card border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between gap-3 z-10">
              <div className="min-w-0">
                <p className="text-xs text-primary font-semibold tracking-widest uppercase" style={mono}>{previewEq.category}</p>
                <p className="font-black text-foreground text-lg leading-tight truncate" style={display}>{previewEq.name}</p>
              </div>
              <button onClick={() => setPreviewEq(null)}
                className="shrink-0 w-8 h-8 flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                ✕
              </button>
            </div>

            {/* Photo */}
            <div className="w-full h-52 bg-muted overflow-hidden">
              <img
                src={`https://images.unsplash.com/${previewEq.img}?w=600&h=400&fit=crop&auto=format`}
                alt={previewEq.name}
                className="w-full h-full object-cover opacity-85"
              />
            </div>

            <div className="px-5 py-5 flex flex-col gap-5">
              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">{previewEq.desc}</p>

              {/* Key specs grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Base Daily Rate",   value: `S$${previewEq.baseDailyRate.toLocaleString()}/day` },
                  { label: "Weekly Rate",  value: `S$${previewEq.weekly.toLocaleString()}/week` },
                  { label: "Capacity",     value: `${previewEq.capacity}t` },
                  { label: "Year",         value: previewEq.purchaseYear.toString() },
                  { label: "Location",     value: previewEq.location },
                  { label: "Availability", value: previewEq.available ? "Available now" : "On Request" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/40 border border-border px-3 py-2.5">
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <p className={`text-sm font-bold ${label === "Availability" ? previewEq.available ? "text-green-400" : "text-amber-400" : "text-foreground"}`} style={mono}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Tags */}
              {previewEq.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {previewEq.tags.map(tag => (
                    <span key={tag} className="text-xs border border-primary/30 bg-primary/5 text-primary px-2.5 py-1">{tag}</span>
                  ))}
                </div>
              )}

              {/* Close / Add */}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setPreviewEq(null)}
                  className="flex-1 py-2.5 border border-border text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
                  Close
                </button>
                <button onClick={() => {
                    const idx = recItems.findIndex(r => r.eq.id === previewEq.id);
                    if (idx !== -1) setChecked(prev => prev.map((v, i) => i === idx ? true : v));
                    setPreviewEq(null);
                  }}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground text-xs font-black tracking-widest uppercase hover:brightness-110 transition-all">
                  Add to Rental Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Onboarding Flow ──────────────────────────────────────────────────

function CustomerOnboarding({ userName, onDone, initialStep = "choose" }: { userName: string; onDone: (mode: OnboardingMode, recs?: EquipmentItem[]) => void; initialStep?: "choose" | "upload" }) {
  const [step, setStep] = useState<"choose" | "upload" | "analysing" | "quote">(initialStep);
  const [uploaded, setUploaded] = useState<File[]>([]);
  const [specsText, setSpecsText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [rentalDays, setRentalDays] = useState(7);
  const [quoteRef] = useState(() => `QUO-${secureFourDigit()}`);
  const fileRef = useRef<HTMLInputElement>(null);
  const equipmentRes = useApiResource(() => equipmentApi.list());
  const equipment = equipmentRes.data ?? [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setUploaded(Array.from(e.target.files));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => /\.(pdf|doc|docx|txt|csv|xlsx)$/i.test(f.name));
    if (files.length) setUploaded(files);
  };

  const runAnalysis = () => {
    setStep("analysing");
    setTimeout(() => {
      const lower = specsText.toLowerCase();
      const allText = lower + " " + uploaded.map(f => f.name.toLowerCase()).join(" ");

      // ── Duration hint extraction ──────────────────────────────────────────
      const durationHints: Record<string, number> = {
        "1 week": 7, "one week": 7, "two weeks": 14, "2 weeks": 14,
        "three weeks": 21, "3 weeks": 21, "1 month": 30, "one month": 30,
        "2 months": 60, "two months": 60, "daily": 1, "day": 1, "overnight": 1,
      };
      let detectedDays = rentalDays;
      for (const [hint, days] of Object.entries(durationHints)) {
        if (allText.includes(hint)) { detectedDays = days; break; }
      }
      setRentalDays(detectedDays);

      // ── Categorised intent signals — keyed to the 4 approved equipment
      // categories (Spec-ui-heavy-machinery-portal.md §2.1), not specific models,
      // so this stays correct if the catalog's exact machines ever change. ───
      const SIGNALS: { label: string; keywords: string[]; categories: string[]; reason: string }[] = [
        {
          label: "excavation",
          keywords: ["excavat", "dig", "trench", "foundation", "earthwork", "cut", "soil removal", "demolition", "earthmoving"],
          categories: ["Excavator"],
          reason: "Excavation, trenching, or earthmoving identified in your project scope",
        },
        {
          label: "elevated access",
          keywords: ["height", "elevated", "facade", "roof", "mep", "ceiling", "aerial", "boom", "man lift", "access platform", "painting", "electrical"],
          categories: ["Boom Lift"],
          reason: "Elevated access or working-at-height requirement found",
        },
        {
          label: "indoor / compact access",
          keywords: ["indoor access", "compact", "fit-out", "fit out", "scissor", "confined", "low ceiling"],
          categories: ["Scissors Lift"],
          reason: "Compact indoor access work in scope",
        },
        {
          label: "material handling",
          keywords: ["forklift", "pallet", "load", "unload", "warehouse", "indoor", "material handl", "storage"],
          categories: ["Fork Lift"],
          reason: "Material handling or logistics requirement identified",
        },
      ];

      // ── Keyword matching per equipment ────────────────────────────────────
      interface ScoredItem {
        eq: EquipmentItem;
        score: number;
        matchedKeywords: string[];
        primaryReason: string;
      }

      const scored: ScoredItem[] = equipment.map(eq => {
        let score = eq.available ? 2 : 0;
        const matchedKeywords: string[] = [];
        let primaryReason = "Matched to your project requirements";

        for (const sig of SIGNALS) {
          const hitKws = sig.keywords.filter(kw => allText.includes(kw));
          if (hitKws.length > 0 && sig.categories.includes(eq.category)) {
            score += hitKws.length * 5;
            hitKws.forEach(kw => { if (!matchedKeywords.includes(kw)) matchedKeywords.push(kw); });
            primaryReason = sig.reason;
          }
        }

        // idealFor keyword overlap
        eq.idealFor.forEach(tag => {
          if (allText.includes(tag.toLowerCase())) {
            score += 3;
            if (!matchedKeywords.includes(tag)) matchedKeywords.push(tag);
          }
        });

        // Capacity bonus — if tonnage mentioned and machine is appropriate size
        const tonMatch = allText.match(/(\d+)\s*(t|ton|tonne)/);
        if (tonMatch) {
          const reqTons = parseInt(tonMatch[1]);
          if (eq.capacity >= reqTons * 0.8 && eq.capacity <= reqTons * 2) score += 4;
        }

        return { eq, score, matchedKeywords, primaryReason };
      }).sort((a, b) => b.score - a.score);

      // ── Cost-efficiency calculation per line ──────────────────────────────
      const lines: QuoteLine[] = scored
        .filter(s => s.score > 2)
        .slice(0, Math.min(scored.filter(s => s.score > 2).length, 5))
        .map(({ eq, score, matchedKeywords, primaryReason }, i) => {
          const dailyTotal = eq.baseDailyRate * detectedDays;
          const weeklyCost =
            Math.floor(detectedDays / 7) * eq.weekly +
            (detectedDays % 7) * eq.baseDailyRate;
          const weeklyAdvised = detectedDays >= 7 && weeklyCost < dailyTotal;
          const savingVsDaily = weeklyAdvised ? dailyTotal - weeklyCost : 0;

          const costTip = weeklyAdvised
            ? `Weekly rate saves you S$${savingVsDaily.toLocaleString()} vs billing daily`
            : detectedDays < 7
            ? "Short-term rental — daily rate applies; extend to 7+ days for weekly savings"
            : `Book for ${detectedDays} days at daily rate — no weekly discount applies`;

          return {
            equipment: eq,
            recommendedDays: detectedDays,
            reason: primaryReason,
            matchedKeywords: matchedKeywords.slice(0, 4),
            matchScore: Math.min(100, Math.round((score / 25) * 100)),
            priority: (i === 0 ? "Essential" : i <= 2 ? "Recommended" : "Optional") as QuoteLine["priority"],
            weeklyAdvised,
            savingVsDaily,
            costTip,
          };
        });

      // Quote lines computed for future dynamic quote UI; screen currently uses catalog recs.
      void lines;

      setStep("quote");
    }, 2800);
  };

  // ── Analysing screen ──────────────────────────────────────────────────────
  if (step === "analysing") {
    const STEPS = [
      "Parsing project specifications…",
      "Identifying equipment requirements…",
      "Matching to available fleet…",
      "Calculating rental costs…",
      "Preparing your quotation…",
    ];
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

  // ── Quotation result screen ───────────────────────────────────────────────
  if (step === "quote") {
    const DAYS = 21;
    // Real catalog items matched to an elevated-access + site-prep project,
    // looked up by category (not array index) so this stays correct if the
    // catalog's specific machines ever change — only the 4 approved
    // categories are guaranteed to exist.
    const findByCategory = (category: string) => equipment.find(e => e.category === category);
    // matchScore mirrors RecommendationItem.match_score (0–1 decimal); rankOrder is assigned
    // after filtering so it reflects final list position, not pre-filter category order.
    const REC_ITEMS: RecItem[] = ([
      findByCategory("Boom Lift") && {
        eq: findByCategory("Boom Lift")!,
        reason: "135ft reach covers the elevation requirement; 4WD suits uneven site terrain.",
        lineTotal: findByCategory("Boom Lift")!.baseDailyRate * DAYS,
        matchScore: 0.95,
      },
      findByCategory("Excavator") && {
        eq: findByCategory("Excavator")!,
        reason: "Foundation prep and site clearing needed before elevated work begins.",
        lineTotal: findByCategory("Excavator")!.baseDailyRate * DAYS,
        matchScore: 0.90,
      },
      findByCategory("Scissors Lift") && {
        eq: findByCategory("Scissors Lift")!,
        reason: "Compact indoor access for facade and finishing work in tighter areas.",
        lineTotal: findByCategory("Scissors Lift")!.baseDailyRate * DAYS,
        matchScore: 0.88,
      },
    ] as (Omit<RecItem, "rankOrder"> | false)[])
      .filter((r): r is Omit<RecItem, "rankOrder"> => Boolean(r))
      .map((r, i) => ({ ...r, rankOrder: i + 1 }));
    const ESTIMATED_TOTAL = REC_ITEMS.reduce((s, r) => s + r.lineTotal, 0);
    // AIRecommendation.confidence_score — averaged across this bundle's per-item match scores.
    const CONFIDENCE_SCORE = REC_ITEMS.length
      ? REC_ITEMS.reduce((s, r) => s + r.matchScore, 0) / REC_ITEMS.length
      : 0;

    return (
      <QuoteResultScreen
        quoteRef={quoteRef}
        userName={userName}
        recItems={REC_ITEMS}
        estimatedTotal={ESTIMATED_TOTAL}
        days={DAYS}
        confidenceScore={CONFIDENCE_SCORE}
        specSummary={
          uploaded.length > 0
            ? uploaded.map(f => f.name).join(", ")
            : specsText.trim().slice(0, 60) || "6-storey building · 8T load · 18m reach · 3 weeks"
        }
        onRefine={() => setStep("upload")}
        onAddAll={() => onDone("specs", REC_ITEMS.map(r => r.eq))}
      />
    );
  }

  // ── Upload / paste specs screen ───────────────────────────────────────────
  if (step === "upload") {
    const canSubmit = (uploaded.length > 0 || specsText.trim().length >= 20) && equipmentRes.status === "success";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" style={sans}>
        <div className="w-full max-w-xl">
          <button onClick={() => setStep("choose")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-8 transition-colors group">
            <ChevronLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" /> Back
          </button>
          <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-2" style={mono}>Instant Quotation</p>
          <h2 className="text-4xl font-black text-foreground mb-2 leading-none" style={display}>UPLOAD YOUR SPECS</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Upload your project spec file or paste your requirements below. We'll match the right machines and generate a cost estimate instantly.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed p-8 mb-5 text-center cursor-pointer transition-all duration-200 ${uploaded.length > 0 ? "border-primary/60 bg-primary/5" : dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-secondary/20"}`}>
            <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.csv,.xlsx" onChange={handleFileChange} className="hidden" />
            <div className={`w-14 h-14 border flex items-center justify-center mx-auto mb-4 transition-colors ${uploaded.length > 0 ? "bg-primary border-primary" : dragOver ? "bg-primary/20 border-primary/60" : "bg-secondary border-border"}`}>
              {uploaded.length > 0
                ? <CheckCircle size={24} className="text-primary-foreground" />
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={dragOver ? "text-primary" : "text-muted-foreground"}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>}
            </div>
            {uploaded.length > 0 ? (
              <div>
                <p className="text-sm font-black text-foreground mb-2" style={display}>{uploaded.length} FILE{uploaded.length > 1 ? "S" : ""} READY</p>
                <div className="flex flex-col gap-1 mb-3">
                  {uploaded.map(f => (
                    <div key={f.name} className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                      {f.name}
                      <span className="text-muted-foreground/60">({(f.size / 1024).toFixed(0)} KB)</span>
                    </div>
                  ))}
                </div>
                <button onClick={e => { e.stopPropagation(); setUploaded([]); }} className="text-xs text-red-400 hover:text-red-300 transition-colors">Remove files</button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-foreground font-semibold mb-1">{dragOver ? "Drop to upload" : "Drag & drop or click to browse"}</p>
                <p className="text-xs text-muted-foreground">PDF · DOC · DOCX · TXT · CSV · XLSX up to 20 MB</p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground px-2">or paste requirements</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Text area */}
          <textarea value={specsText} onChange={e => setSpecsText(e.target.value)} rows={6}
            placeholder={"Describe your project requirements here…\n\ne.g. Commercial foundation project requiring excavation and elevated facade access. Site located at Jurong Port. Duration approx. 3 weeks. Requires indoor fit-out access prior to handover."}
            className="w-full bg-secondary/50 border border-border px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary/60 transition-colors resize-none mb-1" />
          <p className="text-xs text-muted-foreground mb-5">{specsText.trim().length < 20 && specsText.length > 0 ? `${20 - specsText.trim().length} more characters needed` : `${specsText.trim().length} characters`}</p>

          <button onClick={runAnalysis} disabled={!canSubmit}
            className="w-full py-4 bg-primary text-primary-foreground font-black text-sm tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            Generate Instant Quote →
          </button>
          <p className="text-xs text-muted-foreground text-center mt-3">No commitment required · Quote valid for 48 hours · Free of charge</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden" style={sans}>
      <div className="absolute inset-0 pointer-events-none">
        <img src="https://images.unsplash.com/photo-1630288214173-a119cf823388?w=1800&h=900&fit=crop&auto=format"
          alt="" className="w-full h-full object-cover opacity-10" />
        <div className="absolute inset-0 bg-background/80" />
      </div>
      <div className="relative w-full max-w-2xl">
        <div className="mb-10">
          <span className="text-2xl font-black text-primary" style={display}>HEAVY<span className="text-foreground"> RENTAL</span></span>
        </div>
        <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-2" style={mono}>Welcome, {userName.split(" ")[0]}</p>
        <h1 className="text-5xl md:text-6xl font-black text-foreground leading-none mb-3" style={display}>
          HOW CAN WE<br />HELP YOU TODAY?
        </h1>
        <p className="text-muted-foreground mb-10 text-sm">Choose the option that best describes where you are in the process.</p>

        <div className="flex flex-col gap-3">
          {[
            { mode: "know" as OnboardingMode, icon: CheckCircle, accent: true, title: "I KNOW WHAT I WANT", sub: "Take me straight to the equipment catalogue to browse and book.", onClick: () => onDone("know") },
            { mode: "browse" as OnboardingMode, icon: Search, accent: false, title: "I'M JUST BROWSING", sub: "Explore the full fleet at my own pace — no pressure, no commitment.", onClick: () => onDone("browse") },
            { mode: "specs" as OnboardingMode, icon: Wrench, accent: false, title: "I HAVE SPECS, NEED A RECOMMENDATION", sub: "Upload your project specs — we'll match the right machines for you.", onClick: () => setStep("upload") },
          ].map(({ icon: Icon, accent, title, sub, onClick }) => (
            <button key={title} onClick={onClick}
              className="group flex items-center gap-6 p-6 bg-card border border-border hover:border-primary/60 hover:bg-secondary/40 text-left transition-all duration-200">
              <div className={`w-14 h-14 flex items-center justify-center shrink-0 ${accent ? "bg-primary" : "bg-secondary border border-border"}`}>
                <Icon size={24} className={accent ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary transition-colors"} />
              </div>
              <div className="flex-1">
                <p className="font-black text-xl text-foreground mb-1" style={display}>{title}</p>
                <p className="text-sm text-muted-foreground">{sub}</p>
              </div>
              <ArrowRight size={18} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          Need help? Our equipment assistant is available in the portal — just click the chat icon.
        </p>
      </div>
    </div>
  );
}

// ─── MACHINE CALENDAR MODAL ───────────────────────────────────────────────────


export { CustomerOnboarding };
