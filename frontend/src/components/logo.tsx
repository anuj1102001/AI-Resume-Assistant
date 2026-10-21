/** The Shortlist mark: a resume card, a tick, and one highlighted line of evidence. */
export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3.5" y="2.5" width="17" height="19" rx="2.5" className="fill-surface stroke-ink" strokeWidth="1.5" />
      <path d="M7 8.2l1.6 1.6L11.6 6.8" className="stroke-accent" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13" y="7.2" width="4.5" height="2.4" rx="0.8" className="fill-mark" />
      <path d="M7 13.5h10.5M7 16.8h7" className="stroke-ink-3" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="hidden font-serif text-[19px] font-semibold tracking-tight sm:inline">Shortlist</span>
    </span>
  );
}
