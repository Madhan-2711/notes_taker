/** Local-time calendar helpers for the month view. */

export function dayKey(time: number | Date): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function startOfDay(time: number | Date): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** First day of the week for a locale (0 = Sunday, 1 = Monday); Sunday when the browser can't tell. */
export function firstDayOfWeek(locale?: string): number {
  try {
    const info = (new Intl.Locale(locale ?? navigator.language) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } });
    const firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay;
    return firstDay === undefined ? 0 : firstDay % 7;
  } catch {
    return 0;
  }
}

export interface CalendarDay {
  date: Date;
  key: string;
  inMonth: boolean;
}

/** Whole weeks covering the month (5 or 6 rows), starting on `weekStart`. */
export function monthGrid(year: number, month: number, weekStart = 0): CalendarDay[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => {
    const date = new Date(year, month, 1 - offset + index);
    return { date, key: dayKey(date), inMonth: date.getMonth() === month };
  });
}

/** Short weekday names in display order, e.g. ["Sun", "Mon", ...]. */
export function weekdayLabels(weekStart = 0, locale?: string): { short: string; long: string }[] {
  // 2026-10-04 is a Sunday; any known Sunday works.
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(2026, 9, 4 + ((weekStart + index) % 7));
    return {
      short: date.toLocaleDateString(locale, { weekday: "short" }),
      long: date.toLocaleDateString(locale, { weekday: "long" }),
    };
  });
}
