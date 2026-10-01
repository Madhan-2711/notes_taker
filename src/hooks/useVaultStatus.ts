"use client";

import { LoaderCircle, LockKeyhole, ShieldAlert, ShieldCheck, type LucideIcon } from "lucide-react";
import { useUserKeys } from "./useUserKeys";

export interface VaultStatus {
  /** "ok" needs no attention; anything else deserves a visible prompt. */
  kind: "ok" | "checking" | "locked" | "setup" | "error";
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
}

/** Human-readable state of the encryption vault, shared by Home and Settings. */
export function useVaultStatus(): VaultStatus {
  const { isReady, needsVaultPassword, needsVaultSetup, error } = useUserKeys();

  if (error) {
    return { kind: "error", title: "Vault needs attention", description: error, icon: ShieldAlert, tone: "border-red-200 bg-red-50 text-red-800" };
  }
  if (!isReady) {
    return { kind: "checking", title: "Checking your vault", description: "Confirming encryption is ready on this device.", icon: LoaderCircle, tone: "border-slate-200 bg-slate-50 text-slate-700" };
  }
  if (needsVaultPassword) {
    return { kind: "locked", title: "Vault is locked", description: "Enter your vault password to open private and shared notes.", icon: LockKeyhole, tone: "border-amber-300 bg-amber-50 text-amber-900" };
  }
  if (needsVaultSetup) {
    return { kind: "setup", title: "Finish vault setup", description: "Create a recovery password to protect your encryption key.", icon: ShieldAlert, tone: "border-amber-300 bg-amber-50 text-amber-900" };
  }
  return { kind: "ok", title: "Vault protected", description: "Private and shared notes are ready on this device.", icon: ShieldCheck, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" };
}
