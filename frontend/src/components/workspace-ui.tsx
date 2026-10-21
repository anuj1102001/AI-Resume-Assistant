"use client";

import clsx from "clsx";
import { AlertTriangle, ArrowRight, Briefcase, Check, FileText, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import type { JobInfo, MatchSummary, ResumeInfo } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { UploadState } from "@/lib/workspace";
import { CoverageRing } from "./ui";

export function BusyOverlay({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-paper/70 backdrop-blur-sm" aria-live="polite" aria-busy="true">
      <p className="flex items-center gap-2 rounded-tile border border-line bg-surface px-4 py-2.5 text-sm shadow-lift">
        <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden /> {text}
      </p>
    </div>
  );
}

/** Upload progress: real bytes sent, then the server reading the file. No step is shown as done before it is. */
export function UploadProgress({ state }: { state: UploadState | null }) {
  if (!state) return null;
  const pct = Math.round(state.sent * 100);
  const steps = [
    { label: state.stage === "uploading" ? `Uploading · ${pct}%` : "Uploaded", status: state.stage === "uploading" ? "active" : "done" },
    { label: "Reading it: text, sections, roles, dates and readability checks", status: state.stage === "reading" ? "active" : "todo" },
    { label: "You check what was found", status: "todo" },
  ] as const;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-paper/75 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Uploading your resume">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-lift animate-rise">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-accent" aria-hidden /> <span className="truncate">{state.name}</span>
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Upload progress">
          <div className={clsx("h-full rounded-full bg-accent transition-[width] duration-300", state.stage === "reading" && "animate-pulse")} style={{ width: `${pct}%` }} />
        </div>
        <ol className="mt-5 space-y-3" aria-live="polite">
          {steps.map((s) => (
            <li key={s.label} className="flex items-start gap-3 text-sm">
              <span
                className={clsx(
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                  s.status === "done" ? "border-ok bg-ok text-surface" : s.status === "active" ? "border-accent text-accent" : "border-line text-ink-3",
                )}
              >
                {s.status === "done" ? <Check className="h-3 w-3" strokeWidth={3} /> : s.status === "active" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              </span>
              <span className={s.status === "todo" ? "text-ink-3" : "text-ink"}>{s.label}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs leading-relaxed text-ink-3">Reading usually takes a few seconds. On the free demo server, the first upload after a quiet spell can take longer.</p>
      </div>
    </div>
  );
}

export function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-6 flex items-start gap-2 rounded-tile bg-bad-soft px-3 py-2.5 text-sm text-bad">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {message}
    </p>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.03em] sm:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={clsx("card p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function ResumeRow({ r, onDelete }: { r: ResumeInfo; onDelete?: () => void }) {
  const toFix = r.check_counts.fail + r.check_counts.warn;
  return (
    <li className="group flex items-center rounded-tile transition-colors hover:bg-sunk/70">
      <Link href={`/resume/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <FileText className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{r.label}</span>
          <span className="block truncate text-xs text-ink-3">
            {r.experience_years ? `~${r.experience_years} years · ` : ""}
            {r.page_count} page{r.page_count === 1 ? "" : "s"} · added {timeAgo(r.created_at)}
          </span>
        </span>
        <span className={clsx("shrink-0 rounded-full px-2.5 py-0.5 text-2xs font-semibold", toFix ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok")}>
          {toFix ? `${toFix} to fix` : "Reads well"}
        </span>
      </Link>
      {onDelete && (
        <button onClick={onDelete} className="btn-ghost mr-1 h-8 w-8 p-0 opacity-70 group-hover:opacity-100" aria-label={`Delete ${r.label}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

export function JobRow({ j, onDelete }: { j: JobInfo; onDelete?: () => void }) {
  return (
    <li className="group flex items-center rounded-tile transition-colors hover:bg-sunk/70">
      <Link href={`/jobs/${j.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sunk text-ink-2">
          <Briefcase className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{j.title}</span>
          <span className="block truncate text-xs text-ink-3">
            {j.company ? `${j.company} · ` : ""}added {timeAgo(j.created_at)}
          </span>
        </span>
      </Link>
      {onDelete && (
        <button onClick={onDelete} className="btn-ghost mr-1 h-8 w-8 p-0 opacity-70 group-hover:opacity-100" aria-label={`Delete ${j.title}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

export function MatchRow({ m, resumeName, jobName }: { m: MatchSummary; resumeName: string; jobName: string }) {
  const pct = Math.round((m.score.coverage ?? 0) * 100);
  return (
    <li>
      <Link href={`/match/${m.resume_id}/${m.job_id}`} className="group flex items-center gap-3 rounded-tile px-2 py-2.5 transition-colors hover:bg-sunk/70">
        <CoverageRing coverage={m.score.coverage ?? 0} size={44} label={`${pct}% requirement coverage`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{jobName}</span>
          <span className="block truncate text-xs text-ink-3">
            {resumeName} · {m.score.must_met}/{m.score.must_total} required shown · {timeAgo(m.created_at)}
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
      </Link>
    </li>
  );
}
