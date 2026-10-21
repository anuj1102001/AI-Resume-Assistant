"use client";

import clsx from "clsx";
import { ArrowUp, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, describeError, type Analysis, type Answer } from "@/lib/api";
import { ClaimView, GroundingNote } from "./claim";
import { ErrorBox, MetaLine } from "./ui";

type Turn = { question: string; result?: Analysis<Answer>; error?: string };

const STARTERS = ["What are my strongest achievements?", "Which tools have I used in production?", "How many years of experience do I have, and where?"];

export function AskPanel({ resumeId }: { resumeId: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.questions(resumeId).then((past) => setTurns(past.map((a) => ({ question: (a.input as { question: string }).question, result: a }))), () => {});
  }, [resumeId]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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
        ["Assistant", t.result!.result.answer.map((c) => c.text).join(" ") || "(not on the resume)"],
      ]);
    setTurns((t) => [...t, { question }]);
    try {
      const result = await api.ask(resumeId, question, history);
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, result } : x)));
    } catch (e) {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: describeError(e) } : x)));
    } finally {
      setBusy(false);
    }
  }

  const last = turns.at(-1)?.result?.result;
  const suggestions = last?.follow_ups?.length ? last.follow_ups : turns.length ? [] : STARTERS;

  return (
    <div className="flex min-h-full flex-col">
      {turns.length === 0 && (
        <div className="mb-5">
          <p className="font-display text-lg">Ask about your resume.</p>
          <p className="mt-1 text-sm text-ink-2">Useful for interview prep: answers come only from what your resume says, with the lines they rely on.</p>
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
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading your resume…
                </p>
              ) : (
                <div>
                  {t.result.result.status !== "answered" && (
                    <p className={clsx("mb-3 rounded-lg px-3 py-2 text-sm", t.result.result.status === "not_found" ? "bg-sunk text-ink-2" : "bg-warn-soft text-warn")}>
                      {t.result.result.status === "not_found" ? "Your resume doesn't say." : "Your resume only partly answers this."}
                    </p>
                  )}
                  <div className="space-y-3">
                    {t.result.result.answer.map((c, j) => (
                      <ClaimView key={j} claim={c} />
                    ))}
                  </div>
                  {t.result.result.answer.length > 0 && (
                    <div className="mt-3">
                      <GroundingNote g={t.result.result.grounding} />
                    </div>
                  )}
                  <MetaLine meta={t.result.meta} />
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div ref={end} />
      <div className="sticky bottom-0 -mx-5 mt-6 border-t border-line bg-paper/95 px-5 pb-1 pt-3 backdrop-blur">
        {suggestions.length > 0 && !busy && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-full border border-line bg-surface px-2.5 py-1 text-left text-xs text-ink-2 hover:border-ink-3 hover:text-ink">
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
            placeholder="Ask about your experience…"
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
