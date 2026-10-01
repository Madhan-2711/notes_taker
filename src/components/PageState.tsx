import type { ReactNode } from "react";
import { LogIn } from "lucide-react";

/** Placeholder blocks shaped like a page header and a grid of cards. */
export function PageLoading({ cards = 6, label = "Loading" }: { cards?: number; label?: string }) {
  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8" aria-busy="true" aria-label={label}>
      <div className="mb-6 h-9 w-48 animate-pulse rounded-xl bg-slate-200" />
      <CardSkeletons count={cards} />
    </div>
  );
}

export function CardSkeletons({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="h-40 animate-pulse rounded-card border border-slate-200 bg-white p-5">
          <div className="h-5 w-16 rounded-full bg-slate-200" />
          <div className="mt-4 h-5 w-3/4 rounded-lg bg-slate-200" />
          <div className="mt-3 h-3 w-full rounded bg-slate-100" />
          <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function SignInRequired({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <LogIn size={24} className="text-slate-500" aria-hidden="true" />
      <p className="text-base text-slate-700">{children}</p>
    </div>
  );
}

/** Empty state with an icon, a short explanation and an optional next step. */
export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border-2 border-dashed border-slate-300 px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700" aria-hidden="true">{icon}</div>
      <p className="text-base font-bold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
