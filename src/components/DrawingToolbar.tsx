"use client";

/**
 * Tool switch for the collaborative note. Chooses whether pointer input goes to
 * the text layer or draws ink, and picks the pen, color, and size. Both layers
 * stay live at all times — this only routes the next drag.
 */

import { Type, Pen, Brush, Highlighter, Eraser, Undo2, Redo2 } from "lucide-react";
import { DEFAULT_COLORS, isPenTool, type DrawTool } from "../lib/drawing";

interface DrawingToolbarProps {
  tool: DrawTool;
  onToolChange: (tool: DrawTool) => void;
  color: string;
  onColorChange: (color: string) => void;
  size: number;
  onSizeChange: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  disabled?: boolean;
}

const TOOLS: { value: DrawTool; label: string; Icon: typeof Type }[] = [
  { value: "text", label: "Text", Icon: Type },
  { value: "pen", label: "Pen", Icon: Pen },
  { value: "marker", label: "Marker", Icon: Brush },
  { value: "highlighter", label: "Highlighter", Icon: Highlighter },
  { value: "eraser", label: "Eraser", Icon: Eraser },
];

export function DrawingToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  size,
  onSizeChange,
  onUndo,
  onRedo,
  disabled = false,
}: DrawingToolbarProps) {
  const showInk = isPenTool(tool);

  return (
    <div className="glass neubrutal flex flex-wrap items-center gap-1.5 rounded-2xl p-1.5 sm:gap-2 sm:p-2">
      {/* Tool switch */}
      <div className="flex items-center gap-1">
        {TOOLS.map(({ value, label, Icon }) => {
          const selected = tool === value;
          return (
            <button
              key={value}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onToolChange(value)}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${
                selected
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-foreground/60 hover:bg-foreground/5"
              }`}
            >
              <Icon size={17} />
            </button>
          );
        })}
      </div>

      {showInk && (
        <>
          <div className="mx-0.5 h-6 w-px bg-border" />

          {/* Colors */}
          <div className="flex items-center gap-1">
            {DEFAULT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                disabled={disabled}
                onClick={() => onColorChange(c)}
                className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 disabled:opacity-40 ${
                  color === c ? "border-foreground/70" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="mx-0.5 h-6 w-px bg-border" />

          {/* Size */}
          <label className="flex items-center gap-2 px-1" title="Brush size">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
              Size
            </span>
            <input
              type="range"
              min={1}
              max={40}
              value={size}
              disabled={disabled}
              onChange={(e) => onSizeChange(Number(e.target.value))}
              className="w-20 accent-emerald-500 disabled:opacity-40"
            />
          </label>
        </>
      )}

      <div className="mx-0.5 h-6 w-px bg-border" />

      {/* History */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          title="Undo"
          aria-label="Undo"
          disabled={disabled}
          onClick={onUndo}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-foreground/60 transition-colors hover:bg-foreground/5 disabled:opacity-40"
        >
          <Undo2 size={17} />
        </button>
        <button
          type="button"
          title="Redo"
          aria-label="Redo"
          disabled={disabled}
          onClick={onRedo}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-foreground/60 transition-colors hover:bg-foreground/5 disabled:opacity-40"
        >
          <Redo2 size={17} />
        </button>
      </div>
    </div>
  );
}
