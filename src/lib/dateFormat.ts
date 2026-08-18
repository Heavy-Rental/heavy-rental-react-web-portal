// Cart/booking dates are stored as plain ISO "YYYY-MM-DD" strings (matching Booking.startDate/
// endDate's own convention) rather than a day-of-month + single month/year triple — that older
// shape couldn't represent a range crossing a month boundary (e.g. Aug 18 – Sep 18).

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}
export function formatDateLong(iso: string): string {
  const d = parseISODate(iso);
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}
export function formatDateShort(iso: string): string {
  const d = parseISODate(iso);
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}
export function daysBetweenISO(startISO: string, endISO: string): number {
  return (
    Math.round(
      (parseISODate(endISO).getTime() - parseISODate(startISO).getTime()) /
        86400000,
    ) + 1
  );
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayISO(now: Date = new Date()): string {
  return toISODate(now.getFullYear(), now.getMonth(), now.getDate());
}

export function isISODate(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const d = parseISODate(value);
  if (Number.isNaN(d.getTime())) return false;
  return toISODate(d.getFullYear(), d.getMonth(), d.getDate()) === value;
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d.getFullYear(), d.getMonth(), d.getDate());
}

export interface QuoteDateRange {
  startDate: string;
  endDate: string;
}

function positiveDays(days: number | null | undefined): number | null {
  if (typeof days !== "number" || !Number.isFinite(days) || days < 1) return null;
  return Math.floor(days);
}

function clampRangeToToday(range: QuoteDateRange, today: string): QuoteDateRange {
  if (range.startDate >= today) return range;
  return {
    startDate: today,
    endDate: addDaysISO(today, daysBetweenISO(range.startDate, range.endDate) - 1),
  };
}

/** DateRangeBar window from quote.tentativeStartDate, tentativeEndDate, and days. */
export function resolveQuoteDates(
  quote: {
    tentativeStartDate?: string | null;
    tentativeEndDate?: string | null;
    days?: number | null;
  },
  today: string = todayISO(),
): QuoteDateRange | null {
  const start = quote.tentativeStartDate;
  const end = quote.tentativeEndDate;
  const duration = positiveDays(quote.days);

  if (isISODate(start) && isISODate(end) && start <= end) {
    return clampRangeToToday({ startDate: start, endDate: end }, today);
  }
  if (isISODate(start) && duration !== null) {
    return clampRangeToToday(
      { startDate: start, endDate: addDaysISO(start, duration - 1) },
      today,
    );
  }
  if (duration !== null) {
    return { startDate: today, endDate: addDaysISO(today, duration - 1) };
  }
  return null;
}
// "Aug 18–22, 2026" when same month, "Aug 18 – Sep 18, 2026" across months, full dates on both ends across years.
export function formatDateRange(startISO: string, endISO: string): string {
  const s = parseISODate(startISO),
    e = parseISODate(endISO);
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${MONTH_NAMES[s.getMonth()].slice(0, 3)} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`;
  }
  if (s.getFullYear() === e.getFullYear()) {
    return `${formatDateShort(startISO)} – ${formatDateShort(endISO)}, ${e.getFullYear()}`;
  }
  return `${formatDateLong(startISO)} – ${formatDateLong(endISO)}`;
}
