"use client";

import clsx from "clsx";
import { ArrowUpRight, Bookmark, Check, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorLine, PageTitle } from "@/components/workspace-ui";
import { api, describeError, type SavedItem } from "@/lib/api";
import { timeAgo } from "@/lib/format";

const KIND_LABEL: Record<SavedItem["kind"], string> = { suggestion: "Suggestion", gap: "Gap to address", claim: "Insight", answer: "Answer" };

/** Recommendations, gaps and answers the user chose to keep, as a simple to-do list. */
export default function SavedPage() {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.saved().then(setItems, (e) => setError(describeError(e)));
  }, []);

  async function toggle(it: SavedItem) {
    try {
      const updated = await api.setSavedDone(it.id, !it.done);
      setItems((xs) => xs?.map((x) => (x.id === it.id ? updated : x)) ?? null);
    } catch (e) {
      setError(describeError(e));
    }
  }
  async function remove(it: SavedItem) {
    try {
      await api.deleteSaved(it.id);
      setItems((xs) => xs?.filter((x) => x.id !== it.id) ?? null);
    } catch (e) {
      setError(describeError(e));
    }
  }

  const open = items?.filter((i) => !i.done) ?? [];
  const done = items?.filter((i) => i.done) ?? [];

  return (
    <div className="mx-auto max-w-[860px] px-4 pb-24 pt-8 sm:px-8">
      <ErrorLine message={error} />
      <PageTitle title="Saved" subtitle="Recommendations, gaps and answers you kept. Tick them off as you act on them." />
      {items === null && !error ? (
        <div className="mt-6 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-16" />
          ))}
        </div>
      ) : items && items.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-line px-6 py-12 text-center">
          <Bookmark className="mx-auto h-6 w-6 text-ink-3" aria-hidden />
          <p className="mt-3 font-medium">Nothing saved yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">
            Use <span className="font-medium">Save</span> on a gap in a job match, an insight about your resume, or an assistant&apos;s answer to keep it here.
          </p>
          <Link href="/app/matches" className="btn-secondary mt-5">
            Go to your matches
          </Link>
        </div>
      ) : (
        <>
          <List title={`To do · ${open.length}`} items={open} onToggle={toggle} onRemove={remove} />
          {done.length > 0 && <List title={`Done · ${done.length}`} items={done} onToggle={toggle} onRemove={remove} />}
        </>
      )}
    </div>
  );
}

function List({ title, items, onToggle, onRemove }: { title: string; items: SavedItem[]; onToggle: (i: SavedItem) => void; onRemove: (i: SavedItem) => void }) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">All done.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className={clsx("card flex items-start gap-3 p-4", it.done && "opacity-70")}>
              <button
                onClick={() => onToggle(it)}
                className={clsx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors", it.done ? "border-ok bg-ok text-surface" : "border-line hover:border-accent")}
                aria-label={it.done ? "Mark as not done" : "Mark as done"}
                aria-pressed={it.done}
              >
                {it.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3">
                  {KIND_LABEL[it.kind]}
                  {it.detail.context ? ` · ${it.detail.context}` : ""}
                </p>
                {it.detail.question && <p className="mt-1 text-xs text-ink-3">Q: {it.detail.question}</p>}
                <p className={clsx("mt-1 text-[15px] leading-relaxed", it.done && "line-through decoration-ink-3/60")}>{it.text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-3">
                  <span>Saved {timeAgo(it.created_at)}</span>
                  {it.href && (
                    <Link href={it.href} className="inline-flex items-center gap-0.5 text-accent hover:underline">
                      Open where it came from <ArrowUpRight className="h-3 w-3" aria-hidden />
                    </Link>
                  )}
                </div>
              </div>
              <button onClick={() => onRemove(it)} className="btn-ghost h-8 w-8 shrink-0 p-0" aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
