"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
  /** Draws a divider above the item; used to keep destructive actions apart. */
  separated?: boolean;
}

interface MenuProps {
  items: MenuItem[];
  /** Accessible name for the trigger, e.g. "More actions for Meeting notes". */
  label: string;
  trigger?: ReactNode;
  triggerClassName?: string;
  align?: "start" | "end";
  /** Non-interactive content above the items, e.g. the signed-in account. */
  header?: ReactNode;
}

const MENU_WIDTH = 224;

/** Overflow menu rendered in a portal so cards and dialogs never clip it. */
export function Menu({ items, label, trigger, triggerClassName = "icon-btn", align = "end", header }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const below = rect.bottom + 6;
    const top = below + menuHeight > window.innerHeight - 8 ? Math.max(8, rect.top - menuHeight - 6) : below;
    const preferred = align === "end" ? rect.right - MENU_WIDTH : rect.left;
    const left = Math.min(Math.max(8, preferred), window.innerWidth - MENU_WIDTH - 8);
    // Positioning depends on the rendered menu, so it is measured after layout.
    setPosition({ top, left });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const firstItem = menuRef.current?.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])");
    firstItem?.focus();
    const close = () => setOpen(false);
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        buttonRef.current?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const entries = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])") ?? [])];
      const index = entries.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "ArrowDown" ? (index + 1) % entries.length : (index - 1 + entries.length) % entries.length;
      entries[next]?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    // Capture so Escape closes the menu before an enclosing dialog sees it.
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const choose = (item: MenuItem) => {
    if (item.disabled) return;
    setOpen(false);
    item.onSelect?.();
  };

  const itemClass = (item: MenuItem) =>
    `flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium focus:outline-none ${
      item.disabled ? "cursor-not-allowed text-slate-400" : item.destructive ? "text-red-700 hover:bg-red-50 focus:bg-red-50" : "text-slate-800 hover:bg-slate-100 focus:bg-slate-100"
    }`;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}
        className={triggerClassName}
      >
        {trigger ?? <MoreHorizontal size={18} aria-hidden="true" />}
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, width: MENU_WIDTH }}
          className="fixed z-[var(--z-toast)] rounded-xl border-2 border-slate-900 bg-white p-1.5 shadow-[var(--neubrutalism-shadow)]"
          onClick={(event) => event.stopPropagation()}
        >
          {header && <div className="mb-1.5 border-b border-slate-200 px-3 pb-2.5 pt-1.5">{header}</div>}
          {items.map((item) => {
            const Icon = item.icon;
            const content = <>{Icon && <Icon size={16} aria-hidden="true" />}{item.label}</>;
            return (
              <div key={item.label} className={item.separated ? "mt-1.5 border-t border-slate-200 pt-1.5" : ""}>
                {item.href && !item.disabled ? (
                  <Link href={item.href} role="menuitem" tabIndex={-1} className={itemClass(item)} onClick={() => setOpen(false)}>{content}</Link>
                ) : (
                  <button type="button" role="menuitem" aria-disabled={item.disabled || undefined} tabIndex={-1} className={itemClass(item)} onClick={() => choose(item)}>{content}</button>
                )}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
