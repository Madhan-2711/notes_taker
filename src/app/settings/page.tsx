"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { AtSign, CloudUpload, Download, HardDrive, KeyRound, LogOut, ShieldAlert, Trash2 } from "lucide-react";
import { AutoEmptyTrashControl } from "../../components/AutoEmptyTrashControl";
import { useAuth } from "../../hooks/useAuth";
import { useUserKeys } from "../../hooks/useUserKeys";
import { useMyUsername } from "../../hooks/useMyUsername";
import { useVaultStatus } from "../../hooks/useVaultStatus";
import { useInstallPrompt } from "../../components/AppInstall";
import { UsernameForm } from "../../components/UsernameForm";
import { KeyBackupRestore } from "../../components/KeyBackupRestore";
import { OfflineStorageControl } from "../../components/OfflineStorageControl";
import { PageHeader } from "../../components/PageHeader";
import { PageLoading, SignInRequired } from "../../components/PageState";

function Section({ id, icon, title, description, children }: { id: string; icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="panel p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700" aria-hidden="true">{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 id={id} className="text-base font-bold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 max-w-prose text-sm text-slate-600">{description}</p>}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const { user, loading, signOut } = useAuth();
  const { privateKey, needsVaultSetup, openVaultSetup } = useUserKeys();
  const vault = useVaultStatus();
  const username = useMyUsername(user?.uid);
  const { canInstall, install } = useInstallPrompt();
  const [editingUsername, setEditingUsername] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  if (loading) return <PageLoading cards={3} label="Loading settings" />;
  if (!user) return <SignInRequired>Sign in to change your settings.</SignInRequired>;

  const VaultIcon = vault.icon;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader title="Settings" subtitle="Your account, encryption keys and this device." />

      <div className="space-y-4">
        <Section id="settings-account" icon={<AtSign size={18} />} title="Account" description="Your profile, and the username friends use to find you.">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-50 text-lg font-bold text-indigo-800">
              {user.photoURL
                ? <Image src={user.photoURL} alt="" width={48} height={48} className="h-full w-full object-cover" />
                : (user.displayName || user.email || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              {user.displayName && <p className="truncate font-semibold text-slate-900">{user.displayName}</p>}
              {user.email && <p className="truncate text-sm text-slate-600">{user.email}</p>}
            </div>
          </div>
          <div className="mt-5 border-t border-slate-200 pt-4">
            {username === undefined ? (
              <div className="h-11 w-48 animate-pulse rounded-xl bg-slate-100" aria-label="Loading username" />
            ) : username && !editingUsername ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-700">Username <span className="ml-1 text-base font-bold text-slate-900">@{username}</span></p>
                <button type="button" onClick={() => setEditingUsername(true)} className="btn-secondary">Change</button>
              </div>
            ) : (
              <>
                {username === null && <p className="mb-3 text-sm text-slate-700">Pick a username so friends can find you without your email.</p>}
                <UsernameForm userId={user.uid} initial={username ?? ""} onSaved={() => setEditingUsername(false)} />
                {editingUsername && <button type="button" onClick={() => setEditingUsername(false)} className="btn-quiet mt-2">Cancel</button>}
              </>
            )}
          </div>
        </Section>

        <Section id="settings-vault" icon={<KeyRound size={18} />} title="Vault and encryption keys" description="Your vault protects private and shared notes. Back up your keys to open them on other devices.">
          <div className={`flex items-start gap-3 rounded-xl border p-4 ${vault.tone}`}>
            <VaultIcon size={20} className={`mt-0.5 shrink-0 ${vault.kind === "checking" ? "animate-spin" : ""}`} aria-hidden="true" />
            <div>
              <p className="font-bold">{vault.title}</p>
              <p className="mt-0.5 text-sm">{vault.description}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {needsVaultSetup && (
              <button type="button" onClick={openVaultSetup} className="btn-primary">
                <ShieldAlert size={16} aria-hidden="true" /> Set recovery password
              </button>
            )}
            <button type="button" onClick={() => setShowKeys(true)} className={needsVaultSetup ? "btn-secondary" : "btn-primary"}>
              <CloudUpload size={16} aria-hidden="true" /> Back up or restore keys
            </button>
          </div>
        </Section>

        <Section id="settings-trash" icon={<Trash2 size={18} />} title="Trash">
          <AutoEmptyTrashControl />
        </Section>

        <Section id="settings-offline" icon={<HardDrive size={18} />} title="Offline storage">
          <OfflineStorageControl />
        </Section>

        <Section id="settings-install" icon={<Download size={18} />} title="Install app" description="Open Notes Taker from your home screen or dock, and get reminders while it runs.">
          {canInstall ? (
            <button type="button" onClick={() => void install()} className="btn-secondary">
              <Download size={16} aria-hidden="true" /> Install Notes Taker
            </button>
          ) : (
            <p className="text-sm text-slate-600">Already installed, or this browser doesn&apos;t offer installation. In Safari, use Share, then Add to Home Screen.</p>
          )}
        </Section>

        <div className="flex justify-end pt-2">
          <button type="button" onClick={() => void signOut()} className="btn-danger">
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      </div>

      <KeyBackupRestore
        isOpen={showKeys}
        onClose={() => setShowKeys(false)}
        privateKey={privateKey}
        userId={user.uid}
        onRestoreSuccess={() => {}}
      />
    </div>
  );
}
