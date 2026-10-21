"use client";

import clsx from "clsx";
import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Logo } from "./logo";

const NAV = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#methodology", label: "Methodology" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // The API sleeps on the free host; a visit to the site starts waking it so the app is ready sooner.
    api.health().catch(() => {});
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={clsx("sticky top-0 z-40 border-b transition-colors", scrolled || open ? "border-line bg-paper/90 backdrop-blur-md" : "border-transparent bg-paper")}>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-4 sm:px-6">
        <Link href="/" aria-label="Shortlist home" className="rounded-lg">
          <Logo />
        </Link>
        <nav aria-label="Site" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-sunk hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Link href="/app" className="btn-ghost">
            Open the app
          </Link>
          <Link href="/app#upload" className="btn-primary">
            Analyze my resume <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <button className="btn-ghost ml-auto h-10 w-10 p-0 md:hidden" aria-expanded={open} aria-controls="site-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav id="site-menu" aria-label="Site" className="border-t border-line px-4 pb-4 pt-2 md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-[15px] hover:bg-sunk">
              {n.label}
            </Link>
          ))}
          <div className="mt-3 grid gap-2">
            <Link href="/app#upload" className="btn-primary">
              Analyze my resume
            </Link>
            <Link href="/app" className="btn-secondary">
              Open the app
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1.6fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-2">An AI resume assistant that shows its evidence. A portfolio project, built in public.</p>
        </div>
        <FooterCol
          title="Product"
          links={[
            ["Analyze a resume", "/app#upload"],
            ["Match a job", "/jobs/new"],
            ["How it works", "/#how-it-works"],
            ["Methodology", "/#methodology"],
          ]}
        />
        <FooterCol
          title="Project"
          links={[
            ["Case study", "/case-study"],
            ["Source code", "https://github.com/anuj1102001/AI-Resume-Assistant"],
            ["Evaluation results", "https://github.com/anuj1102001/AI-Resume-Assistant/tree/main/backend/evals/results"],
          ]}
        />
        <div id="privacy" className="scroll-mt-24">
          <h2 className="text-sm font-semibold">Privacy</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            No account: your files live in a private workspace tied to this browser, and you can delete them at any time. AI features send passages of your resume
            to Google&apos;s Gemini API, whose free tier may use submitted content to improve Google&apos;s services, so don&apos;t upload anything you wouldn&apos;t
            share. The demo server&apos;s storage resets when it restarts.
          </p>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-[1200px] px-4 py-5 text-xs text-ink-3 sm:px-6">Built by Anuj M · Sample resumes and job ads on this site are fictional.</p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            {href.startsWith("http") ? (
              <a href={href} className="text-sm text-ink-2 hover:text-ink" target="_blank" rel="noreferrer">
                {label}
              </a>
            ) : (
              <Link href={href} className="text-sm text-ink-2 hover:text-ink">
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
