"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff } from "lucide-react";

interface VaultUnlockModalProps {
  isOpen: boolean;
  onUnlock: (password: string) => Promise<void>;
  error?: string | null;
}

export function VaultUnlockModal({ isOpen, onUnlock, error: externalError }: VaultUnlockModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError || externalError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLocalError(null);
    setUnlocking(true);

    try {
      await onUnlock(password);
      setPassword("");
    } catch {
      setLocalError("Wrong password. Please try again.");
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <motion.form
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="relative bg-white neubrutal rounded-[var(--radius-xl)] p-8 w-full max-w-md flex flex-col gap-5 shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Lock size={20} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">Unlock Your Vault</h2>
                <p className="text-xs text-foreground/45">Enter your vault password to access encrypted notes</p>
              </div>
            </div>

            <p className="text-sm text-foreground/60 leading-relaxed bg-amber-50 border border-amber-100 p-3 rounded-xl">
              Your encryption keys were backed up to the cloud. Enter your vault password to restore
              them on this device.
            </p>

            {/* Password */}
            <div>
              <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-2 block">
                Vault Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your vault password..."
                  className="w-full bg-transparent border-b border-border/50 pb-3 pr-10 focus:outline-none focus:border-primary transition-colors font-medium"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 p-1 text-foreground/40 hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {displayError && (
              <p className="text-sm text-red-500 font-medium">{displayError}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!password || unlocking}
              className="bg-primary text-primary-foreground neubrutal px-6 py-2.5 rounded-[var(--radius-xl)] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors w-full"
            >
              {unlocking ? "Unlocking..." : "Unlock"}
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
