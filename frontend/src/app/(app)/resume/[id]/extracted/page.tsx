"use client";

import clsx from "clsx";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DocProvider, toViewerDoc, useDoc } from "@/components/doc-context";
import { Split } from "@/components/split";
import { ErrorBox } from "@/components/ui";
import { api, describeError, type ResumeFull } from "@/lib/api";
import { SECTION_TYPES, sectionLabel } from "@/lib/format";

type Contact = ResumeFull["parsed"]["contact"];
type Draft = { name: string; contact: Contact; keys: string[]; skills: string[] };

const draftOf = (r: ResumeFull): Draft => ({
  name: r.parsed.name ?? "",
  contact: { ...r.parsed.contact },
  keys: r.parsed.sections.map((s) => s.key),
  skills: [...r.parsed.skills_listed],
});

/** Step two of an upload: show what the parser found and let the user correct it before any analysis. */
export default function ExtractedPage() {
  const { id } = useParams<{ id: string }>();
  const [resume, setResume] = useState<ResumeFull | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.resume(id).then(setResume, (e) => setError(describeError(e)));
  }, [id]);

  if (error)
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <ErrorBox message={error} />
      </div>
    );
  if (!resume)
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-ink-3" aria-label="Loading" />
      </div>
    );
  const doc = toViewerDoc(resume);
  return (
    <DocProvider docs={[doc]}>
      <Split
        doc={doc}
        header={
          <div className="flex items-center gap-3 px-4 pb-3 pt-4 sm:px-6">
            <Link href="/app" className="btn-secondary h-10 w-10 shrink-0 p-0" aria-label="Back to overview">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Step 2 of 2 · Check what we found</p>
              <h1 className="truncate font-display text-[22px] font-bold leading-tight tracking-[-0.02em]">{resume.label}</h1>
            </div>
          </div>
        }
      >
        <Review resume={resume} onSaved={setResume} />
      </Split>
    </DocProvider>
  );
}

