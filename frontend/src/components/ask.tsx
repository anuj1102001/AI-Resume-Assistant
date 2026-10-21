"use client";

import clsx from "clsx";
import { ArrowUp, ChevronDown, Loader2, SearchX } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, describeError, type Analysis, type Answer } from "@/lib/api";
import { ClaimView, GroundingNote } from "./claim";
import { SaveButton } from "./save-button";
import { ErrorBox, MetaLine } from "./ui";

type Turn = { question: string; result?: Analysis<Answer>; error?: string };

const STARTERS = ["Which of my projects best shows my strongest skill?", "Which tools have I used in production?", "How many years of experience do I have, and where?"];
const JOB_STARTERS = [
  "Which job requirements are not clearly supported by my resume?",
  "What experience should I highlight for this role?",
  "Which of my projects best demonstrates the skills this role wants?",
];

/**
 * Grounded Q&A over a resume, and optionally a job ad. Answers cite the lines they rely on; "Sources searched" lists
 * every passage the model was given; when nothing relevant is found it says so instead of guessing.
 */
export function AskPanel({ resumeId, jobId = null, jobTitle }: { resumeId: string; jobId?: string | null; jobTitle?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTurns([]);
    api.questions(resumeId, jobId).then((past) => setTurns(past.map((a) => ({ question: (a.input as { question: string }).question, result: a }))), () => {});
  }, [resumeId, jobId]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns.length, busy]);

  async function ask(question: string) {
    question = question.trim();
    if (question.length < 2 || busy) return;
    setQ("");
    setBusy(true);
    const history = turns
      .filter((t) => t.result)
      .slice(-3)
      .flatMap((t): [string, string][] => [
        ["User", t.question],
        ["Assistant", t.result!.result.answer.map((c) => c.text).join(" ") || "(not in the documents)"],
      ]);
    setTurns((t) => [...t, { question }]);
    try {
      const result = await api.ask(resumeId, question, history, jobId);
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, result } : x)));
    } catch (e) {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: describeError(e) } : x)));
    } finally {
      setBusy(false);
    }
  }

  const last = turns.at(-1)?.result?.result;
  const suggestions = last?.follow_ups?.length ? last.follow_ups : turns.length ? [] : jobId ? JOB_STARTERS : STARTERS;
  const docs = jobId ? "your resume or the job ad" : "your resume";

  return (
    <div className="flex min-h-full flex-col">
      {turns.length === 0 && (
        <div className="mb-5">
          <p className="font-display text-lg font-bold tracking-[-0.01em]">{jobId ? `Ask about your resume and ${jobTitle ?? "this job"}.` : "Ask about your resume."}</p>
          <p className="mt-1 text-sm text-ink-2">
            Answers come from {docs}, with the lines they rely on. Comparisons are labelled as judgements, and anything that&apos;s general advice says so.
          </p>
          <p className="mt-2 text-xs text-ink-3">
            Want to reword a bullet?{" "}
            <Link href={`/resume/${resumeId}/edit${jobId ? `?job=${jobId}` : ""}`} className="text-accent underline underline-offset-2">
              Open the editor
            </Link>
            , which keeps your facts and flags anything new.
          </p>
        </div>
      )}
      <ol className="space-y-6" aria-live="polite">
        {turns.map((t, i) => (
          <li key={i} className="animate-rise">
            <p className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2 text-sm text-paper">{t.question}</p>
            <div className="mt-3">
              {t.error ? (
                <ErrorBox message={t.error} />
              ) : !t.result ? (
                <p className="flex items-center gap-2 text-sm text-ink-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Searching {docs}…
                </p>
              ) : (
                <AnswerView turn={t} docs={docs} resumeId={resumeId} jobId={jobId} />
              )}
            </div>
          </li>
        ))}
      </ol>
      <div ref={end} />
      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-line bg-surface/95 px-4 pb-1 pt-3 backdrop-blur">
        {suggestions.length > 0 && !busy && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-full border border-line bg-surface px-2.5 py-1 text-left text-xs text-ink-2 hover:border-accent/50 hover:text-ink">
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
          className="relative"
        >
          <label htmlFor="question" className="sr-only">
            Your question
          </label>
          <textarea
            id="question"
            rows={2}
            value={q}
            maxLength={800}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(q);
              }
            }}
            placeholder={jobId ? "Ask about your fit for this role…" : "Ask about your experience…"}
            className="input h-auto resize-none py-2.5 pr-12"
          />
          <button type="submit" disabled={busy || q.trim().length < 2} className="btn-primary absolute bottom-2 right-2 h-8 w-8 p-0" aria-label="Ask">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}

function AnswerView({ turn, docs, resumeId, jobId }: { turn: Turn; docs: string; resumeId: string; jobId: string | null }) {
  const r = turn.result!.result;
  return (
    <div>
      {r.status === "not_found" ? (
        <div className="flex items-start gap-2 rounded-tile border border-line bg-sunk px-3 py-2.5 text-sm text-ink-2">
          <SearchX className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          <span>
            Not enough evidence to answer. Nothing in {docs} covers this, so Shortlist won&apos;t guess. Try asking about something your resume describes.
          </span>
        </div>
      ) : (
        r.status === "partial" && <p className="mb-3 rounded-tile bg-warn-soft px-3 py-2 text-sm text-warn">Only partly answered: {docs} covers some of this, not all of it.</p>
      )}
      <div className="space-y-3">
        {r.answer.map((c, j) => (
          <ClaimView key={j} claim={c} subject={docs} />
        ))}
      </div>
      {r.answer.length > 0 && (
        <div className="mt-3">
          <GroundingNote g={r.grounding} subject={docs} />
        </div>
      )}
      {r.retrieval.length > 0 && (
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-ink-3 hover:text-ink [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden /> Sources searched ({r.retrieval.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-ink-2">
            {r.retrieval.map((s) => (
              <li key={s.label} className="flex gap-2">
                <span className={clsx("w-7 shrink-0 font-mono", s.label.startsWith("J") ? "text-accent" : "text-ink-3")}>{s.label}</span>
                <span>
                  {s.section || "Resume"}
                  {s.page ? ` · p. ${s.page}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-2xs text-ink-3">These are all the passages the model was given. P = your resume, J = the job ad.</p>
        </details>
      )}
      <div className="mt-2 flex items-center justify-between">
        <MetaLine meta={turn.result!.meta} />
      </div>
      {r.answer.length > 0 && (
        <SaveButton
          className="-ml-1.5 mt-1"
          label="Save answer"
          item={{
            kind: "answer",
            text: r.answer.map((c) => c.text).join(" "),
            detail: { question: turn.question },
            resume_id: resumeId,
            job_id: jobId,
            href: jobId ? `/app/assistant?resume=${resumeId}&job=${jobId}` : `/resume/${resumeId}`,
          }}
        />
      )}
    </div>
  );
}
