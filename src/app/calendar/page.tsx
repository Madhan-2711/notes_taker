"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BookOpenText, ChevronLeft, ChevronRight, LoaderCircle, NotebookPen, Repeat } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useNoteTitles } from "../../hooks/useNoteTitles";
import { useTodaysNote } from "../../hooks/useTodaysNote";
import { useNoteMeta } from "../../contexts/NoteMetaContext";
import { hasValidConfig } from "../../lib/firebaseConfig";
import { subscribeToNotes } from "../../lib/services/notes/normalNotesService";
import { recentNoteHref } from "../../lib/noteNavigation";
import { noteModeInfo } from "../../lib/noteModes";
import { occurrencesBetween, repeatLabel, type ReminderRepeat } from "../../lib/noteMeta";
import { dayKey, firstDayOfWeek, monthGrid, startOfDay, weekdayLabels } from "../../lib/calendar";
import type { Note } from "../../lib/validations";
import { PageHeader } from "../../components/PageHeader";
import { PageLoading, SignInRequired } from "../../components/PageState";

interface DayItems {
  reminders: { note: Note; at: number; repeat: ReminderRepeat | null }[];
  written: Note[];
}

const EMPTY_DAY: DayItems = { reminders: [], written: [] };

function timeLabel(time: number) {
  return new Date(time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function CalendarPage() {
  const { user, loading } = useAuth();
  const { metaByNote } = useNoteMeta();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [today, setToday] = useState(() => startOfDay(Date.now()));
  const [view, setView] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const [selected, setSelected] = useState(() => dayKey(Date.now()));
  const [weekStart, setWeekStart] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const focusAfterRender = useRef(false);
  const liveNotes = useMemo(() => (notes ?? []).filter((note) => !note.deletedAt), [notes]);
  const titleOf = useNoteTitles(liveNotes);
  const { openTodaysNote, busy: creatingToday } = useTodaysNote(liveNotes);

  useEffect(() => {
    if (!user || !hasValidConfig) return;
    return subscribeToNotes(user.uid, setNotes);
  }, [user]);

  // Locale week start and "today" are only known in the browser; refresh today at midnight.
  useEffect(() => {
    const timer = window.setTimeout(() => setWeekStart(firstDayOfWeek()), 0);
    const tick = window.setInterval(() => setToday(startOfDay(Date.now())), 60_000);
    return () => { window.clearTimeout(timer); window.clearInterval(tick); };
  }, []);

  const grid = useMemo(() => monthGrid(view.year, view.month, weekStart), [view, weekStart]);
  const labels = useMemo(() => weekdayLabels(weekStart), [weekStart]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, DayItems>();
    const entry = (key: string) => {
      let value = map.get(key);
      if (!value) { value = { reminders: [], written: [] }; map.set(key, value); }
      return value;
    };
    const from = grid[0].date.getTime();
    const to = startOfDay(grid[grid.length - 1].date) + 86_400_000;
    const byId = new Map(liveNotes.map((note) => [note.id, note]));
    for (const note of liveNotes) {
      if (note.createdAt >= from && note.createdAt < to) entry(dayKey(note.createdAt)).written.push(note);
    }
    metaByNote.forEach((meta, noteId) => {
      const note = byId.get(noteId);
      if (!note || meta.reminderAt === null) return;
      for (const at of occurrencesBetween(meta.reminderAt, meta.repeat, from, to)) {
        entry(dayKey(at)).reminders.push({ note, at, repeat: meta.repeat });
      }
    });
    map.forEach((value) => {
      value.reminders.sort((a, b) => a.at - b.at);
      value.written.sort((a, b) => a.createdAt - b.createdAt);
    });
    return map;
  }, [grid, liveNotes, metaByNote]);

  // Keep keyboard focus on the selected day after arrow-key moves re-render the grid.
  useEffect(() => {
    if (!focusAfterRender.current) return;
    focusAfterRender.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${selected}"]`)?.focus();
  }, [selected, view]);

  if (loading) return <PageLoading cards={2} label="Loading calendar" />;
  if (!user) return <SignInRequired>Sign in to see your calendar.</SignInRequired>;

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const shiftMonth = (delta: number) => setView((current) => {
    const date = new Date(current.year, current.month + delta, 1);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const goToday = () => {
    const now = new Date();
    setView({ year: now.getFullYear(), month: now.getMonth() });
    setSelected(dayKey(now));
  };
  const selectDate = (date: Date, focus = false) => {
    focusAfterRender.current = focus;
    setSelected(dayKey(date));
    if (date.getMonth() !== view.month || date.getFullYear() !== view.year) setView({ year: date.getFullYear(), month: date.getMonth() });
  };

  const onGridKey = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in moves) && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const [y, m, d] = selected.split("-").map(Number);
    const current = new Date(y, m - 1, d);
    if (event.key === "Home") current.setDate(current.getDate() - ((current.getDay() - weekStart + 7) % 7));
    else if (event.key === "End") current.setDate(current.getDate() + 6 - ((current.getDay() - weekStart + 7) % 7));
    else current.setDate(current.getDate() + moves[event.key]);
    selectDate(current, true);
  };

  const selectedItems = itemsByDay.get(selected) ?? EMPTY_DAY;
  const [sy, sm, sd] = selected.split("-").map(Number);
  const selectedLabel = new Date(sy, sm - 1, sd).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const todayKey = dayKey(today);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Calendar"
        subtitle="Reminders and the notes you wrote, day by day."
        actions={
          <button type="button" onClick={() => void openTodaysNote()} disabled={creatingToday || notes === null} className="btn-primary">
            {creatingToday ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <NotebookPen size={16} aria-hidden="true" />}
            Today&apos;s note
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="month-heading" className="card p-3 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 id="month-heading" className="text-xl font-bold tracking-tight" aria-live="polite">{monthLabel}</h2>
            <div className="flex items-center gap-1">
              <button type="button" onClick={goToday} className="btn-quiet min-h-10 px-3">Today</button>
              <button type="button" onClick={() => shiftMonth(-1)} className="icon-btn" aria-label="Previous month"><ChevronLeft size={20} aria-hidden="true" /></button>
              <button type="button" onClick={() => shiftMonth(1)} className="icon-btn" aria-label="Next month"><ChevronRight size={20} aria-hidden="true" /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-200 pb-2 text-center text-xs font-semibold text-slate-600" aria-hidden="true">
            {labels.map((label) => <span key={label.long}>{label.short}</span>)}
          </div>
          <div ref={gridRef} role="group" aria-label={`Days in ${monthLabel}. Use arrow keys to move between days.`} onKeyDown={onGridKey} className="mt-1 grid grid-cols-7 gap-1">
            {grid.map((day) => {
              const items = itemsByDay.get(day.key) ?? EMPTY_DAY;
              const isSelected = day.key === selected;
              const isToday = day.key === todayKey;
              const summary = [
                items.reminders.length ? `${items.reminders.length} ${items.reminders.length === 1 ? "reminder" : "reminders"}` : "",
                items.written.length ? `${items.written.length} ${items.written.length === 1 ? "note" : "notes"}` : "",
              ].filter(Boolean).join(", ");
              const label = `${day.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${isToday ? ", today" : ""}${summary ? `, ${summary}` : ""}`;
              const preview = [
                ...items.reminders.map((item) => ({ key: `r-${item.note.id}-${item.at}`, text: `${timeLabel(item.at)} ${titleOf(item.note)}`, kind: "reminder" as const })),
                ...items.written.map((note) => ({ key: `n-${note.id}`, text: titleOf(note), kind: "note" as const })),
              ];
              return (
                <button
                  key={day.key}
                  type="button"
                  data-day={day.key}
                  aria-label={label}
                  aria-pressed={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => selectDate(day.date)}
                  className={`flex min-h-14 flex-col items-stretch rounded-xl border p-1 text-left transition-colors sm:min-h-24 sm:p-1.5 ${
                    isSelected ? "border-slate-900 bg-indigo-50 ring-2 ring-slate-900" : "border-transparent hover:border-slate-300 hover:bg-slate-50"
                  } ${day.inMonth ? "" : "opacity-50"}`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center self-center rounded-full text-sm font-semibold tabular-nums sm:self-start ${
                    isToday ? "bg-primary-strong text-white" : "text-slate-800"
                  }`}>
                    {day.date.getDate()}
                  </span>
                  {/* Phones: dots. Larger screens: the first two items by name. */}
                  <span className="mt-auto flex justify-center gap-1 pb-0.5 sm:hidden" aria-hidden="true">
                    {items.reminders.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />}
                    {items.written.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />}
                  </span>
                  <span className="mt-1 hidden min-w-0 flex-col gap-0.5 sm:flex" aria-hidden="true">
                    {preview.slice(0, 2).map((item) => (
                      <span key={item.key} className={`truncate rounded px-1 text-[11px] font-medium leading-4 ${item.kind === "reminder" ? "bg-amber-50 text-amber-900" : "bg-indigo-50 text-indigo-900"}`}>
                        {item.text}
                      </span>
                    ))}
                    {preview.length > 2 && <span className="px-1 text-[11px] font-semibold text-slate-600">+{preview.length - 2} more</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-600" aria-hidden="true" /> Reminder</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-600" aria-hidden="true" /> Note written</span>
          </p>
        </section>

        <aside aria-labelledby="day-heading" className="panel h-fit p-5 lg:sticky lg:top-24">
          <h2 id="day-heading" className="text-lg font-bold tracking-tight">{selected === todayKey ? `Today, ${selectedLabel}` : selectedLabel}</h2>
          {notes === null ? (
            <div className="mt-4 space-y-2" aria-busy="true" aria-label="Loading">
              <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : selectedItems.reminders.length === 0 && selectedItems.written.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              Nothing on this day. Open a note and choose Reminder to plan something{selected === todayKey ? ", or start today's note" : ""}.
            </p>
          ) : (
            <div className="mt-4 space-y-5">
              {selectedItems.reminders.length > 0 && (
                <section aria-labelledby="day-reminders">
                  <h3 id="day-reminders" className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Bell size={15} aria-hidden="true" /> Reminders</h3>
                  <ul className="space-y-1">
                    {selectedItems.reminders.map((item) => (
                      <li key={`${item.note.id}-${item.at}`}>
                        <Link href={recentNoteHref(item.note)} className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-slate-100">
                          <span className="w-16 shrink-0 text-sm font-semibold tabular-nums text-amber-900">{timeLabel(item.at)}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{titleOf(item.note)}</span>
                          {item.repeat && <span className="flex shrink-0 items-center gap-1 text-xs text-slate-600"><Repeat size={12} aria-hidden="true" />{repeatLabel(item.repeat)}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {selectedItems.written.length > 0 && (
                <section aria-labelledby="day-notes">
                  <h3 id="day-notes" className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800"><BookOpenText size={15} aria-hidden="true" /> Written this day</h3>
                  <ul className="space-y-1">
                    {selectedItems.written.map((note) => {
                      const mode = noteModeInfo(note.mode);
                      const Icon = mode.icon;
                      return (
                        <li key={note.id}>
                          <Link href={recentNoteHref(note)} className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-slate-100">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${mode.badge}`} title={mode.label}><Icon size={14} aria-hidden="true" /></span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{titleOf(note)}</span>
                            <span className="shrink-0 text-xs tabular-nums text-slate-600">{timeLabel(note.createdAt)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
