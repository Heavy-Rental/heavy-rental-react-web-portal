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
