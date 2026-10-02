"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { BookOpen, FolderOpen, Home, Plus, Search, Settings, Users, type LucideIcon } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useNoteTitles } from "../hooks/useNoteTitles";
import { db, hasValidConfig } from "../lib/firebaseConfig";
import { subscribeToNotes } from "../lib/services/notes/normalNotesService";
import { recentNoteHref } from "../lib/noteNavigation";
import { noteModeInfo } from "../lib/noteModes";
import type { Group, Note } from "../lib/validations";
import { Dialog } from "./ui/Dialog";

export const OPEN_COMMAND_PALETTE = "notes-taker:open-command-palette";

/** Opens the palette from anywhere, e.g. the header search button. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE));
}

interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  section: "Pages" | "Notes" | "Groups";
}

const PAGES: PaletteItem[] = [
  { id: "page:new", label: "New note", hint: "N", href: "/write", icon: Plus, section: "Pages" },
  { id: "page:home", label: "Home", hint: "Page", href: "/", icon: Home, section: "Pages" },
  { id: "page:notes", label: "Notes", hint: "Page", href: "/notes", icon: BookOpen, section: "Pages" },
  { id: "page:groups", label: "Groups", hint: "Page", href: "/groups", icon: FolderOpen, section: "Pages" },
  { id: "page:friends", label: "Friends", hint: "Page", href: "/friends", icon: Users, section: "Pages" },
  { id: "page:settings", label: "Settings", hint: "Page", href: "/settings", icon: Settings, section: "Pages" },
];

const MAX_NOTES = 8;

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest("input, textarea, select, [contenteditable=true], [contenteditable='']"));
}

/** Global shortcuts: Ctrl/Cmd+K opens a jump-to palette; N starts a new note. */
export function CommandPalette() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(0);
  const [notes, setNotes] = useState<Note[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const titleOf = useNoteTitles(notes);
  const listRef = useRef<HTMLUListElement>(null);
  const inputId = useId();
  const listId = useId();

  useEffect(() => {
    if (!user) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (isTyping(event.target) || document.querySelector("[role=dialog], [role=menu]") || pathname === "/write") return;
      event.preventDefault();
      router.push("/write");
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_PALETTE, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_PALETTE, onOpen);
    };
  }, [user, router, pathname]);

  // Only listen to notes and groups while the palette is open.
  useEffect(() => {
    if (!open || !user || !hasValidConfig) return;
    const stopNotes = subscribeToNotes(user.uid, setNotes);
    const stopGroups = onSnapshot(query(collection(db, "groups"), where("authorId", "==", user.uid)), (snapshot) => {
      setGroups(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Group[]);
    });
    return () => { stopNotes(); stopGroups(); };
  }, [open, user]);

  const items = useMemo(() => {
    const needle = term.trim().toLocaleLowerCase();
    const matches = (text: string) => !needle || text.toLocaleLowerCase().includes(needle);
    const noteItems = [...notes]
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
      .filter((note) => matches(titleOf(note)))
      .slice(0, MAX_NOTES)
      .map<PaletteItem>((note) => ({
        id: `note:${note.id}`,
        label: titleOf(note),
        hint: noteModeInfo(note.mode).label,
        href: recentNoteHref(note),
        icon: noteModeInfo(note.mode).icon,
        section: "Notes",
      }));
    const groupItems = groups
      .filter((group) => needle && matches(group.title))
      .slice(0, 4)
      .map<PaletteItem>((group) => ({ id: `group:${group.id}`, label: group.title, hint: "Group", href: `/groups/${group.id}`, icon: FolderOpen, section: "Groups" }));
    const pageItems = PAGES.filter((page) => matches(page.label));
    // With a search term, matching notes matter most; without one, pages come first.
    return needle ? [...noteItems, ...groupItems, ...pageItems] : [...pageItems, ...noteItems];
  }, [term, notes, groups, titleOf]);

  const activeIndex = Math.min(active, Math.max(0, items.length - 1));

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const close = () => { setOpen(false); setTerm(""); setActive(0); };
  const go = (item: PaletteItem | undefined) => {
    if (!item) return;
    close();
    router.push(item.href);
  };

  const onInputKey = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((activeIndex + 1) % Math.max(1, items.length)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((activeIndex - 1 + items.length) % Math.max(1, items.length)); }
    else if (event.key === "Enter") { event.preventDefault(); go(items[activeIndex]); }
  };

  if (!user) return null;

  let lastSection: string | null = null;

  return (
    <Dialog open={open} onClose={close} label="Jump to a note or page" size="md" className="self-start sm:mt-[12dvh]">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4">
        <Search size={18} className="shrink-0 text-slate-600" aria-hidden="true" />
        <input
          id={inputId}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={items[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-label="Search notes, groups and pages"
          value={term}
          onChange={(event) => { setTerm(event.target.value); setActive(0); }}
          onKeyDown={onInputKey}
          placeholder="Jump to a note, group or page…"
          autoComplete="off"
          spellCheck={false}
          data-autofocus
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-500 focus:outline-none"
        />
        <kbd className="hidden rounded-md border border-slate-300 px-1.5 text-xs font-semibold text-slate-600 sm:block">Esc</kbd>
      </div>
      <ul ref={listRef} id={listId} role="listbox" aria-label="Results" className="max-h-[min(60dvh,420px)] overflow-y-auto p-2">
        {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-600">Nothing matches &ldquo;{term}&rdquo;.</li>}
        {items.map((item, index) => {
          const heading = item.section !== lastSection ? item.section : null;
          lastSection = item.section;
          const Icon = item.icon;
          return (
            <li key={item.id} role="presentation">
              {heading && <p className="px-3 pb-1 pt-3 text-xs font-semibold text-slate-600 first:pt-1" role="presentation">{heading}</p>}
              <div
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                data-index={index}
                onMouseMove={() => setActive(index)}
                onClick={() => go(item)}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm ${index === activeIndex ? "bg-indigo-50 text-indigo-900" : "text-slate-800"}`}
              >
                <Icon size={16} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                <span className="shrink-0 text-xs text-slate-600">{item.hint}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 px-4 py-2.5 text-xs text-slate-600">
        <span><kbd className="font-semibold">↑ ↓</kbd> move</span>
        <span><kbd className="font-semibold">Enter</kbd> open</span>
        <span><kbd className="font-semibold">N</kbd> new note</span>
        <span><kbd className="font-semibold">/</kbd> search on Notes</span>
      </div>
    </Dialog>
  );
}
