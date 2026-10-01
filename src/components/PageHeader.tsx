import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: ReactNode;
  /** Short line under the title, such as a count. */
  subtitle?: ReactNode;
  /** Only for real parent pages (group → Groups); top-level pages rely on the main navigation. */
  back?: { href: string; label: string };
  actions?: ReactNode;
}

/** Shared page title row: one line on desktop, title above actions on phones. */
export function PageHeader({ title, subtitle, back, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="-ml-2 mb-1 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900">
            <ArrowLeft size={16} aria-hidden="true" /> {back.label}
          </Link>
        )}
        <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
