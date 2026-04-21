export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        className="w-10 h-10 text-primary drop-shadow-[0_2px_4px_rgba(99,102,241,0.4)]"
      >
        <path
          d="M50 10 L85 85 L65 85 L50 45 L35 85 L15 85 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-[pulse_4s_cubic-bezier(0.4,0,0.6,1)_infinite]"
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
      <span className="font-sans font-bold text-xl tracking-tight text-foreground">
        Notes Taker
      </span>
    </div>
  );
}
