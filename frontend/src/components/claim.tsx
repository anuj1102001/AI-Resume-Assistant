"use client";

import clsx from "clsx";
import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import type { Citation, Claim, Grounding, Support } from "@/lib/api";
import { groundingSentence, SUPPORT_HELP, SUPPORT_LABEL } from "@/lib/format";
import { useDoc } from "./doc-context";

const SUPPORT_STYLE: Record<Support, string> = { verified: "text-ok", approximate: "text-warn", unverified: "text-bad" };

export function SupportIcon({ support, className = "h-3.5 w-3.5" }: { support: Support; className?: string }) {
  const Icon = support === "verified" ? CircleCheck : support === "approximate" ? CircleDashed : CircleAlert;
  return <Icon className={clsx(className, SUPPORT_STYLE[support])} aria-label={SUPPORT_LABEL[support]} />;
}

const CHIP = {
  verified: "border-ok/25 bg-ok-soft text-ok hover:border-ok/60",
  approximate: "border-warn/25 bg-warn-soft text-warn hover:border-warn/60",
  unverified: "border-bad/25 bg-bad-soft text-bad hover:border-bad/60",
};

/** A source chip. Resume quotes open the page with the quote highlighted; job-ad quotes show the quote on hover. */
export function CitationChip({ c }: { c: Citation }) {
  const { show } = useDoc();
  const label = c.source === "job" ? "job ad" : [c.section, c.page ? `p. ${c.page}` : null].filter(Boolean).join(" · ") || "resume";
  const title = `“${c.quote}”\n${SUPPORT_HELP[c.status]}`;
  if (c.source === "job") {
    return (
      <span title={title} className={clsx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-2xs", CHIP[c.status])}>
        <SupportIcon support={c.status} className="h-3 w-3" /> {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => show(c)}
      title={title}
      aria-label={`Show in resume: ${label}. ${SUPPORT_LABEL[c.status]}.`}
      className={clsx("inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-2xs transition-colors", CHIP[c.status])}
    >
      <SupportIcon support={c.status} className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

/** A quote from the resume, shown inline with its source chip. */
export function Quote({ c }: { c: Citation }) {
  return (
    <figure className="mt-1.5 flex items-start gap-2">
      <blockquote className="min-w-0 flex-1 rounded-r-lg border-l-[3px] border-mark-strong bg-mark/20 py-1 pl-2.5 pr-2 text-[13.5px] leading-snug text-ink-2">“{c.quote}”</blockquote>
      <CitationChip c={c} />
    </figure>
  );
}

export function ClaimView({ claim, className }: { claim: Claim; className?: string }) {
  const shaky = claim.support === "unverified";
  return (
    <div className={className}>
      <p className={clsx("reading text-[15.5px]", shaky && "text-ink-2")}>
        {claim.kind === "inferred" && (
          <span className="mr-1.5 inline-block -translate-y-px rounded-full bg-accent-soft px-2 py-px align-middle font-sans text-2xs font-medium text-accent" title="Shortlist's judgement, not something your resume states.">
            Judgement
          </span>
        )}
        {claim.text}
      </p>
      {claim.citations.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {claim.citations.map((c, i) => (
            <CitationChip key={i} c={c} />
          ))}
        </div>
      )}
      {shaky && <p className="mt-1 text-xs text-bad">We couldn&apos;t find this in your resume. Check it before relying on it.</p>}
    </div>
  );
}

export function GroundingNote({ g, subject = "your resume" }: { g?: Grounding; subject?: string }) {
  const sentence = groundingSentence(g)?.replace("the document", subject);
  if (!sentence || !g) return null;
  const full = (g.verified ?? 0) + (g.approximate ?? 0) === g.claims;
  return (
    <p className={clsx("flex items-start gap-2 rounded-lg px-3 py-2 text-xs", full ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")} role="note">
      <SupportIcon support={full ? "verified" : "approximate"} className="mt-px h-3.5 w-3.5 shrink-0" />
      {sentence}
    </p>
  );
}
