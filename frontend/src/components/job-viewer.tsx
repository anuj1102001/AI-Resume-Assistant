"use client";

import { useEffect, useRef } from "react";
import { useDoc } from "./doc-context";

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** The job ad as text. Clicking a job-ad citation highlights its quote here and scrolls to it. */
export function JobViewer() {
  const { job, jobFocus } = useDoc();
  const mark = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = mark.current;
    const root = el?.closest("[data-scroll-root]");
    if (el && root) root.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
  }, [jobFocus?.nonce]);

  if (!job) return null;
  const paras = job.text.split(/\n\s*\n/);
  const q = jobFocus ? norm(jobFocus.quote) : "";
  let marked = false;
  return (
    <article className="rounded-card border border-line bg-surface p-6 shadow-page" aria-label={`Job ad: ${job.title}`}>
      <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3">Job ad</p>
      <h2 className="mt-1 font-display text-xl font-bold tracking-[-0.02em]">{job.title}</h2>
      <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-ink-2">
        {paras.map((p, i) => {
          const flat = p.replace(/\s+/g, " ").trim();
          const at = q && !marked ? norm(flat).indexOf(q) : -1;
          if (at < 0)
            return (
              <p key={i} className="whitespace-pre-line">
                {p.trim()}
              </p>
            );
          marked = true;
          return (
            <p key={i}>
              {flat.slice(0, at)}
              <mark ref={mark} key={jobFocus?.nonce} className="rounded-sm bg-mark px-0.5 text-[rgb(17_19_34)] animate-rise">
                {flat.slice(at, at + q.length)}
              </mark>
              {flat.slice(at + q.length)}
            </p>
          );
        })}
      </div>
    </article>
  );
}
