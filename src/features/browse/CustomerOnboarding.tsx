import { useState, useRef } from "react";
import { Search, ArrowRight, Wrench, CheckCircle, ChevronLeft, ChevronRight, Sparkles, Gauge, Info } from "lucide-react";
import type { Asset as EquipmentItem, OnboardingMode } from "../../app/types";
import {
  recommendationApi,
  type CreateProjectSpecResponse,
  type ProjectSpecEquipment,
} from "../../app/api";
import {
  resolveQuoteDates,
  type QuoteDateRange,
} from "../../lib/dateFormat";
import { equipmentImageSrc } from "./equipmentImageSrc";

// Styles
const mono = { fontFamily: "'DM Mono', monospace" } as const;
const display = { fontFamily: "'Barlow Condensed', sans-serif" } as const;
const sans = { fontFamily: "'DM Sans', sans-serif" } as const;

function toEquipment(eq: ProjectSpecEquipment): EquipmentItem {
  return {
    minDailyRate: eq.baseDailyRate,
    maxDailyRate: eq.baseDailyRate,
    rating: 0,
    reviews: 0,
    utilization: 0,
    revenue: 0,
    hoursThisMonth: 0,
    idealFor: [],
    serialno: "",
    condition: null,
    lastConditionUpdatedAt: null,
    ...eq,
    weekly: eq.weekly ?? 0,
    tags: eq.tags ?? [],
    img: eq.img ?? "",
  };
}

// ─── Quote Result Screen ───────────────────────────────────────────────────
// Bound to POST /api/recommendations/project-spec Instant Quotation DTO.

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
  specSummary, rationale, onRefine, onAddAll,
}: {
  quoteRef: string;
  userName: string;
  recItems: RecItem[];
  estimatedTotal: number;
  days: number;
  confidenceScore: number; // AIRecommendation.confidence_score — 0–1 decimal, e.g. 0.91 = 91%
  specSummary: string;
  rationale: string;
  onRefine: () => void;
  onAddAll: (equipment: EquipmentItem[]) => void;
}) {
  const [checked, setChecked] = useState<boolean[]>(recItems.map(() => true));
  const [previewEq, setPreviewEq] = useState<EquipmentItem | null>(null);

  // Quantities are fixed at 1 — AI-recommended bundles aren't user-adjustable on this step
  // (Spec-frontend-ui-changes.md: disable quantity modifier on recommendation cards).
  const checkedItems = recItems.filter((_, i) => checked[i]);
  const checkedTotal = checkedItems.reduce((sum, r) => sum + Math.round(r.lineTotal), 0);

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
        <div className="bg-card border border-border px-4 py-3 flex items-start justify-between gap-3 mb-6">
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <span className="text-xs font-semibold text-muted-foreground tracking-widest uppercase" style={mono}>Your Project Spec</span>
            <span className="text-sm text-foreground whitespace-pre-wrap break-words">{specSummary}</span>
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
                      {equipmentImageSrc(r.eq.img, 128, 96) ? (
                        <img
                          src={equipmentImageSrc(r.eq.img, 128, 96)!}
                          alt={r.eq.name}
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                      ) : null}
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
            {rationale || `This bundle was chosen to cover the requirements of your ${days}-day project.`}
          </p>
        </div>

        {/* 5 — Total bar */}
        <div className="flex items-center justify-between bg-card border border-border px-5 py-4 mb-6">
          <p className="text-sm text-muted-foreground">Estimated total <span className="text-xs">({days} days · {checkedItems.length} items selected)</span></p>
          <p className="text-2xl font-black text-foreground" style={display}>S${checkedTotal.toLocaleString()}</p>
        </div>

        {/* 6 — Primary CTA — pass selected quote equipment into the rental plan */}
        <button
          type="button"
          disabled={checkedItems.length === 0}
          onClick={() => onAddAll(checkedItems.map((r) => r.eq))}
          className="w-full py-4 bg-primary text-primary-foreground text-sm font-black tracking-widest uppercase hover:brightness-110 transition-all mb-3 disabled:opacity-40 disabled:cursor-not-allowed">
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
              {equipmentImageSrc(previewEq.img, 600, 400) ? (
                <img
                  src={equipmentImageSrc(previewEq.img, 600, 400)!}
                  alt={previewEq.name}
                  className="w-full h-full object-cover opacity-85"
                />
              ) : null}
            </div>

            <div className="px-5 py-5 flex flex-col gap-5">
              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">{previewEq.desc}</p>

              {/* Key specs grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Base Daily Rate",   value: `S$${previewEq.baseDailyRate.toLocaleString()}/day` },
                  { label: "Weekly Rate",  value: previewEq.weekly ? `S$${previewEq.weekly.toLocaleString()}/week` : "—" },
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

function CustomerOnboarding({ userName, onDone, initialStep = "choose" }: { userName: string; onDone: (mode: OnboardingMode, recs?: EquipmentItem[], quoteDates?: QuoteDateRange) => void; initialStep?: "choose" | "upload" }) {
  const [step, setStep] = useState<"choose" | "upload" | "analysing" | "quote">(initialStep);
  const [uploaded, setUploaded] = useState<File[]>([]);
  const [specsText, setSpecsText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [quote, setQuote] = useState<CreateProjectSpecResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setUploaded(Array.from(e.target.files));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => /\.(pdf|doc|docx|txt|csv|xlsx)$/i.test(f.name));
    if (files.length) setUploaded(files);
  };

  const runAnalysis = async () => {
    setSubmitError(null);
    setStep("analysing");
    const projectText = specsText.trim();
    try {
      const result = uploaded.length > 0
        ? await recommendationApi.createFromProjectSpecMultipart({
            file: uploaded[0],
            projectText: projectText || undefined,
            userName,
          })
        : await recommendationApi.createFromProjectSpec({
            projectText,
            userName,
          });
      setQuote(result);
      setStep("quote");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setStep("upload");
    }
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
  if (step === "quote" && quote) {
    const recItems: RecItem[] = quote.items.map((item) => ({
      eq: toEquipment(item.equipment),
      reason: item.reason,
      lineTotal: item.lineTotal,
      rankOrder: item.rankOrder,
      matchScore: item.matchScore,
    }));

    return (
      <QuoteResultScreen
        quoteRef={quote.quoteRef}
        userName={userName}
        recItems={recItems}
        estimatedTotal={quote.estimatedTotal}
        days={quote.days ?? 1}
        confidenceScore={quote.confidenceScore}
        specSummary={quote.specSummary}
        rationale={quote.rationale}
        onRefine={() => setStep("upload")}
        onAddAll={(eqs) => onDone("specs", eqs, resolveQuoteDates(quote) ?? undefined)}
      />
    );
  }

  // ── Upload / paste specs screen ───────────────────────────────────────────
  if (step === "upload") {
    const canSubmit = uploaded.length > 0 || specsText.trim().length >= 20;
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

          {submitError && (
            <p className="text-xs text-red-400 mb-3" role="alert">{submitError}</p>
          )}
          <button onClick={() => void runAnalysis()} disabled={!canSubmit}
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
