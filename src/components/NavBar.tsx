"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { BookOpen, FolderOpen, Home, LogIn, LogOut, Plus, Search, Settings, Users, type LucideIcon } from "lucide-react";
import { openCommandPalette } from "./CommandPalette";
import { useAuth } from "../hooks/useAuth";
import { useInbox } from "../contexts/InboxContext";
import { auth, googleProvider, hasValidConfig } from "../lib/firebaseConfig";
import { Logo } from "./Logo";
import { Menu } from "./ui/Menu";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/notes", label: "Notes", icon: BookOpen },
  { href: "/groups", label: "Groups", icon: FolderOpen },
  { href: "/friends", label: "Friends", icon: Users },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // Shared notes are opened from the notes list, so keep "Notes" lit while editing one.
  if (href === "/notes" && pathname.startsWith("/collab/")) return true;
  return pathname === href || pathname.startsWith(href + "/");
}

function Badge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold leading-none text-white ${className}`}>
      {count > 9 ? "9+" : count}
    </span>
  );
}

function AccountMenu() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  const name = user.displayName || user.email || "Your account";
  const initial = name.charAt(0).toUpperCase();

  return (
    <Menu
      label="Account menu"
      triggerClassName="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-slate-900 bg-indigo-50 text-sm font-bold text-indigo-800 transition-transform hover:-translate-y-0.5"
      trigger={user.photoURL
        ? <Image src={user.photoURL} alt="" width={44} height={44} className="h-full w-full object-cover" />
        : <span aria-hidden="true">{initial}</span>}
      header={<>
        {user.displayName && <p className="truncate text-sm font-bold text-slate-900">{user.displayName}</p>}
        {user.email && <p className="truncate text-xs text-slate-600">{user.email}</p>}
      </>}
      items={[
        { label: "Settings", icon: Settings, href: "/settings" },
        { label: "Sign out", icon: LogOut, onSelect: () => void signOut(), separated: true },
      ]}
    />
  );
}

function SignInButton() {
  const handleSignIn = async () => {
    if (!hasValidConfig) {
      console.warn("Firebase is not configured. Please add your credentials to .env.local");
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Sign in failed", error);
    }
  };
  return (
    <button type="button" onClick={() => void handleSignIn()} className="btn-primary">
      <LogIn size={16} aria-hidden="true" /> Sign in
    </button>
  );
}

/** Sticky top bar: logo, main navigation and account on desktop; logo and account on phones. */
export function AppHeader() {
  const { user, loading } = useAuth();
  const [modKey, setModKey] = useState("Ctrl");
  // Platform is only known in the browser; render "Ctrl" first to match the server HTML.
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) {
      const timer = window.setTimeout(() => setModKey("⌘"), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);
  const { invites, friendRequests } = useInbox();
  const pathname = usePathname();
  const pending = invites.length + friendRequests.length;

  return (
    <header className="sticky top-0 z-[var(--z-header)] border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Logo />
        {user && (
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${
                    active ? "bg-indigo-50 text-indigo-800" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                  {href === "/friends" && <Badge count={pending} />}
                  {href === "/friends" && pending > 0 && <span className="sr-only">({pending} waiting)</span>}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3">
          {loading ? (
            <div className="h-11 w-11 animate-pulse rounded-full bg-slate-200" aria-hidden="true" />
          ) : user ? (
            <>
              <button type="button" onClick={openCommandPalette} aria-keyshortcuts="Control+K Meta+K" className="hidden h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white pl-3 pr-2 text-sm text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 lg:flex">
                <Search size={16} aria-hidden="true" /> Search
                <kbd className="ml-4 rounded-md border border-slate-300 px-1.5 text-xs font-semibold text-slate-600" aria-hidden="true">{modKey} K</kbd>
              </button>
              <button type="button" onClick={openCommandPalette} aria-label="Search" className="icon-btn hidden md:inline-flex lg:hidden">
                <Search size={18} aria-hidden="true" />
              </button>
              <Link href="/write" aria-keyshortcuts="N" className="btn-primary hidden md:inline-flex">
                <Plus size={16} aria-hidden="true" /> New note
              </Link>
              <AccountMenu />
            </>
          ) : pathname === "/access" ? null : (
            <SignInButton />
          )}
        </div>
      </div>
    </header>
  );
}

/** Fixed bottom navigation for phones, with "New note" in the thumb-friendly centre. */
export function MobileTabBar() {
  const { user, loading } = useAuth();
  const { invites, friendRequests } = useInbox();
  const pathname = usePathname();
  if (loading || !user) return null;
  const pending = invites.length + friendRequests.length;
  const [home, notes, groups, friends] = NAV_LINKS;

  const tab = ({ href, label, icon: Icon }: NavLink) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold ${
          active ? "text-indigo-800" : "text-slate-600"
        }`}
      >
        <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-indigo-100" : ""}`}>
          <Icon size={19} aria-hidden="true" />
        </span>
        {label}
        {href === "/friends" && <Badge count={pending} className="absolute right-[calc(50%-1.4rem)] top-1" />}
        {href === "/friends" && pending > 0 && <span className="sr-only">({pending} waiting)</span>}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-[var(--z-tabbar)] border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-center gap-1 px-2 py-1">
        {tab(home)}
        {tab(notes)}
        <Link
          href="/write"
          aria-label="New note"
          aria-current={pathname === "/write" ? "page" : undefined}
          className="mx-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-900 bg-primary-strong text-white shadow-[3px_3px_0_0_#0f172a] active:translate-y-px"
        >
          <Plus size={22} aria-hidden="true" />
        </Link>
        {tab(groups)}
        {tab(friends)}
      </div>
    </nav>
  );
}
