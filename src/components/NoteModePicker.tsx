"use client";

import { motion } from "framer-motion";
import { Lock, Unlock, Users } from "lucide-react";
import { type NoteMode } from "../lib/validations";

interface NoteModePickerProps {
  value: NoteMode;
  onChange: (mode: NoteMode) => void;
}

const MODES = [
  {
    value: "normal" as const,
    icon: Unlock,
    label: "Normal Note",
    description: "Fast, searchable, no encryption",
    color: "#64748b",
    bgClass: "hover:bg-slate-50",
  },
  {
    value: "secure" as const,
    icon: Lock,
    label: "Secure Note",
    description: "End-to-end encrypted, only you can read",
    color: "#6366f1",
    bgClass: "hover:bg-indigo-50",
  },
  {
    value: "collab" as const,
    icon: Users,
    label: "Collaborative",
    description: "Encrypted & shared with friends in real-time",
    color: "#10b981",
    bgClass: "hover:bg-emerald-50",
  },
] as const;

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 22 } },
};

export function NoteModePicker({ value, onChange }: NoteModePickerProps) {
  return (
    <div>
      <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-3 block">
        Note Type
      </label>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        {MODES.map((mode) => {
          const isSelected = value === mode.value;
          const Icon = mode.icon;

          return (
            <motion.button
              key={mode.value}
              type="button"
              variants={cardVariants}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange(mode.value)}
              className={`relative flex flex-col items-center gap-2.5 p-5 rounded-2xl border-2 text-center transition-all duration-200 cursor-pointer ${
                isSelected
                  ? "border-current shadow-sm"
                  : "border-border/50 bg-transparent " + mode.bgClass
              }`}
              style={isSelected ? { color: mode.color, borderColor: mode.color, backgroundColor: mode.color + "08" } : {}}
            >
              {/* Selection indicator */}
              {isSelected && (
                <motion.div
                  layoutId="mode-indicator"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ backgroundColor: mode.color }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  ✓
                </motion.div>
              )}

              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: isSelected ? mode.color + "15" : "var(--border)",
                  color: isSelected ? mode.color : "var(--foreground)",
                }}
              >
                <Icon size={20} />
              </div>

              <div>
                <p
                  className="text-sm font-bold"
                  style={{ color: isSelected ? mode.color : "inherit" }}
                >
                  {mode.label}
                </p>
                <p className="text-xs text-foreground/45 mt-0.5 leading-relaxed">
                  {mode.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
