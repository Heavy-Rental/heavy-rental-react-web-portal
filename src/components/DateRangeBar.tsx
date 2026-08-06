import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { MONTH_NAMES, DAY_LABELS, toISODate, formatDateLong } from "../lib/dateFormat";

// ─── SHARED DATE-RANGE BAR ────────────────────────────────────────────────────
// Hotel/flight-style: dates are chosen once here, every "Select" button across the
// portal (catalog grid, equipment detail page) reuses the same shared selection so
// every item in a booking shares one date range (Spec-ui-heavy-machinery-portal.md §4.3).

export function DateRangeBar({
  sharedStartDate,
  sharedEndDate,
  sharedMonth,
  sharedYear,
  setSharedStartDate,
  setSharedEndDate,
  setSharedMonth,
  setSharedYear,
  dateBarOpen,
  setDateBarOpen,
  locked,
  highlight,
}: {
  sharedStartDate: string | null;
  sharedEndDate: string | null;
  sharedMonth: number;
  sharedYear: number;
  setSharedStartDate: (d: string | null) => void;
  setSharedEndDate: (d: string | null) => void;
  setSharedMonth: React.Dispatch<React.SetStateAction<number>>;
  setSharedYear: React.Dispatch<React.SetStateAction<number>>;
  dateBarOpen: boolean;
  setDateBarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  locked: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`mb-8 bg-card border font-sans transition-shadow ${highlight ? "border-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.25)] animate-pulse" : "border-border"}`}
    >
      {highlight && (
        <p className="px-5 pt-3 text-xs font-semibold text-amber-400 flex items-center gap-1.5">
          <Calendar size={12} /> Pick your rental dates to finish adding these
          to your plan
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <button
          type="button"
          disabled={locked}
          onClick={() => setDateBarOpen((o) => !o)}
          className="flex-1 min-w-64 flex items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60 group"
        >
          <Calendar size={16} className="text-primary shrink-0" />
          <div className="flex-1 grid grid-cols-2 gap-3">
            <div
              className={`rounded-lg border px-4 py-2.5 transition-colors ${!sharedStartDate ? "border-amber-500/60 bg-amber-500/5" : "border-border group-hover:border-amber-500/40"}`}
            >
              <p className="text-[11px] text-muted-foreground tracking-wide uppercase">
                Start Date
              </p>
              <p className="font-semibold text-foreground text-sm mt-0.5">
                {sharedStartDate
                  ? formatDateLong(sharedStartDate)
                  : "Select date"}
              </p>
            </div>
            <div
              className={`rounded-lg border px-4 py-2.5 transition-colors ${sharedStartDate && !sharedEndDate ? "border-amber-500/60 bg-amber-500/5" : "border-border group-hover:border-amber-500/40"}`}
            >
              <p className="text-[11px] text-muted-foreground tracking-wide uppercase">
                End Date
              </p>
              <p className="font-semibold text-foreground text-sm mt-0.5">
                {sharedEndDate ? formatDateLong(sharedEndDate) : "Select date"}
              </p>
            </div>
          </div>
        </button>
        {locked ? (
          <p className="text-xs text-muted-foreground max-w-xs">
            Dates are locked to your cart's current selection — remove all items
            to change them.
          </p>
        ) : (
          sharedStartDate &&
          sharedEndDate && (
            <button
              type="button"
              onClick={() => {
                setSharedStartDate(null);
                setSharedEndDate(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Clear dates
            </button>
          )
        )}
      </div>

      {dateBarOpen &&
        !locked &&
        (() => {
          const prevMonth = () => {
            if (sharedMonth === 0) {
              setSharedMonth(11);
              setSharedYear((y) => y - 1);
            } else setSharedMonth((m) => m - 1);
          };
          const nextMonth = () => {
            if (sharedMonth === 11) {
              setSharedMonth(0);
              setSharedYear((y) => y + 1);
            } else setSharedMonth((m) => m + 1);
          };

          // Selection compares real ISO dates (not just day-of-month numbers scoped to one
          // "active" month), so picking a start in one visible month and an end in the other —
          // or navigating further before picking the end — genuinely spans a month boundary
          // (e.g. Aug 18 – Sep 18) instead of being forced into a single month.
          const handleDayClick = (month: number, year: number, d: number) => {
            const clicked = toISODate(year, month, d);
            if (!sharedStartDate || (sharedStartDate && sharedEndDate)) {
              setSharedStartDate(clicked);
              setSharedEndDate(null);
            } else if (clicked < sharedStartDate) {
              setSharedStartDate(clicked);
            } else {
              setSharedEndDate(clicked);
            }
          };

          const renderMonth = (
            month: number,
            year: number,
            nav: "prev" | "next" | null,
          ) => {
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const dayClass = (d: number) => {
              const iso = toISODate(year, month, d);
              const isStart = iso === sharedStartDate;
              const isEnd = iso === sharedEndDate;
              const inRange = !!(
                sharedStartDate &&
                sharedEndDate &&
                iso > sharedStartDate &&
                iso < sharedEndDate
              );
              if (isStart || isEnd) {
                const singleDay =
                  (isStart && isEnd) || (isStart && !sharedEndDate);
                return `bg-amber-500 text-black font-semibold ${singleDay ? "rounded-md" : isStart ? "rounded-l-md rounded-r-none" : "rounded-r-md rounded-l-none"}`;
              }
              if (inRange)
                return "bg-amber-500/15 text-foreground rounded-none";
              return "text-foreground hover:bg-amber-500/20 hover:text-amber-400 rounded-md";
            };
            return (
              <div key={`${year}-${month}`} className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-3">
                  {nav === "prev" ? (
                    <button
                      onClick={prevMonth}
                      className="p-1 border border-border hover:border-amber-500/50 hover:text-amber-400 text-muted-foreground transition-colors rounded-md"
                    >
                      <ChevronLeft size={13} />
                    </button>
                  ) : (
                    <span className="w-[26px]" />
                  )}
                  <span className="text-sm font-semibold text-foreground tracking-wide">
                    {MONTH_NAMES[month]} {year}
                  </span>
                  {nav === "next" ? (
                    <button
                      onClick={nextMonth}
                      className="p-1 border border-border hover:border-amber-500/50 hover:text-amber-400 text-muted-foreground transition-colors rounded-md"
                    >
                      <ChevronRight size={13} />
                    </button>
                  ) : (
                    <span className="w-[26px]" />
                  )}
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {DAY_LABELS.map((d) => (
                    <div
                      key={d}
                      className="text-center text-[11px] text-muted-foreground tracking-wide py-1"
                    >
                      {d[0]}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-0.5">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`e${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const d = i + 1;
                    return (
                      <button
                        key={d}
                        onClick={() => handleDayClick(month, year, d)}
                        className={`w-9 h-9 flex items-center justify-center text-sm font-medium transition-colors duration-100 mx-auto ${dayClass(d)}`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          };

          const month2 = sharedMonth === 11 ? 0 : sharedMonth + 1;
          const year2 = sharedMonth === 11 ? sharedYear + 1 : sharedYear;

          return (
            <div className="border-t border-border p-5">
              <div className="flex flex-col sm:flex-row gap-8">
                {renderMonth(sharedMonth, sharedYear, "prev")}
                {renderMonth(month2, year2, "next")}
              </div>
              <div className="flex justify-end pt-4 mt-4 border-t border-border">
                <button
                  type="button"
                  disabled={!sharedStartDate || !sharedEndDate}
                  onClick={() => setDateBarOpen(false)}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-6 py-2 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Done
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
