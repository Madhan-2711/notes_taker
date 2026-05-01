"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import { PenLine, BookOpen, FolderOpen } from "lucide-react";

const NAV_LINKS = [
  { href: "/write", label: "Write", icon: PenLine },
  { href: "/notes", label: "My Notes", icon: BookOpen },
  { href: "/groups", label: "Groups", icon: FolderOpen },
];

export function NavBar() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading || !user) return null;

  return (
    <nav className="border-b border-border/50 bg-white/60 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-1 h-11">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/50 hover:text-foreground hover:bg-border/40"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
