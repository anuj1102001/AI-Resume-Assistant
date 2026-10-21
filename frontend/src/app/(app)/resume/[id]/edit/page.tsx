"use client";

import clsx from "clsx";
import { ArrowLeft, Check, Download, Loader2, Redo2, RotateCcw, Save, Sparkles, Undo2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { GuardrailNotes } from "@/components/improver";
import { ErrorBox } from "@/components/ui";
import { api, describeError, type Bullet, type JobInfo, type ResumeFull, type Rewrite, type VariantChecks } from "@/lib/api";
import { wordDiff } from "@/lib/diff";
import { download } from "@/lib/download";
import { sectionLabel } from "@/lib/format";
import { useHistory } from "@/lib/history";
import { lintDocument, type LintNote } from "@/lib/lint";

type Doc = Record<string, string>; // bullet id -> current text

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-ink-3" aria-label="Loading" />
        </div>
      }
    >
      <Editor />
    </Suspense>
  );
}

/** The resume editor: every bullet, original beside your version, with suggestions, notes, undo/redo and export. */
function Editor() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const jobId = search.get("job");
  const [resume, setResume] = useState<ResumeFull | null>(null);
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [saved, setSaved] = useState<Doc | null>(null); // what the server has
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, VariantChecks>>({});
  const doc = useHistory<Doc>({});

  const original = useMemo(() => Object.fromEntries((resume?.parsed.bullets ?? []).map((b) => [b.id, b.text])), [resume]);

  useEffect(() => {
    api.resume(id).then(setResume, (e) => setError(describeError(e)));
    api.overview().then((o) => setJobs(o.jobs), () => {});
  }, [id]);

  useEffect(() => {
    if (!resume) return;
    setSaved(null);
    api.tailored(resume.id, jobId).then(
      (t) => {
        const d = Object.fromEntries(t.bullets.map((b) => [b.id, b.revised ?? b.original]));
        setSaved(d);
        doc.reset(d);
      },
      (e) => setError(describeError(e)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume, jobId]);

  const changedFromSaved = saved ? Object.keys(doc.value).filter((k) => (doc.value[k] ?? "").trim() !== (saved[k] ?? "").trim()) : [];
  const editedFromOriginal = Object.keys(doc.value).filter((k) => doc.value[k].trim() !== (original[k] ?? "").trim());
  const dirty = changedFromSaved.length > 0;
  const notes = useMemo(() => lintDocument(Object.entries(doc.value).map(([bid, text]) => ({ id: bid, text }))), [doc.value]);

  // Keyboard: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo (outside text fields, so native field undo still works).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = (e.target as HTMLElement)?.closest("textarea, input");
      if (inField || !(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        doc.undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        doc.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setText = useCallback((bid: string, text: string, group: string | null = null) => doc.set({ ...doc.value, [bid]: text }, group), [doc]);

  async function save() {
    if (!resume || !saved) return;
    setSaving(true);
    setError(null);
    try {
      const next = { ...saved };
      const newChecks = { ...checks };
      for (const bid of changedFromSaved) {
        const text = doc.value[bid].trim() || original[bid]; // an emptied bullet goes back to the original
        const r = await api.saveTailored(resume.id, bid, jobId, text);
        next[bid] = r.revised;
        if (r.revised !== original[bid]) newChecks[bid] = r.checks;
        else delete newChecks[bid];
      }
      setSaved(next);
      setChecks(newChecks);
      doc.reset({ ...doc.value, ...next });
      setNotice(`Saved ${changedFromSaved.length} change${changedFromSaved.length === 1 ? "" : "s"}.`);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  if (error && !resume)
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <ErrorBox message={error} />
      </div>
    );
  if (!resume || !saved)
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-ink-3" aria-label="Loading" />
      </div>
    );

  const job = jobs.find((j) => j.id === jobId) ?? null;
  const groups: { title: string; bullets: Bullet[] }[] = [];
  for (const b of resume.parsed.bullets) {
    const e = b.entry !== null ? resume.parsed.entries[b.entry] : null;
    const title = e?.header || sectionLabel(b.section);
    const g = groups.find((x) => x.title === title);
    if (g) g.bullets.push(b);
    else groups.push({ title, bullets: [b] });
  }

  return (
    <div className="pb-24">
      <div className="sticky top-14 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-3 px-4 py-3 sm:px-8">
          <Link href={`/resume/${resume.id}`} className="btn-secondary h-10 w-10 shrink-0 p-0" aria-label="Back to the resume">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Editor</p>
            <h1 className="truncate font-display text-[22px] font-bold leading-tight tracking-[-0.02em]">{resume.label}</h1>
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-2">
            <span className="hidden sm:inline">Tailoring for</span>
            <select
              className="input h-9 w-48 py-0 text-xs"
              value={jobId ?? ""}
              onChange={(e) => {
                if (dirty && !confirm("You have unsaved changes. Switch anyway and lose them?")) return;
                router.replace(`/resume/${resume.id}/edit${e.target.value ? `?job=${e.target.value}` : ""}`);
              }}
              aria-label="Tailor for a job"
            >
              <option value="">No specific job</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <button className="btn-ghost h-9 w-9 p-0" onClick={doc.undo} disabled={!doc.canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
              <Undo2 className="h-4 w-4" />
            </button>
            <button className="btn-ghost h-9 w-9 p-0" onClick={doc.redo} disabled={!doc.canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
              <Redo2 className="h-4 w-4" />
            </button>
          </div>
          <button className="btn-primary h-9" onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            {dirty ? `Save ${changedFromSaved.length}` : "Saved"}
          </button>
          <button
            className="btn-secondary h-9"
            disabled={dirty || exporting}
            title={dirty ? "Save your changes first" : "Download the saved version as a Word file"}
            onClick={async () => {
              setExporting(true);
              try {
                const name = `${resume.label.replace(/[^A-Za-z0-9 _-]/g, "").replace(/ /g, "_") || "resume"}${job ? "_tailored" : ""}.docx`;
                download(await api.exportDocx(resume.id, jobId), name);
              } catch (e) {
                setError(describeError(e));
              } finally {
                setExporting(false);
              }
            }}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />} Word
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[1180px] px-4 pt-6 sm:px-8">
        {error && <ErrorBox message={error} />}
        {notice && !dirty && (
          <p role="status" className="mb-4 flex items-center gap-1.5 text-sm text-ok">
            <Check className="h-4 w-4" aria-hidden /> {notice}
          </p>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="max-w-2xl text-sm leading-relaxed text-ink-2">
            {job ? (
              <>
                Tailoring for <strong className="font-medium text-ink">{job.title}</strong>: suggestions speak to its requirements, and this version is kept
                separately from your general one.
              </>
            ) : (
              "Edit any bullet, or ask for suggestions. Your original stays on the left; nothing is stored until you save."
            )}
          </p>
          <p className="text-xs text-ink-3">
            {editedFromOriginal.length} of {resume.parsed.bullets.length} bullets changed from the original
          </p>
        </div>
        {resume.parsed.bullets.length === 0 && (
          <p className="mt-8 text-sm text-ink-3">
            No bullet points were found. If your experience is there,{" "}
            <Link className="text-accent underline" href={`/resume/${resume.id}/extracted`}>
              check the extraction
            </Link>
            .
          </p>
        )}
        <div className="mt-6 hidden grid-cols-2 gap-4 px-4 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3 lg:grid">
          <span>Original</span>
          <span>Your version</span>
        </div>
        {groups.map((g) => (
          <section key={g.title} className="mt-6" aria-label={g.title}>
            <h2 className="mb-2 text-sm font-semibold">{g.title}</h2>
            <ul className="space-y-3">
              {g.bullets.map((b) => (
                <BulletRow
                  key={b.id}
                  resumeId={resume.id}
                  jobId={jobId}
                  bullet={b}
                  value={doc.value[b.id] ?? b.text}
                  savedValue={saved[b.id] ?? b.text}
                  notes={notes[b.id] ?? []}
                  checks={checks[b.id]}
                  onChange={(t, group) => setText(b.id, t, group)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function BulletRow({
  resumeId,
  jobId,
  bullet,
  value,
  savedValue,
  notes,
  checks,
  onChange,
}: {
  resumeId: string;
  jobId: string | null;
  bullet: Bullet;
  value: string;
  savedValue: string;
  notes: LintNote[];
  checks?: VariantChecks;
  onChange: (text: string, group?: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Rewrite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const edited = value.trim() !== bullet.text.trim();
  const unsaved = value.trim() !== savedValue.trim();

  async function suggest(refresh = false) {
    setOpen(true);
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

  return (
    <li className={clsx("card overflow-hidden", unsaved && "border-accent/50")}>
      <div className="grid gap-px bg-line lg:grid-cols-2">
        <div className="bg-surface p-4">
          <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3 lg:hidden">Original</p>
          <p className="reading text-[14.5px] text-ink-2">{bullet.text}</p>
        </div>
        <div className="bg-surface p-4">
          <label htmlFor={`b-${bullet.id}`} className="mb-1 block text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3 lg:hidden">
            Your version
          </label>
          <textarea
            id={`b-${bullet.id}`}
            className="input h-auto min-h-[76px] resize-y py-2 text-[14.5px] leading-relaxed"
            value={value}
            maxLength={600}
            rows={3}
            onChange={(e) => onChange(e.target.value, `type:${bullet.id}`)}
            aria-describedby={`n-${bullet.id}`}
          />
          {edited && (
            <p className="mt-2 text-[13.5px] leading-relaxed" aria-label="Changes from the original">
              {wordDiff(bullet.text, value).map((p, i) => (
                <span key={i} className={clsx(p.type === "added" && "rounded-sm bg-ok-soft text-ok", p.type === "removed" && "mr-0.5 text-ink-3 line-through")}>
                  {p.text}
                </span>
              ))}
            </p>
          )}
          <div id={`n-${bullet.id}`}>
            {notes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {notes.map((n) => (
                  <li key={n.id} className="flex items-start gap-1.5 text-xs text-ink-2">
                    <span className={clsx("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", n.kind === "impact" ? "bg-warn" : n.kind === "clarity" ? "bg-accent" : "bg-ink-3")} aria-hidden />
                    {n.text}
                  </li>
                ))}
              </ul>
            )}
            {checks && !unsaved && <GuardrailNotes checks={checks} />}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="btn-secondary h-8 px-2.5 text-xs" onClick={() => (open && data ? setOpen(false) : suggest())} aria-expanded={open}>
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> {open && data ? "Hide suggestions" : "Suggest"}
            </button>
            {edited && (
              <button className="btn-ghost h-8 px-2.5 text-xs" onClick={() => onChange(bullet.text)}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restore original
              </button>
            )}
            {unsaved && <span className="ml-auto text-2xs font-medium text-accent">Unsaved</span>}
          </div>
        </div>
      </div>
      {open && (
        <div className="border-t border-line bg-paper/70 px-4 py-3">
          {error && <ErrorBox message={error} onRetry={() => suggest()} />}
          {loading && (
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Drafting three versions of the original…
            </p>
          )}
          {data && !loading && (
            <>
              <ul className="grid gap-2 lg:grid-cols-3">
                {data.variants.map((v, i) => (
                  <li key={i} className="flex flex-col rounded-tile border border-line bg-surface p-3">
                    <p className="reading text-[14px]">{v.text}</p>
                    <p className="mt-1 text-xs text-ink-3">{v.rationale}</p>
                    <GuardrailNotes checks={v.checks} />
                    <button className="btn-primary mt-auto h-8 self-start px-2.5 text-xs" style={{ marginTop: 10 }} onClick={() => onChange(v.text)}>
                      <Check className="h-3.5 w-3.5" aria-hidden /> Use this
                    </button>
                  </li>
                ))}
              </ul>
              {data.questions.length > 0 && (
                <div className="mt-2 rounded-tile bg-accent-soft px-3 py-2 text-xs text-accent">
                  <p className="font-medium">To make it stronger, can you answer:</p>
                  <ul className="mt-1 list-disc pl-4">
                    {data.questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-3">
                <span>Suggestions are based on your original bullet and keep its facts; anything new is flagged.</span>
                <button className="hover:text-ink" onClick={() => suggest(true)}>
                  Suggest different versions
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}
