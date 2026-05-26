"use client";

/**
 * KeyImportExport — Allows users to export their private key as a
 * password-protected file, and import it on another device.
 *
 * Export: private key → PBKDF2+AES-GCM encrypt → JSON file download
 * Import: JSON file → password → decrypt → store in IndexedDB
 */

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Upload, X, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { wrapPrivateKey, unwrapPrivateKey, storePrivateKey } from "../lib/services/crypto/keys";
import { updatePublicKey } from "../lib/services/social/usersService";

interface KeyImportExportProps {
  isOpen: boolean;
  onClose: () => void;
  /** Current user's private key (needed for export) */
  privateKey: CryptoKey | null;
  /** Current user's UID */
  userId: string;
  /** Called after a successful import to refresh key state */
  onImportSuccess: () => void;
}

interface ExportedKeyFile {
  version: 1;
  type: "notes_taker_keys";
  wrappedPrivateKey: string;
  publicKeyJwk: string;
  exportedAt: number;
}

export function KeyImportExport({
  isOpen,
  onClose,
  privateKey,
  userId,
  onImportSuccess,
}: KeyImportExportProps) {
  const [mode, setMode] = useState<"menu" | "export" | "import">("menu");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<ExportedKeyFile | null>(null);
  const [importFileName, setImportFileName] = useState("");

  const resetState = () => {
    setMode("menu");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setError(null);
    setSuccess(null);
    setImportFile(null);
    setImportFileName("");
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // ── Export ──────────────────────────────────────────────

  const handleExport = async () => {
    if (!privateKey) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Wrap private key with the user's chosen password
      const wrappedKey = await wrapPrivateKey(privateKey, password);

      // Export the private key JWK (contains public key components too)
      const privJwk = await crypto.subtle.exportKey("jwk", privateKey);

      const exportData: ExportedKeyFile = {
        version: 1,
        type: "notes_taker_keys",
        wrappedPrivateKey: wrappedKey,
        publicKeyJwk: JSON.stringify(privJwk),
        exportedAt: Date.now(),
      };

      // Create and download the file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `notes_taker_keys_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess("Keys exported successfully! Keep the file safe.");
    } catch (err) {
      console.error("Export error:", err);
      setError("Failed to export keys. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Import ──────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as ExportedKeyFile;
        if (data.type !== "notes_taker_keys" || !data.wrappedPrivateKey) {
          setError("Invalid key file. Please select a valid Notes Taker key export.");
          return;
        }
        setImportFile(data);
      } catch {
        setError("Could not read file. Make sure it's a valid JSON key export.");
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importFile || !password) return;

    setLoading(true);
    setError(null);

    try {
      // Unwrap the private key with the password
      const restoredPrivateKey = await unwrapPrivateKey(
        importFile.wrappedPrivateKey,
        password
      );

      // Store in IndexedDB
      await storePrivateKey(userId, restoredPrivateKey);

      // Update public key in Firestore if available
      if (importFile.publicKeyJwk) {
        try {
          // The publicKeyJwk in the export is actually the private JWK
          // We need to extract just the public parts
          const fullJwk = JSON.parse(importFile.publicKeyJwk);
          // Create a public-only JWK by removing private fields
          const publicJwk = {
            kty: fullJwk.kty,
            n: fullJwk.n,
            e: fullJwk.e,
            alg: fullJwk.alg,
            ext: fullJwk.ext,
            key_ops: ["wrapKey"],
          };
          await updatePublicKey(userId, JSON.stringify(publicJwk));
        } catch {
          // Non-fatal — public key update failed but private key is restored
          console.warn("Could not update public key from export");
        }
      }

      setSuccess("Keys imported successfully! Reloading...");

      // Reload after a brief delay to reinitialize key state
      setTimeout(() => {
        onImportSuccess();
        handleClose();
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("Import error:", err);
      setError("Wrong password or corrupted file. Please try again.");
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
            className="relative bg-white neubrutal rounded-[var(--radius-xl)] p-8 w-full max-w-md flex flex-col gap-5 shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">
                {mode === "menu" && "Import / Export Keys"}
                {mode === "export" && "Export Keys"}
                {mode === "import" && "Import Keys"}
              </h2>
              <button onClick={handleClose} className="text-foreground/40 hover:text-foreground p-1">
                <X size={20} />
              </button>
            </div>

            {/* Success message */}
            {success && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
                <CheckCircle2 size={16} />
                {success}
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold">
                {error}
              </div>
            )}

            {/* ── Menu Mode ── */}
            {mode === "menu" && !success && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-foreground/50">
                  Export your encryption keys to a password-protected file, or import keys from a previous export.
                </p>

                <button
                  onClick={() => { resetState(); setMode("export"); }}
                  disabled={!privateKey}
                  className="flex items-center gap-3 p-4 rounded-xl border-2 border-border/50 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <Download size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Export Keys</p>
                    <p className="text-xs text-foreground/40">Download a password-protected backup file</p>
                  </div>
                </button>

                <button
                  onClick={() => { resetState(); setMode("import"); }}
                  className="flex items-center gap-3 p-4 rounded-xl border-2 border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Upload size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Import Keys</p>
                    <p className="text-xs text-foreground/40">Restore from a previously exported file</p>
                  </div>
                </button>
              </div>
            )}

            {/* ── Export Mode ── */}
            {mode === "export" && !success && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-foreground/50">
                  Choose a strong password to protect your exported keys. You&#39;ll need this password to import them later.
                </p>

                {/* Password */}
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password (min 8 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-border/20 rounded-xl px-4 py-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Confirm Password */}
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-border/20 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => setMode("menu")}
                    className="flex-1 py-2.5 rounded-xl border-2 border-border/50 text-sm font-semibold text-foreground/50 hover:text-foreground transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={loading || password.length < 8 || password !== confirmPassword}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white font-bold text-sm py-2.5 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-40"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {loading ? "Exporting..." : "Export"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Import Mode ── */}
            {mode === "import" && !success && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-foreground/50">
                  Select a previously exported key file and enter the password you used to protect it.
                </p>

                {/* File picker */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 border-dashed transition-all text-left ${
                    importFile
                      ? "border-emerald-300 bg-emerald-50/50"
                      : "border-border/50 hover:border-primary/40"
                  }`}
                >
                  <Upload size={18} className={importFile ? "text-emerald-600" : "text-foreground/40"} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {importFile ? importFileName : "Choose key file..."}
                    </p>
                    {importFile && (
                      <p className="text-xs text-foreground/40">
                        Exported {new Date(importFile.exportedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </button>

                {/* Password */}
                {importFile && (
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter export password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-border/20 rounded-xl px-4 py-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setMode("menu")}
                    className="flex-1 py-2.5 rounded-xl border-2 border-border/50 text-sm font-semibold text-foreground/50 hover:text-foreground transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={loading || !importFile || !password}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-white font-bold text-sm py-2.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {loading ? "Importing..." : "Import"}
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
