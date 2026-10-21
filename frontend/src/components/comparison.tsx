"use client";

import clsx from "clsx";
import { ChevronDown, Lightbulb } from "lucide-react";
import type { Assessment } from "@/lib/api";
import { CitationChip, Quote } from "./claim";
import { SaveButton } from "./save-button";
import { KindTag, STATUS, StatusPill } from "./ui";

const SUPPORT_TEXT = {
  verified: "found word for word in your resume",
  approximate: "found in your resume with small differences",
  unverified: "could not be found in your resume",
} as const;

/** Where a match lives, so its gaps can be saved with a link back. */
export type MatchCtx = { resumeId: string; jobId: string; jobTitle: string };

/** One requirement as a row: what the job asks (left) against what your resume shows (right). */
export function ComparisonRow({ a, onTailor, ctx }: { a: Assessment; onTailor: () => void; ctx: MatchCtx }) {
  const jobQuote = a.job_citations[0];
  return (
    <li className="overflow-hidden rounded-tile border border-line bg-surface shadow-card">
      <div className="grid md:grid-cols-2">
        <div className="border-b border-line p-4 md:border-b-0 md:border-r">
          <div className="flex items-start justify-between gap-2">
            <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3">The job asks</p>
            <KindTag kind={a.kind} />
          </div>
          <p className="mt-1.5 text-[15px] font-semibold leading-snug">{a.text}</p>
          {jobQuote && (
            <div className="mt-2">
              <CitationChip c={jobQuote} />
            </div>
          )}
        </div>
        <div className={clsx("relative p-4", a.status === "missing" && "bg-sunk/50")}>
          <span aria-hidden className={clsx("absolute inset-y-0 left-0 w-1 md:hidden", STATUS[a.status].bar)} />
          <div className="flex items-start justify-between gap-2">
            <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3">Your resume shows</p>
            <StatusPill status={a.status} />
          </div>
          <p className="mt-1.5 text-sm text-ink-2">{a.explanation}</p>
          {a.evidence.slice(0, 2).map((c, i) => (
            <Quote key={i} c={c} stacked />
          ))}
          {a.status === "missing" && a.evidence.length === 0 && <p className="mt-2 text-xs text-ink-3">No line of your resume was quoted for this.</p>}
        </div>
      </div>
      {a.suggestion && (
        <div className="flex items-start gap-2 border-t border-line bg-accent-soft/60 px-4 py-2.5 text-xs text-accent">
          <Lightbulb className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="flex-1">
            {a.suggestion}{" "}
            <button onClick={onTailor} className="font-medium underline underline-offset-2">
              Tailor a bullet
            </button>
          </span>
          <SaveButton
            className="-my-0.5 shrink-0"
            item={{
              kind: "gap",
              text: a.suggestion,
              detail: { context: `${ctx.jobTitle} · ${a.text}` },
              resume_id: ctx.resumeId,
              job_id: ctx.jobId,
              href: `/match/${ctx.resumeId}/${ctx.jobId}`,
            }}
          />
        </div>
      )}
      <details className="group border-t border-line">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-2 text-xs text-ink-3 hover:text-ink [&::-webkit-details-marker]:hidden">
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden /> How this was found
        </summary>
        <ol className="space-y-1.5 px-4 pb-3 text-xs leading-relaxed text-ink-2">
          <li>
            <strong className="font-medium text-ink">1. From the job ad.</strong> The requirement was extracted by the model with a quote from the ad
            {jobQuote ? `, which was ${SUPPORT_TEXT[jobQuote.status]?.replace("your resume", "the ad") ?? "checked"}` : ""}. It is marked {a.kind === "must" ? "required" : "nice to have"}.
          </li>
          <li>
            <strong className="font-medium text-ink">2. Searched your resume.</strong> The three passages most relevant to this requirement were retrieved, by
            meaning and by keyword.
          </li>
          <li>
            <strong className="font-medium text-ink">3. Judged by the model.</strong> It read those passages and judged the requirement{" "}
            {STATUS[a.status].label.toLowerCase()}
            {a.evidence.length ? ", quoting the lines above" : ", with no supporting line"}.
          </li>
          <li>
            <strong className="font-medium text-ink">4. Checked by code.</strong>{" "}
            {a.downgraded
              ? "The model said this was met, but its quote couldn't be found in your resume, so it counts as partly met."
              : a.evidence.length
                ? `The quoted evidence was ${SUPPORT_TEXT[a.support ?? "verified"]}.`
                : "There was no quote to check."}
          </li>
        </ol>
      </details>
    </li>
  );
}