function Review({ resume, onSaved }: { resume: ResumeFull; onSaved: (r: ResumeFull) => void }) {
  const router = useRouter();
  const { show } = useDoc();
  const [draft, setDraft] = useState<Draft>(() => draftOf(resume));
  const [newSkill, setNewSkill] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const p = resume.parsed;
  const base = useMemo(() => draftOf(resume), [resume]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  const toFix = resume.checks.filter((c) => c.status === "fail" || c.status === "warn").length;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const section_keys = Object.fromEntries(draft.keys.map((k, i) => [i, k]).filter(([i, k]) => k !== base.keys[i as number]));
      const contact = Object.fromEntries(Object.entries(draft.contact).filter(([k, v]) => (v ?? "") !== (base.contact[k as keyof Contact] ?? "")));
      const r = await api.correctResume(resume.id, {
        ...(draft.name !== base.name ? { name: draft.name } : {}),
        ...(Object.keys(contact).length ? { contact } : {}),
        ...(Object.keys(section_keys).length ? { section_keys } : {}),
        ...(JSON.stringify(draft.skills) !== JSON.stringify(base.skills) ? { skills: draft.skills } : {}),
      });
      onSaved(r);
      setDraft(draftOf(r));
      const n = r.checks.filter((c) => c.status === "fail" || c.status === "warn").length;
      setSaved(`Saved. Checks ran again: ${n ? `${n} to fix` : "nothing to fix"}.`);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  const addSkill = () => {
    const s = newSkill.trim();
    if (s && !draft.skills.some((x) => x.toLowerCase() === s.toLowerCase())) setDraft({ ...draft, skills: [...draft.skills, s] });
    setNewSkill("");
  };

  return (
    <div className="px-5 pb-28 pt-2">
      <p className="text-sm leading-relaxed text-ink-2">
        Shortlist read your file with rules, not AI. If something below is wrong, fix it here: the checks run again and everything after this uses your
        corrections.
      </p>
      <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
        {[
          [p.sections.length, "sections"],
          [p.entries.length, "roles"],
          [p.bullets.length, "bullets"],
          [resume.experience_years ?? "–", "years"],
        ].map(([v, l]) => (
          <div key={l as string} className="rounded-tile border border-line bg-surface px-2 py-2.5">
            <dd className="font-display text-xl font-bold">{v}</dd>
            <dt className="text-2xs text-ink-3">{l}</dt>
          </div>
        ))}
      </dl>

      <Group title="Name and contact">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
          {(["email", "phone", "linkedin", "github"] as const).map((k) => (
            <Field key={k} label={k === "linkedin" ? "LinkedIn" : k === "github" ? "GitHub" : k[0].toUpperCase() + k.slice(1)} value={draft.contact[k] ?? ""} onChange={(v) => setDraft({ ...draft, contact: { ...draft.contact, [k]: v } })} placeholder="Not found" />
          ))}
        </div>
      </Group>

      <Group title="Sections" note="If a heading was read as the wrong kind of section, change its type. Bullets and roles move with it.">
        <ul className="space-y-1.5">
          {p.sections.map((s, i) => (
            <li key={i} className={clsx("flex items-center gap-3 rounded-tile border bg-surface px-3 py-2", draft.keys[i] !== base.keys[i] ? "border-accent/50" : "border-line")}>
              <button className="min-w-0 flex-1 text-left" onClick={() => show({ quote: s.title || s.text.split("\n")[0] || "", status: "verified", source: "resume", source_id: resume.id, section: null, page: s.page })} title="Show on the page">
                <span className="block truncate text-sm font-medium">{s.title || (s.key === "header" ? "Top of the resume" : "Untitled")}</span>
                <span className="block truncate text-xs text-ink-3">
                  p. {s.page} · {s.text.split("\n").find((l) => l.trim()) ?? "empty"}
                </span>
              </button>
              <label className="sr-only" htmlFor={`sec-${i}`}>
                Type of “{s.title || "section"}”
              </label>
              <select id={`sec-${i}`} className="input h-9 w-40 shrink-0 py-0 text-xs" value={draft.keys[i]} onChange={(e) => setDraft({ ...draft, keys: draft.keys.map((k, j) => (j === i ? e.target.value : k)) })}>
                {SECTION_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Roles found" note="Dated roles under Experience, Projects, Education and Volunteering. Years of experience are counted from these, without double-counting overlaps.">
        {p.entries.length ? (
          <ul className="space-y-1.5">
            {p.entries.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded-tile border border-line bg-surface px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{e.header || sectionLabel(e.section)}</span>
                <span className="shrink-0 text-xs text-ink-3">
                  {e.start} – {e.end}
                  {e.months ? ` · ${e.months} mo` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">No dated roles were found. If your experience is there, check that its section type is Experience.</p>
        )}
      </Group>

      <Group title="Skills listed" note="From your skills section. Add any it missed, or remove anything that isn't a skill.">
        <ul className="flex flex-wrap gap-1.5">
          {draft.skills.map((s) => (
            <li key={s} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-0.5 pl-2.5 pr-1 text-xs">
              {s}
              <button className="grid h-5 w-5 place-items-center rounded-full text-ink-3 hover:bg-sunk hover:text-ink" onClick={() => setDraft({ ...draft, skills: draft.skills.filter((x) => x !== s) })} aria-label={`Remove ${s}`}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
          {draft.skills.length === 0 && <li className="text-sm text-ink-3">No skills section found.</li>}
        </ul>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addSkill();
          }}
        >
          <label className="sr-only" htmlFor="new-skill">
            Add a skill
          </label>
          <input id="new-skill" className="input h-9 max-w-xs" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Add a skill" maxLength={60} />
          <button className="btn-secondary h-9" disabled={!newSkill.trim()}>
            <Plus className="h-4 w-4" aria-hidden /> Add
          </button>
        </form>
      </Group>

      <div className="sticky bottom-0 -mx-5 mt-8 border-t border-line bg-paper/95 px-5 py-3 backdrop-blur">
        {error && <ErrorBox message={error} />}
        {saved && !dirty && (
          <p className="mb-2 flex items-center gap-1.5 text-sm text-ok" role="status">
            <Check className="h-4 w-4" aria-hidden /> {saved}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <>
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Save corrections
              </button>
              <button className="btn-ghost" onClick={() => setDraft(base)} disabled={saving}>
                Discard
              </button>
            </>
          ) : (
            <button className="btn-primary" onClick={() => router.push(`/resume/${resume.id}`)}>
              Looks right, analyze <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
          <span className="ml-auto text-xs text-ink-3">{toFix ? `${toFix} readability issue${toFix === 1 ? "" : "s"} to review next` : "No readability issues found"}</span>
        </div>
      </div>
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {note && <p className="mb-3 mt-0.5 text-xs leading-relaxed text-ink-3">{note}</p>}
      {!note && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = `f-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink-2">
        {label}
      </label>
      <input id={id} className="input h-10" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={200} />
    </div>
  );
}
