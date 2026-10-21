"use client";

import { Check, Download, Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { ClaimView, CitationChip, GroundingNote, Quote } from "@/components/claim";
import { DocProvider } from "@/components/doc-context";
import { CoverageRing, ErrorBox, KindTag, Meter, StatusPill, Working } from "@/components/ui";
import type { Citation } from "@/lib/api";

const TOKENS: [string, string][] = [
  ["paper", "Page background"],
  ["surface", "Cards, panels"],
  ["sunk", "Wells, tracks"],
  ["line", "Borders"],
  ["ink", "Primary text"],
  ["ink-2", "Secondary text"],
  ["ink-3", "Tertiary text"],
  ["accent", "Actions, focus"],
  ["accent-soft", "Selected, info"],
  ["mark", "Evidence highlight"],
  ["mark-strong", "Evidence rule"],
  ["ok", "Met, verified"],
  ["ok-soft", "Met background"],
  ["warn", "Partly, approximate"],
  ["warn-soft", "Partly background"],
  ["bad", "Errors, unverified"],
  ["bad-soft", "Error background"],
];

const cite = (status: Citation["status"], section = "Experience", page = 1): Citation => ({ quote: "Cut checkout API p95 latency from 620 ms to 380 ms", status, source: "resume", source_id: "demo", section, page });

/** The design system, rendered with the product's own components so it can't drift from the app. */
export default function DesignSystem() {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      setValues(Object.fromEntries(TOKENS.map(([t]) => [t, cs.getPropertyValue(`--${t}`).trim()])));
    };
    read();
    // Re-read when the system theme changes or the app's own theme class (Settings) does.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      mq.removeEventListener("change", read);
      obs.disconnect();
    };
  }, []);

  return (
    <DocProvider docs={[]}>
      <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-10 sm:px-6">
        <p className="eyebrow">Design system</p>
        <h1 className="mt-2 font-display text-[40px] font-bold leading-tight tracking-[-0.035em] sm:text-[48px]">Shortlist design system</h1>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ink-2">
          Everything on this page is the live component from the app, styled by the same tokens, so the documentation can&apos;t drift from the product. Switch your
          system to dark mode, or change it in the app&apos;s Settings, and every value below updates.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["Evidence first", "Every AI claim carries its source. Lime is reserved for evidence, so it always means “this came from your document”."],
            ["Honest states", "No fake progress, no made-up scores. Loading, partial and not-found are designed states, not afterthoughts."],
            ["Calm, then decisive", "A cool neutral canvas and quiet type, with one cobalt accent for the action that matters."],
          ].map(([t, d]) => (
            <li key={t} className="rounded-card border border-line bg-surface p-4">
              <p className="text-sm font-semibold">{t}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">{d}</p>
            </li>
          ))}
        </ul>

        <Section title="Colour" note="CSS variables as RGB triples, so Tailwind can apply opacity (bg-accent/20). Dark mode redefines the same names.">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {TOKENS.map(([t, use]) => (
              <li key={t} className="overflow-hidden rounded-tile border border-line bg-surface">
                <div className="h-14 border-b border-line" style={{ background: `rgb(var(--${t}))` }} />
                <div className="p-2.5">
                  <p className="font-mono text-xs text-ink">--{t}</p>
                  <p className="text-2xs text-ink-3">{use}</p>
                  <p className="mt-0.5 font-mono text-2xs text-ink-3">{values[t] ? `rgb(${values[t].replace(/ /g, ", ")})` : "…"}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Typography" note="Bricolage Grotesque for headings, Geist for the interface and body, Geist Mono for data and labels.">
          <div className="space-y-4 rounded-card border border-line bg-surface p-6">
            <p className="font-display text-[48px] font-bold leading-none tracking-[-0.035em]">Display 48 / bold</p>
            <p className="font-display text-[34px] font-bold tracking-[-0.03em]">Page title 34 / bold</p>
            <p className="font-display text-[22px] font-bold tracking-[-0.02em]">Panel title 22 / bold</p>
            <p className="text-[15px] font-semibold">Item title 15 / semibold</p>
            <p className="reading max-w-2xl">Body 15 / 1.6. Used for AI output and resume text, where people read carefully and compare against the source.</p>
            <p className="text-sm text-ink-2">Secondary 14 for explanations.</p>
            <p className="eyebrow">Eyebrow 11 / semibold / tracked</p>
            <p className="font-mono text-xs text-ink-3">Mono 12 · gemini-3.5-flash-lite · 1,082 tokens · 1.1 s</p>
          </div>
        </Section>

        <Section title="Shape and depth" note="Radii: 6 (chips inside controls), 10 (tiles, buttons), 14 (cards). Shadows are soft and used sparingly.">
          <div className="flex flex-wrap gap-4">
            {[
              ["rounded-md", "6 · control"],
              ["rounded-tile", "10 · tile"],
              ["rounded-card", "14 · card"],
              ["rounded-full", "pill · chip"],
            ].map(([r, l]) => (
              <div key={r} className={`grid h-24 w-32 place-items-center border border-line bg-surface text-xs text-ink-2 shadow-card ${r}`}>{l}</div>
            ))}
            <div className="grid h-24 w-32 place-items-center rounded-card bg-surface text-xs text-ink-2 shadow-lift">shadow-lift</div>
          </div>
        </Section>

        <Section title="Buttons" note="One primary action per view. Focus shows a 2px cobalt ring; pressed buttons scale to 98%.">
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-6">
            <button className="btn-primary">Primary</button>
            <button className="btn-secondary">Secondary</button>
            <button className="btn-ghost">Ghost</button>
            <button className="btn-primary" disabled>
              Disabled
            </button>
            <button className="btn-primary" aria-busy="true">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving
            </button>
            <button className="btn-secondary">
              <Download className="h-4 w-4" aria-hidden /> With icon
            </button>
            <button className="btn-ghost h-9 w-9 p-0" aria-label="Icon button">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </Section>

        <Section title="Inputs" note="44px tall, 10px radius; focus adds a cobalt border and a soft ring. Labels always exist, visibly or for screen readers.">
          <div className="grid gap-4 rounded-card border border-line bg-surface p-6 sm:grid-cols-3">
            <label className="text-xs font-medium text-ink-2">
              Text field
              <input className="input mt-1" placeholder="Placeholder" />
            </label>
            <label className="text-xs font-medium text-ink-2">
              Select
              <select className="input mt-1">
                <option>Senior Backend Engineer</option>
              </select>
            </label>
            <label className="text-xs font-medium text-ink-2">
              With an error
              <input className="input mt-1 border-bad focus:border-bad focus:ring-bad/15" defaultValue="not-an-email" aria-invalid="true" />
              <span className="mt-1 block font-normal text-bad">Enter an email address.</span>
            </label>
          </div>
        </Section>

        <Section title="Status and labels" note="Status is never colour alone: each pill has a symbol and a word.">
          <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-6">
            <StatusPill status="met" />
            <StatusPill status="partial" />
            <StatusPill status="missing" />
            <KindTag kind="must" />
            <KindTag kind="nice" />
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-medium text-accent">Judgement</span>
            <span className="rounded-full bg-sunk px-2 py-0.5 text-2xs font-medium text-ink-2">General advice</span>
            <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-2xs font-semibold text-warn">2 to fix</span>
            <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-2xs font-semibold text-ok">Reads well</span>
          </div>
        </Section>

        <Section title="Evidence" note="Citation chips show whether a quote was found in the source. Resume quotes open the page with the line highlighted.">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-card border border-line bg-surface p-6">
              <div className="flex flex-wrap gap-2">
                <CitationChip c={cite("verified")} />
                <CitationChip c={cite("approximate", "Summary")} />
                <CitationChip c={cite("unverified", "Skills")} />
                <CitationChip c={{ ...cite("verified"), source: "job", source_id: "job" }} />
              </div>
              <Quote c={cite("verified")} />
              <GroundingNote g={{ claims: 11, verified: 11, grounded_rate: 1 }} />
              <GroundingNote g={{ claims: 11, verified: 10, unverified: 1, grounded_rate: 0.91 }} />
            </div>
            <div className="space-y-4 rounded-card border border-line bg-surface p-6">
              <ClaimView claim={{ text: "Cut checkout latency from 620 ms to 380 ms.", kind: "stated", citations: [cite("verified")], support: "verified" }} />
              <ClaimView claim={{ text: "Operates at a senior level, leading migrations.", kind: "inferred", citations: [cite("verified")], support: "verified" }} />
              <ClaimView claim={{ text: "Mentoring often matters for senior roles.", kind: "inferred", citations: [], support: "unverified" }} />
              <ClaimView claim={{ text: "Led a team of 12 engineers.", kind: "stated", citations: [cite("unverified")], support: "unverified" }} />
            </div>
          </div>
        </Section>

        <Section title="Data" note="The coverage ring's arc is the coverage figure itself, so the ring and the number always agree.">
          <div className="flex flex-wrap items-center gap-8 rounded-card border border-line bg-surface p-6">
            <CoverageRing coverage={0.74} />
            <CoverageRing coverage={0.42} size={88} />
            <CoverageRing coverage={0.9} size={44} />
            <div className="w-56 space-y-2">
              <Meter value={0.62} label="Keyword coverage" />
              <Meter value={0.25} label="Example" />
            </div>
          </div>
        </Section>

        <Section title="States" note="Loading shows what is happening, errors say what to do next, and empty states point to the first action.">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-card border border-line bg-surface p-6">
              <Working text="Reading your resume…" hint="This is an AI step." />
            </div>
            <div className="rounded-card border border-line bg-surface p-6">
              <ErrorBox message="The AI provider is rate-limiting requests. Please try again in a minute." onRetry={() => {}} />
            </div>
            <div className="rounded-card border border-dashed border-line px-6 py-8 text-center">
              <Check className="mx-auto h-6 w-6 text-ink-3" aria-hidden />
              <p className="mt-2 text-sm font-medium">Nothing saved yet</p>
              <p className="mt-1 text-xs text-ink-2">Save a gap or an answer to keep it here.</p>
            </div>
          </div>
        </Section>
      </div>
    </DocProvider>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="mt-14" aria-label={title}>
      <h2 className="font-display text-[26px] font-bold tracking-[-0.025em]">{title}</h2>
      <p className="mb-4 mt-1 max-w-2xl text-sm text-ink-2">{note}</p>
      {children}
    </section>
  );
}
