"use client";

import clsx from "clsx";
import { ArrowUpRight, Bookmark, BookOpen, Briefcase, FileText, Home, LayoutGrid, Menu, MessagesSquare, Plus, Settings, Target, Upload, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type Health } from "@/lib/api";
import { Logo } from "./logo";

type Item = { href: string; label: string; icon: typeof Home; match: (p: string) => boolean };

const WORKSPACE: Item[] = [
  { href: "/app", label: "Overview", icon: LayoutGrid, match: (p) => p === "/app" },
  { href: "/app/resumes", label: "My resumes", icon: FileText, match: (p) => p.startsWith("/app/resumes") || p.startsWith("/resume/") },
  { href: "/app/matches", label: "Job matches", icon: Target, match: (p) => p.startsWith("/app/matches") || p.startsWith("/match/") || (p.startsWith("/jobs/") && p !== "/jobs/new") },
  { href: "/jobs/new", label: "Add a job", icon: Briefcase, match: (p) => p === "/jobs/new" },
  { href: "/app/assistant", label: "AI assistant", icon: MessagesSquare, match: (p) => p.startsWith("/app/assistant") },
  { href: "/app/saved", label: "Saved", icon: Bookmark, match: (p) => p.startsWith("/app/saved") },
  { href: "/app/settings", label: "Settings", icon: Settings, match: (p) => p.startsWith("/app/settings") },
];

const ABOUT: Item[] = [
  { href: "/case-study", label: "Case study", icon: BookOpen, match: () => false },
  { href: "/", label: "Back to the site", icon: Home, match: () => false },
];

/** Topbar is 56px tall; full-height workspaces (see Split) size themselves against it. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [health, setHealth] = useState<Health | null | "waking" | "down">(null);
  const [menu, setMenu] = useState(false);

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

  useEffect(() => setMenu(false), [path]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block">
        <Sidebar path={path} />
      </aside>

      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-ink/30 animate-[fade_.2s_ease-out]" aria-label="Close menu" onClick={() => setMenu(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] border-r border-line bg-surface shadow-lift animate-[slide-in_.22s_cubic-bezier(.2,.8,.2,1)]">
            <Sidebar path={path} onClose={() => setMenu(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-paper/90 px-3 backdrop-blur-md sm:px-5">
          <button className="btn-ghost h-9 w-9 p-0 lg:hidden" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/app" className="rounded-lg lg:hidden" aria-label="Shortlist overview">
            <Logo />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <AiStatus health={health} />
            <Link href="/jobs/new" className="btn-secondary hidden h-9 sm:inline-flex">
              <Plus className="h-4 w-4" aria-hidden /> Add a job
            </Link>
            <Link href="/app#upload" className="btn-primary h-9">
              <Upload className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Upload resume</span>
              <span className="sm:hidden">Upload</span>
            </Link>
          </div>
        </header>
        {health === "waking" && <Notice tone="neutral">Waking the Shortlist server. The free demo host sleeps when nobody is using it, so the first visit takes up to a minute.</Notice>}
        {health === "down" && <Notice tone="warn">The Shortlist server isn&apos;t responding. Please try again in a few minutes.</Notice>}
        {health && health !== "down" && health !== "waking" && health.model === "offline-demo" && (
          <Notice tone="warn">Offline demo mode: results come from simple word-matching rules, not AI. Connect a Gemini key for real matching and rewrites.</Notice>
        )}
        {health && health !== "down" && health !== "waking" && !health.ai_configured && (
          <Notice tone="neutral">AI is switched off on this server, so AI matching, rewrites and answers are unavailable. Uploading, resume checks and keyword matching still work.</Notice>
        )}
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({ path, onClose }: { path: string; onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col px-3 py-4">
      <div className="flex items-center justify-between px-2">
        <Link href="/app" aria-label="Shortlist overview" className="rounded-lg">
          <Logo />
        </Link>
        {onClose && (
          <button className="btn-ghost h-9 w-9 p-0" aria-label="Close menu" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav aria-label="Workspace" className="mt-6">
        <p className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3">Workspace</p>
        <NavList items={WORKSPACE} path={path} />
      </nav>
      <nav aria-label="About" className="mt-6">
        <p className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3">About</p>
        <NavList items={ABOUT} path={path} />
      </nav>
      <div className="mt-auto rounded-tile border border-line bg-paper p-3">
        <p className="text-xs font-medium">Private workspace</p>
        <p className="mt-1 text-2xs leading-relaxed text-ink-3">
          No account needed. Your files are tied to this browser; delete them from My resumes at any time.{" "}
          <Link href="/#privacy" className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-ink">
            Privacy <ArrowUpRight className="h-3 w-3" aria-hidden />
          </Link>
        </p>
      </div>
    </div>
  );
}

function NavList({ items, path }: { items: Item[]; path: string }) {
  return (
    <ul className="space-y-0.5">
      {items.map(({ href, label, icon: Icon, match }) => {
        const active = match(path);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-sunk hover:text-ink",
              )}
            >
              {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-accent" />}
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Notice({ tone, children }: { tone: "neutral" | "warn"; children: React.ReactNode }) {
  return (
    <div role="status" className={clsx("border-b px-4 py-2 text-center text-sm", tone === "warn" ? "border-warn/30 bg-warn-soft text-warn" : "border-line bg-sunk text-ink-2")}>
      {children}
    </div>
  );
}

function AiStatus({ health }: { health: Health | null | "waking" | "down" }) {
  if (!health || health === "waking" || health === "down") return null;
  return (
    <span className="mr-1 hidden items-center gap-2 font-mono text-2xs text-ink-3 md:inline-flex" title={`Answers by ${health.model ?? "—"}; search by ${health.embedding_model}`}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", health.ai_configured ? "bg-ok" : "bg-ink-3")} />
      {health.ai_configured ? health.model : "AI off"}
    </span>
  );
}
