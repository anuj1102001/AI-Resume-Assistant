"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type Health } from "@/lib/api";
import { Logo } from "./logo";

const NAV = [
  { href: "/", label: "Dashboard", match: (p: string) => p === "/" || p.startsWith("/resume") || p.startsWith("/match") || (p.startsWith("/jobs/") && p !== "/jobs/new") },
  { href: "/jobs/new", label: "Add a job", match: (p: string) => p === "/jobs/new" },
  { href: "/case-study", label: "How it works", match: (p: string) => p.startsWith("/case-study") },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [health, setHealth] = useState<Health | null | "waking" | "down">(null);

  useEffect(() => {
    // The free host sleeps when idle; the first request can take up to a minute while it starts.
    let cancelled = false;
    const started = Date.now();
    const slow = setTimeout(() => !cancelled && setHealth((h) => h ?? "waking"), 3000);
    const check = () =>
      api.health().then(
        (h) => !cancelled && setHealth(h),
        () => {
          if (cancelled) return;
          if (Date.now() - started < 90_000) {
            setHealth("waking");
            setTimeout(check, 5000);
          } else setHealth("down");
        },
      );
    check();
    return () => {
      cancelled = true;
      clearTimeout(slow);
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* A floating bar rather than a full-width strip: the header is 68px tall in total (see Split). */}
      <header className="sticky top-0 z-30 px-2 pt-3 sm:px-3">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 rounded-full border border-line bg-surface/85 pl-2.5 pr-2 shadow-card backdrop-blur-md sm:gap-6 sm:pl-4 sm:pr-3">
          <Link href="/" aria-label="Shortlist home" className="rounded-full">
            <Logo />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-0.5 rounded-full bg-sunk/70 p-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={n.match(path) ? "page" : undefined}
                className={clsx(
                  "whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13px] transition-colors sm:px-3.5 sm:text-sm",
                  n.match(path) ? "bg-ink font-medium text-paper" : "text-ink-2 hover:text-ink",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <AiStatus health={health} />
          </div>
        </div>
      </header>
      {health === "waking" && (
        <div role="status" className="mx-3 mt-2 rounded-2xl border border-line bg-sunk px-4 py-2 text-center text-sm text-ink-2">
          Waking the Shortlist server. The free demo host sleeps when nobody is using it, so the first visit takes up to a minute.
        </div>
      )}
      {health === "down" && (
        <div role="status" className="mx-3 mt-2 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-2 text-center text-sm text-warn">
          The Shortlist server isn&apos;t responding. Please try again in a few minutes.
        </div>
      )}
      {health && health !== "down" && health !== "waking" && health.model === "offline-demo" && (
        <div role="status" className="mx-3 mt-2 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-2 text-center text-sm text-warn">
          Offline demo mode: results below come from simple word-matching rules, not AI. Connect a Gemini key for real matching and rewrites.
        </div>
      )}
      {health && health !== "down" && health !== "waking" && !health.ai_configured && (
        <div role="status" className="mx-3 mt-2 rounded-2xl border border-line bg-sunk px-4 py-2 text-center text-sm text-ink-2">
          AI is switched off on this server, so AI matching, rewrites and answers are unavailable. Uploading, resume checks and keyword matching still work.
        </div>
      )}
      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}

function AiStatus({ health }: { health: Health | null | "waking" | "down" }) {
  if (!health || health === "waking" || health === "down") return null;
  return (
    <span className="hidden items-center gap-2 font-mono text-2xs text-ink-3 sm:inline-flex" title={`Answers by ${health.model ?? "—"}; search by ${health.embedding_model}`}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", health.ai_configured ? "bg-ok" : "bg-ink-3")} />
      {health.ai_configured ? health.model : "AI off"}
    </span>
  );
}
