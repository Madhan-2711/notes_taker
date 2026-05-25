"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, Eye, EyeOff } from "lucide-react";

interface KeySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetPassword: (password: string) => Promise<void>;
}

export function KeySetupModal({ isOpen, onClose, onSetPassword }: KeySetupModalProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      await onSetPassword(password);
      setPassword("");
      setConfirm("");
      onClose();
    } catch {
      setError("Failed to set vault password. Please try again.");
    } finally {
      setSaving(false);
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
          onClick={onClose}
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Shield size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Set Up Vault Password</h2>
                  <p className="text-xs text-foreground/45">Sync your keys across devices</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground p-1">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-foreground/60 leading-relaxed bg-indigo-50 border border-indigo-100 p-3 rounded-xl">
              Your encryption keys are stored locally. Set a vault password to backup your keys securely
              and access encrypted notes from other devices.
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
                  placeholder="At least 8 characters..."
                  className="w-full bg-transparent border-b border-border/50 pb-3 pr-10 focus:outline-none focus:border-primary transition-colors font-medium"
                  minLength={8}
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

            {/* Confirm Password */}
            <div>
              <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-2 block">
                Confirm Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password..."
                className="w-full bg-transparent border-b border-border/50 pb-3 focus:outline-none focus:border-primary transition-colors font-medium"
              />
            </div>

            {/* Error */}
            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border/30">
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-medium text-foreground/50 hover:text-foreground transition-colors"
              >
                Skip for now
              </button>
              <button
                type="submit"
                disabled={!password || !confirm || saving}
                className="bg-primary text-primary-foreground neubrutal px-6 py-2 rounded-[var(--radius-xl)] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
              >
                {saving ? "Setting up..." : "Set Password"}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
