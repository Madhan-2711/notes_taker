"use client";

/**
 * KeyBackupRestore — Firebase-based key backup and restore.
 *
 * Instead of downloading/uploading files, encryption keys are stored
 * in Firestore (encrypted with a user-chosen passcode) and can be
 * restored on any device by entering the same passcode.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  wrapPrivateKey,
  unwrapPrivateKey,
  storePrivateKey,
  exportPublicKey,
} from "../lib/services/crypto/keys";
import {
  updateWrappedPrivateKey,
  getWrappedPrivateKey,
  updatePublicKey,
} from "../lib/services/social/usersService";
import { X, Shield, Eye, EyeOff, CloudUpload, CloudDownload, Check, AlertCircle } from "lucide-react";

interface KeyBackupRestoreProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  privateKey: CryptoKey | null;
  onRestoreSuccess: () => void;
}

export function KeyBackupRestore({
  isOpen,
  onClose,
  userId,
  privateKey,
  onRestoreSuccess,
}: KeyBackupRestoreProps) {
  const [mode, setMode] = useState<"menu" | "backup" | "restore">("menu");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetState = () => {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setError(null);
    setSuccess(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    setMode("menu");
    onClose();
  };

  /** Backup: encrypt private key and store in Firestore */
  const handleBackup = async () => {
    if (!privateKey || !password) return;
    if (password.length < 6) {
      setError("Passcode must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passcodes don't match.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Wrap private key with passcode
      const wrapped = await wrapPrivateKey(privateKey, password);
      await updateWrappedPrivateKey(userId, wrapped);

      // Also ensure the correct public key is in Firestore
      const privJwk = await crypto.subtle.exportKey("jwk", privateKey);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { d, p, q, dp, dq, qi, ...publicFields } = privJwk;
      const publicJwk = { ...publicFields, key_ops: ["wrapKey"] };
      await updatePublicKey(userId, JSON.stringify(publicJwk));

      setSuccess("Keys backed up to cloud! You can restore them on any device with your passcode.");
    } catch (err) {
      console.error("Backup failed:", err);
      setError("Failed to backup keys. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /** Restore: fetch wrapped key from Firestore and decrypt with passcode */
  const handleRestore = async () => {
    if (!password) return;

    setLoading(true);
    setError(null);

    try {
      const wrapped = await getWrappedPrivateKey(userId);
      if (!wrapped) {
        setError("No backup found in the cloud. Backup your keys from the device that created them first.");
        setLoading(false);
        return;
      }

      // Unwrap the private key
      const restoredKey = await unwrapPrivateKey(wrapped, password);

      // Store in IndexedDB
      await storePrivateKey(userId, restoredKey);

      // Update public key in Firestore from the restored private key
      const privJwk = await crypto.subtle.exportKey("jwk", restoredKey);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { d, p, q, dp, dq, qi, ...publicFields } = privJwk;
      const publicJwk = { ...publicFields, key_ops: ["wrapKey"] };
      await updatePublicKey(userId, JSON.stringify(publicJwk));

      setSuccess("Keys restored successfully! Reloading...");
      setTimeout(() => {
        onRestoreSuccess();
        handleClose();
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("Restore failed:", err);
      setError("Wrong passcode or corrupted backup. Please try again.");
    } finally {
      setLoading(false);
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
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white neubrutal rounded-[var(--radius-xl)] p-6 sm:p-8 w-full max-w-md flex flex-col gap-5 shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">
                {mode === "menu" && "Key Backup & Restore"}
                {mode === "backup" && "Backup to Cloud"}
                {mode === "restore" && "Restore from Cloud"}
              </h2>
              <button onClick={handleClose} className="text-foreground/40 hover:text-foreground p-1">
                <X size={20} />
              </button>
            </div>

            {/* Success message */}
            {success && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
                <Check size={16} />
                {success}
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            {/* ── Menu Mode ── */}
            {mode === "menu" && !success && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-foreground/50">
                  Securely backup your encryption keys to the cloud. Restore on any device with your passcode.
                </p>

                <button
                  onClick={() => { resetState(); setMode("backup"); }}
                  disabled={!privateKey}
                  className="flex items-center gap-3 p-4 rounded-xl border-2 border-border/50 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <CloudUpload size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Backup Keys</p>
                    <p className="text-xs text-foreground/40">Encrypt and save to cloud with a passcode</p>
                  </div>
                </button>

                <button
                  onClick={() => { resetState(); setMode("restore"); }}
                  className="flex items-center gap-3 p-4 rounded-xl border-2 border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <CloudDownload size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Restore Keys</p>
                    <p className="text-xs text-foreground/40">Download from cloud using your passcode</p>
                  </div>
                </button>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                  ⚠️ <strong>Important:</strong> First backup from the device that <em>created</em> your encrypted notes, then restore on other devices.
                </div>
              </div>
            )}

            {/* ── Backup Mode ── */}
            {mode === "backup" && !success && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <Shield size={18} className="text-emerald-600" />
                  </div>
                  <p className="text-sm text-foreground/50">
                    Choose a passcode to encrypt your keys. You&apos;ll need this to restore on other devices.
                  </p>
                </div>

                {/* Passcode */}
                <div>
                  <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-2 block">
                    Passcode
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters..."
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

                {/* Confirm */}
                <div>
                  <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-2 block">
                    Confirm Passcode
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter passcode..."
                    className="w-full bg-transparent border-b border-border/50 pb-3 focus:outline-none focus:border-primary transition-colors font-medium"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setMode("menu")}
                    className="flex-1 px-4 py-2.5 rounded-[var(--radius-xl)] border-2 border-border/50 text-sm font-bold text-foreground/60 hover:bg-border/20 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleBackup}
                    disabled={!password || !confirmPassword || loading}
                    className="flex-1 bg-emerald-500 text-white neubrutal px-4 py-2.5 rounded-[var(--radius-xl)] font-bold text-sm disabled:opacity-40 hover:bg-emerald-600 transition-colors"
                  >
                    {loading ? "Backing up..." : "Backup to Cloud"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Restore Mode ── */}
            {mode === "restore" && !success && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <CloudDownload size={18} className="text-primary" />
                  </div>
                  <p className="text-sm text-foreground/50">
                    Enter the passcode you used when backing up your keys.
                  </p>
                </div>

                {/* Passcode */}
                <div>
                  <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-2 block">
                    Passcode
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your backup passcode..."
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

                <div className="flex gap-3">
                  <button
                    onClick={() => setMode("menu")}
                    className="flex-1 px-4 py-2.5 rounded-[var(--radius-xl)] border-2 border-border/50 text-sm font-bold text-foreground/60 hover:bg-border/20 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleRestore}
                    disabled={!password || loading}
                    className="flex-1 bg-primary text-white neubrutal px-4 py-2.5 rounded-[var(--radius-xl)] font-bold text-sm disabled:opacity-40 hover:bg-primary/90 transition-colors"
                  >
                    {loading ? "Restoring..." : "Restore from Cloud"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
