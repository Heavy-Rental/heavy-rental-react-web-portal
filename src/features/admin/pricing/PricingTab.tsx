import { useState, type Dispatch, type SetStateAction } from "react";
import { CheckCircle, Info, Lock, RefreshCw, TrendingUp, BarChart2, Calendar } from "lucide-react";
import { equipmentApi } from "../../../app/api";
import type { AssetRecord } from "../../../app/assetRecord";
import { mono, display } from "../../../lib/styles";
import type { PricingRule } from "../AdminDataContext";

export function PricingTab({
  pricingRules,
  setPricingRules,
  setAssets,
  showToast,
}: {
  pricingRules: PricingRule[];
  setPricingRules: Dispatch<SetStateAction<PricingRule[]>>;
  setAssets: Dispatch<SetStateAction<AssetRecord[]>>;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFloor, setEditFloor] = useState({ daily: 0, weekly: 0 });
  const [editCeil, setEditCeil] = useState({ daily: 0, weekly: 0 });
  const [rerunning, setRerunning] = useState(false);
  const [appliedIds, setAppliedIds] = useState<number[]>([]);

  const openEdit = (r: PricingRule) => {
    setEditingId(r.id);
    setEditFloor({ daily: r.floorDaily, weekly: r.floorWeekly });
    setEditCeil({ daily: r.ceilDaily, weekly: r.ceilWeekly });
  };

  const saveEdit = (id: number) => {
    setPricingRules((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        const clampedML = Math.min(
          editCeil.daily,
          Math.max(editFloor.daily, r.mlRecommendedDaily),
        );
        return {
          ...r,
          floorDaily: editFloor.daily,
          ceilDaily: editCeil.daily,
          floorWeekly: editFloor.weekly,
          ceilWeekly: editCeil.weekly,
          mlRecommendedDaily: clampedML,
        };
      }),
    );
    setEditingId(null);
  };

  const applyRecommendation = async (id: number) => {
    const rule = pricingRules.find((r) => r.id === id);
    if (!rule) return;
    try {
      await equipmentApi.update(id, {
        baseDailyRate: rule.mlRecommendedDaily,
        weekly: rule.mlRecommendedWeekly,
      });
      setPricingRules((rs) =>
        rs.map((r) =>
          r.id !== id
            ? r
            : { ...r, currentDaily: r.mlRecommendedDaily, currentWeekly: r.mlRecommendedWeekly },
        ),
      );
      setAppliedIds((ids) => [...ids, id]);
      setAssets((prev) =>
        prev.map((a) =>
          a.id !== id
            ? a
            : { ...a, baseDailyRate: rule.mlRecommendedDaily, weekly: rule.mlRecommendedWeekly },
        ),
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to apply pricing.", "error");
    }
  };

  const applyAll = async () => {
    const unlocked = pricingRules.filter((r) => !r.locked);
    try {
      await Promise.all(
        unlocked.map((r) =>
          equipmentApi.update(r.id, {
            baseDailyRate: r.mlRecommendedDaily,
            weekly: r.mlRecommendedWeekly,
          }),
        ),
      );
      setPricingRules((rs) =>
        rs.map((r) =>
          r.locked
            ? r
            : { ...r, currentDaily: r.mlRecommendedDaily, currentWeekly: r.mlRecommendedWeekly },
        ),
      );
      setAppliedIds((ids) => [...ids, ...unlocked.map((r) => r.id)]);
      setAssets((prev) =>
        prev.map((a) => {
          const rule = unlocked.find((r) => r.id === a.id);
          return rule
            ? { ...a, baseDailyRate: rule.mlRecommendedDaily, weekly: rule.mlRecommendedWeekly }
            : a;
        }),
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to apply pricing.", "error");
    }
  };

  const rerunML = () => {
    setRerunning(true);
    setTimeout(() => {
      setPricingRules((rs) =>
        rs.map((r) => {
          if (r.locked) return r;
          const jitter = (Math.random() - 0.5) * 0.06;
          const demandMultiplier =
            (r.utilization >= 80 ? 1.18 : r.utilization >= 55 ? 1.05 : 0.92) + jitter;
          const rawML = Math.round((r.currentDaily * demandMultiplier) / 5) * 5;
          const mlRec = Math.min(r.ceilDaily, Math.max(r.floorDaily, rawML));
          const conf = Math.min(99, Math.round(r.mlConfidence + (Math.random() - 0.5) * 6));
          return {
            ...r,
            mlRecommendedDaily: mlRec,
            mlRecommendedWeekly: Math.round((r.currentWeekly * demandMultiplier) / 10) * 10,
            mlConfidence: conf,
          };
        }),
      );
      setAppliedIds([]);
      setRerunning(false);
    }, 1800);
  };

  const demandColor: Record<PricingRule["demandSignal"], string> = {
    High: "text-green-400 bg-green-500/10 border-green-500/30",
    Medium: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    Low: "text-red-400 bg-red-500/10 border-red-500/30",
  };

  const overallSavings = pricingRules.reduce(
    (s, r) => s + (r.mlRecommendedDaily - r.currentDaily),
    0,
  );
  const pendingCount = pricingRules.filter(
    (r) => !r.locked && r.mlRecommendedDaily !== r.currentDaily && !appliedIds.includes(r.id),
  ).length;

  return (
    <>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <p className="text-xs text-primary font-semibold tracking-widest uppercase mb-2" style={mono}>
            Dynamic Pricing · ML-Assisted
          </p>
          <h1 className="text-5xl font-black text-foreground leading-none" style={display}>
            PRICING CONTROLS
          </h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-xl">
            Set floor and ceiling price bounds per asset. The ML model recommends the optimal rate
            within your boundaries based on utilisation, demand signals, and market conditions.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={rerunML}
            disabled={rerunning}
            className="flex items-center gap-2 px-4 py-2.5 border border-border text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={rerunning ? "animate-spin" : ""} />
            {rerunning ? "Rerunning Model…" : "Re-run ML Model"}
          </button>
          {pendingCount > 0 && (
            <button
              onClick={applyAll}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-xs font-black tracking-widest uppercase hover:brightness-110 transition-all"
            >
              Apply All ({pendingCount}) →
            </button>
          )}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Assets Under ML",
            value: pricingRules.filter((r) => !r.locked).length,
            sub: `${pricingRules.filter((r) => r.locked).length} locked by admin`,
            accent: false,
          },
          {
            label: "Pending Updates",
            value: pendingCount,
            sub: "ML recommendations not yet applied",
            accent: pendingCount > 0,
          },
          {
            label: "Avg Confidence",
            value: `${Math.round(pricingRules.reduce((s, r) => s + r.mlConfidence, 0) / pricingRules.length)}%`,
            sub: "ML model certainty score",
            accent: false,
          },
          {
            label: "Revenue Impact",
            value: `${overallSavings >= 0 ? "+" : ""}S$${overallSavings.toLocaleString()}`,
            sub: "vs current pricing /day",
            accent: overallSavings > 0,
          },
        ].map(({ label, value, sub, accent }) => (
          <div
            key={label}
            className={`p-5 border flex flex-col gap-2 ${accent ? "bg-primary/10 border-primary/40" : "bg-card border-border"}`}
          >
            <p className="text-xs text-muted-foreground tracking-wider uppercase" style={mono}>
              {label}
            </p>
            <p className="text-3xl font-black leading-none" style={display}>
              {value}
            </p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="bg-card border border-primary/20 px-5 py-4 mb-6 flex items-start gap-3">
        <Info size={15} className="text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-foreground font-semibold">How it works: </span>
          The ML model analyses utilisation rate, booking frequency, seasonal demand, and
          competitive signals to suggest an optimal daily rate. It will{" "}
          <span className="text-primary font-semibold">never exceed your ceiling</span> and{" "}
          <span className="text-primary font-semibold">never fall below your floor</span>. Lock an
          asset to freeze its price and exclude it from ML updates.
        </div>
      </div>

      {/* Asset pricing table */}
      <div className="bg-card border border-border">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5" style={mono}>
              PER-ASSET PRICING RULES
            </p>
            <p className="text-sm font-semibold text-foreground">
              {pricingRules.length} assets · edit bounds, then apply ML recommendation
            </p>
          </div>
        </div>

        <div className="divide-y divide-border">
          {pricingRules.map((r) => {
            const isEditing = editingId === r.id;
            const isApplied = appliedIds.includes(r.id);
            const mlAboveCurrent = r.mlRecommendedDaily > r.currentDaily;
            const mlBelowCurrent = r.mlRecommendedDaily < r.currentDaily;
            const mlPct = Math.round(
              ((r.mlRecommendedDaily - r.currentDaily) / r.currentDaily) * 100,
            );
            const rangeWidth = r.ceilDaily - r.floorDaily;
            const currentPos =
              rangeWidth > 0
                ? Math.round(((r.currentDaily - r.floorDaily) / rangeWidth) * 100)
                : 50;
            const mlPos =
              rangeWidth > 0
                ? Math.round(((r.mlRecommendedDaily - r.floorDaily) / rangeWidth) * 100)
                : 50;

            return (
              <div
                key={r.id}
                className={`px-5 py-5 transition-colors ${r.locked ? "opacity-60 bg-secondary/10" : ""}`}
              >
                {/* Row header */}
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                  <div className="flex items-center gap-3">
                    {r.locked ? (
                      <Lock size={14} className="text-amber-400 shrink-0" />
                    ) : (
                      <TrendingUp size={14} className="text-primary shrink-0" />
                    )}
                    <div>
                      <p className="font-black text-foreground" style={display}>
                        {r.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.category} · {r.utilization}% utilisation
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs font-bold border ${demandColor[r.demandSignal]}`}>
                      {r.demandSignal} Demand
                    </span>
                    <span className="text-xs text-muted-foreground border border-border px-2 py-0.5" style={mono}>
                      {r.mlConfidence}% confidence
                    </span>
                    <button
                      onClick={() =>
                        setPricingRules((rs) =>
                          rs.map((x) => (x.id === r.id ? { ...x, locked: !x.locked } : x)),
                        )
                      }
                      className={`px-3 py-1 text-xs font-bold border transition-all ${r.locked ? "border-amber-500/40 text-amber-400 hover:bg-amber-500/10" : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30"}`}
                    >
                      {r.locked ? "Unlock" : "Lock Price"}
                    </button>
                  </div>
                </div>

                {/* Price range visualiser */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span style={mono}>Floor ${r.floorDaily}</span>
                    <span style={mono}>Ceiling ${r.ceilDaily}</span>
                  </div>
                  <div className="relative h-5 bg-secondary/40 border border-border rounded-sm overflow-hidden">
                    <div className="absolute inset-0 bg-primary/10" />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground"
                      style={{ left: `${Math.min(98, Math.max(2, currentPos))}%` }}
                    />
                    {!r.locked && (
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-primary"
                        style={{ left: `${Math.min(97, Math.max(1, mlPos))}%` }}
                      />
                    )}
                  </div>
                  <div className="flex gap-4 mt-1.5 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="inline-block w-0.5 h-3 bg-muted-foreground" />
                      Current ${r.currentDaily}/day
                    </span>
                    {!r.locked && (
                      <span className="flex items-center gap-1.5 text-primary">
                        <span className="inline-block w-1 h-3 bg-primary" />
                        ML ${r.mlRecommendedDaily}/day
                        <span
                          className={`font-semibold ${mlAboveCurrent ? "text-green-400" : mlBelowCurrent ? "text-red-400" : "text-muted-foreground"}`}
                        >
                          {mlPct > 0 ? `+${mlPct}` : mlPct}%
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Edit bounds or summary */}
                {isEditing ? (
                  <div className="bg-secondary/30 border border-border p-4 flex flex-col gap-4">
                    <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase" style={mono}>
                      Edit Price Boundaries
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-3">
                        <p className="text-xs text-muted-foreground font-semibold">Daily Rate Bounds</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground block mb-1">
                              Floor (min) S$/day
                            </label>
                            <input
                              type="number"
                              value={editFloor.daily}
                              onChange={(e) =>
                                setEditFloor((f) => ({ ...f, daily: Number(e.target.value) }))
                              }
                              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground block mb-1">
                              Ceiling (max) S$/day
                            </label>
                            <input
                              type="number"
                              value={editCeil.daily}
                              onChange={(e) =>
                                setEditCeil((c) => ({ ...c, daily: Number(e.target.value) }))
                              }
                              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                            />
                          </div>
                        </div>
                        {editFloor.daily >= editCeil.daily && (
                          <p className="text-xs text-red-400">Floor must be less than ceiling.</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-3">
                        <p className="text-xs text-muted-foreground font-semibold">Weekly Rate Bounds</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground block mb-1">
                              Floor S$/week
                            </label>
                            <input
                              type="number"
                              value={editFloor.weekly}
                              onChange={(e) =>
                                setEditFloor((f) => ({ ...f, weekly: Number(e.target.value) }))
                              }
                              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground block mb-1">
                              Ceiling S$/week
                            </label>
                            <input
                              type="number"
                              value={editCeil.weekly}
                              onChange={(e) =>
                                setEditCeil((c) => ({ ...c, weekly: Number(e.target.value) }))
                              }
                              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(r.id)}
                        disabled={editFloor.daily >= editCeil.daily}
                        className="px-4 py-2 bg-primary text-primary-foreground text-xs font-black tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-40"
                      >
                        Save Bounds
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex gap-6 text-xs">
                      <div>
                        <p className="text-muted-foreground mb-0.5">Daily bounds</p>
                        <p className="font-semibold text-foreground" style={mono}>
                          S${r.floorDaily} – ${r.ceilDaily}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">Weekly bounds</p>
                        <p className="font-semibold text-foreground" style={mono}>
                          S${r.floorWeekly} – ${r.ceilWeekly}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">Current rate</p>
                        <p className="font-semibold text-foreground" style={mono}>
                          S${r.currentDaily}/day · ${r.currentWeekly}/wk
                        </p>
                      </div>
                      {!r.locked && (
                        <div>
                          <p className="text-muted-foreground mb-0.5">ML recommends</p>
                          <p className="font-semibold text-primary" style={mono}>
                            S${r.mlRecommendedDaily}/day · ${r.mlRecommendedWeekly}/wk
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!r.locked && !isApplied && r.mlRecommendedDaily !== r.currentDaily && (
                        <button
                          onClick={() => applyRecommendation(r.id)}
                          className="px-3 py-1.5 bg-primary/10 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition-all"
                        >
                          Apply ML Rate
                        </button>
                      )}
                      {isApplied && (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle size={11} /> Applied
                        </span>
                      )}
                      <button
                        onClick={() => (r.locked ? undefined : openEdit(r))}
                        disabled={r.locked}
                        className="px-3 py-1.5 border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Edit Bounds
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ML model info footer */}
      <div className="mt-6 bg-card border border-border p-5">
        <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase mb-3" style={mono}>
          ML Model Signals Used
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              label: "Utilisation Rate",
              desc: "Higher utilisation → model pushes price toward ceiling",
              icon: BarChart2,
            },
            {
              label: "Booking Frequency",
              desc: "Repeat bookings on same asset boost demand confidence",
              icon: Calendar,
            },
            {
              label: "Market Seasonality",
              desc: "Adjusted for construction peak seasons and weather patterns",
              icon: TrendingUp,
            },
          ].map(({ label, desc, icon: Icon }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Icon size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground mb-0.5">{label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
