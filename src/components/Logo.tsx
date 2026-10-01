import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Notes Taker home"
      className={`group flex items-center gap-3 rounded-xl transition-opacity hover:opacity-80 ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        className="h-9 w-9 text-primary-strong"
        aria-hidden="true"
      >
        <path
          d="M50 10 L85 85 L65 85 L50 45 L35 85 L15 85 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M50 10 L50 90"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="50" cy="90" r="4" fill="currentColor" />
      </svg>
      <span className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
        Notes Taker
      </span>
    </Link>
  );
}
