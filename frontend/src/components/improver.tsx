"use client";

import clsx from "clsx";
import { Check, Loader2, Pencil, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { api, describeError, type Bullet, type Rewrite, type VariantChecks } from "@/lib/api";
import { ErrorBox } from "./ui";

/** Warnings shown next to any rewrite (suggested or typed): what it adds that the original didn't say. */
export function GuardrailNotes({ checks }: { checks: VariantChecks }) {
  const notes: string[] = [];
  if (checks.new_numbers.length)
    notes.push(`Adds ${checks.new_numbers.join(", ")}, a number your original doesn't state. Keep it only if it's true and you can explain it in an interview.`);
  if (checks.new_skills.length) notes.push(`Mentions ${checks.new_skills.join(", ")}, which isn't anywhere on your resume. Remove it unless you really used it.`);
  if (checks.placeholders.length) notes.push(`Fill in ${checks.placeholders.join(", ")} with a real figure, or delete it.`);
  if (checks.words > 30) notes.push(`${checks.words} words; aim for under 30.`);
  if (!notes.length) return null;
  return (
    <ul className="mt-1.5 space-y-1">
      {notes.map((n) => (
        <li key={n} className="flex items-start gap-1.5 text-xs text-warn">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> {n}
        </li>
      ))}
    </ul>
  );
}

/**
 * Improve one bullet: three suggested rewrites (optionally tailored to a job), each checked for invented numbers and
 * skills; the user picks, edits and saves. Nothing changes on the resume until they save.
 */
export function BulletImprover({
  resumeId,
  bullet,
  jobId,
  saved,
  onSaved,
}: {
  resumeId: string;
  bullet: Bullet;
  jobId: string | null;
  saved?: string | null;
  onSaved: (revised: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Rewrite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [draftChecks, setDraftChecks] = useState<VariantChecks | null>(null);
  const [saving, setSaving] = useState(false);

  async function load(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      setData((await api.rewrite(resumeId, bullet.id, jobId, refresh)).result);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  }

  async function save(text: string) {
    setSaving(true);
    try {
      const r = await api.saveTailored(resumeId, bullet.id, jobId, text);
      setDraftChecks(r.checks);
      onSaved(r.revised);
      setDraft(null);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="flex items-start gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {saved ? (
            <>
              <p className="reading text-[14.5px]">{saved}</p>
              <p className="mt-0.5 text-xs text-ink-3 line-through decoration-ink-3/50">{bullet.text}</p>
            </>
          ) : (
            <p className="reading text-[14.5px]">{bullet.text}</p>
          )}
          {saved && draftChecks && <GuardrailNotes checks={draftChecks} />}
        </div>
        <button
          onClick={() => {
            setOpen((o) => !o);
            if (!data && !loading) load();
          }}
          className="btn-secondary h-8 shrink-0 px-2.5 text-xs"
          aria-expanded={open}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> {saved ? "Revise" : "Improve"}
        </button>
      </div>
      {open && (
        <div className="space-y-2 border-t border-line bg-paper/60 px-3 py-3">
          {error && <ErrorBox message={error} onRetry={() => load()} />}
          {loading && (
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Drafting three versions…
            </p>
          )}
          {data &&
            !loading &&
            data.variants.map((v, i) => (
              <div key={i} className="rounded-md border border-line bg-surface px-3 py-2">
                <p className="reading text-[14.5px]">{v.text}</p>
                <p className="mt-0.5 text-xs text-ink-3">{v.rationale}</p>
                <GuardrailNotes checks={v.checks} />
                <div className="mt-2 flex gap-2">
                  <button onClick={() => save(v.text)} disabled={saving} className="btn-primary h-7 px-2.5 text-xs">
                    <Check className="h-3.5 w-3.5" aria-hidden /> Use this
                  </button>
                  <button onClick={() => setDraft(v.text)} className="btn-ghost h-7 px-2 text-xs">
                    <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit first
                  </button>
                </div>
              </div>
            ))}
          {data && data.questions.length > 0 && (
            <div className="rounded-md bg-accent-soft px-3 py-2 text-xs text-accent">
              <p className="font-medium">To make it stronger, can you answer:</p>
              <ul className="mt-1 list-disc pl-4">
                {data.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {draft !== null && (
            <div>
              <label className="sr-only" htmlFor={`draft-${bullet.id}`}>
                Edit the bullet
              </label>
              <textarea id={`draft-${bullet.id}`} className="input h-auto py-2" rows={3} value={draft} maxLength={600} onChange={(e) => setDraft(e.target.value)} />
              <div className="mt-2 flex gap-2">
                <button onClick={() => save(draft)} disabled={saving || !draft.trim()} className="btn-primary h-8 text-xs">
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />} Save
                </button>
                <button onClick={() => setDraft(null)} className="btn-ghost h-8 text-xs">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {data && !loading && (
            <button onClick={() => load(true)} className={clsx("text-xs text-ink-3 hover:text-ink")}>
              Suggest different versions
            </button>
          )}
        </div>
      )}
    </div>
  );
}
