/** The Shortlist mark: a violet tile with a tick and one lime line of evidence. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <rect width="28" height="28" rx="8" className="fill-accent" />
      <path d="M7.5 11.5l2.6 2.6 5-5.2" className="stroke-accent-ink" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="7.5" y="17.5" width="13" height="3.2" rx="1.6" className="fill-mark" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="hidden font-display text-[20px] font-bold tracking-[-0.02em] sm:inline">Shortlist</span>
    </span>
  );
}
