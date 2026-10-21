"use client";

import clsx from "clsx";
import { ChevronDown, CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { Check, CheckStatus } from "@/lib/api";
import { useDoc } from "./doc-context";

const ICON: Record<CheckStatus, { Icon: typeof CircleCheck; cls: string; label: string }> = {
  fail: { Icon: CircleAlert, cls: "text-bad", label: "Problem" },
  warn: { Icon: TriangleAlert, cls: "text-warn", label: "Worth fixing" },
  info: { Icon: Info, cls: "text-accent", label: "Tip" },
  pass: { Icon: CircleCheck, cls: "text-ok", label: "Looks good" },
};

/** The readability report: problems first, tips next, passes folded away. */
export function ChecksReport({ checks, resumeId }: { checks: Check[]; resumeId: string }) {
  const fix = checks.filter((c) => c.status === "fail" || c.status === "warn");
  const tips = checks.filter((c) => c.status === "info");
  const good = checks.filter((c) => c.status === "pass");
  return (
    <div>
      <p className="text-sm text-ink-2">
        These checks read your file the way a tracking system or a hurried recruiter might. They don&apos;t produce a score: no tracking system publishes how it
        ranks, so a number would promise more than anyone can know.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          ["To fix", fix.length, "text-warn"],
          ["Tips", tips.length, "text-accent"],
          ["Looks good", good.length, "text-ok"],
        ].map(([label, n, cls]) => (
          <div key={label as string} className="rounded-tile border border-line bg-surface px-2 py-3 shadow-card">
            <p className={clsx("font-display text-[28px] font-bold leading-none", cls as string)}>{n as number}</p>
            <p className="text-2xs text-ink-3">{label}</p>
          </div>
        ))}
      </div>
      {fix.length > 0 && <Group title="To fix" checks={fix} resumeId={resumeId} open />}
      {tips.length > 0 && <Group title="Worth a look" checks={tips} resumeId={resumeId} open />}
      {good.length > 0 && <Group title="Looks good" checks={good} resumeId={resumeId} />}
    </div>
  );
}

function Group({ title, checks, resumeId, open }: { title: string; checks: Check[]; resumeId: string; open?: boolean }) {
  return (
    <section className="mt-6">
      <h3 className="eyebrow mb-2">{title}</h3>
      <ul className="space-y-2">
        {checks.map((c) => (
          <CheckCard key={c.id} c={c} resumeId={resumeId} open={open} />
        ))}
      </ul>
    </section>
  );
}

function CheckCard({ c, resumeId, open }: { c: Check; resumeId: string; open?: boolean }) {
  const { show } = useDoc();
  const { Icon, cls, label } = ICON[c.status];
  return (
    <li>
      <details className="group rounded-lg border border-line bg-surface" open={open && c.status !== "pass"}>
        <summary className="flex cursor-pointer list-none items-start gap-2.5 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
          <Icon className={clsx("mt-0.5 h-4 w-4 shrink-0", cls)} aria-label={label} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{c.title}</span>
            <span className="block text-xs text-ink-2">{c.found}</span>
          </span>
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-2 border-t border-line px-3 py-3 pl-9 text-sm">
          <p className="text-ink-2">
            <span className="font-medium text-ink">Why it matters: </span>
            {c.why}
          </p>
          {c.fix && (
            <p className="text-ink-2">
              <span className="font-medium text-ink">What to do: </span>
              {c.fix}
            </p>
          )}
          {c.evidence.length > 0 && (
            <ul className="space-y-1.5 pt-1">
              {c.evidence.map((e, i) => (
                <li key={i}>
                  <button
                    onClick={() => e.page && show({ quote: e.text, status: "verified", source: "resume", source_id: resumeId, section: null, page: e.page })}
                    disabled={!e.page}
                    className="w-full rounded-r-lg border-l-[3px] border-mark-strong bg-mark/20 px-2.5 py-1.5 text-left text-[13.5px] text-ink-2 enabled:hover:bg-mark/25"
                    title={e.page ? "Show on the page" : undefined}
                  >
                    “{e.text.length > 220 ? e.text.slice(0, 220) + "…" : e.text}”
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}
