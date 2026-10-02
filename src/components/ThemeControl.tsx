"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyThemePreference, readThemePreference, type ThemePreference } from "../lib/theme";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Match device", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/** System, light or dark appearance, remembered on this device. */
export function ThemeControl() {
  const [value, setValue] = useState<ThemePreference>("system");
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setValue(readThemePreference()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const choose = (next: ThemePreference) => {
    setValue(next);
    applyThemePreference(next);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const index = OPTIONS.findIndex((option) => option.value === value);
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const next = OPTIONS[(index + step + OPTIONS.length) % OPTIONS.length].value;
    choose(next);
    window.requestAnimationFrame(() => groupRef.current?.querySelector<HTMLElement>(`[data-value="${next}"]`)?.focus());
  };

  return (
    <div ref={groupRef} role="radiogroup" aria-label="Appearance" onKeyDown={onKeyDown} className="inline-grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
      {OPTIONS.map(({ value: option, label, icon: Icon }) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            data-value={option}
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => choose(option)}
            className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors ${selected ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-300" : "text-slate-700 hover:text-slate-900"}`}
          >
            <Icon size={15} aria-hidden="true" /> {label}
          </button>
        );
      })}
    </div>
  );
}
