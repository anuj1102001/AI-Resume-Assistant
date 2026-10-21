"use client";

import clsx from "clsx";
import { ArrowLeft, Download, FileCheck2, Loader2, MessageSquare, Pencil, PenLine, Sparkles, Wrench } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AskPanel } from "@/components/ask";
import { ChecksReport } from "@/components/checks";
import { CitationChip, ClaimView, GroundingNote } from "@/components/claim";
import { DocProvider, toViewerDoc, useDoc } from "@/components/doc-context";
import { BulletImprover } from "@/components/improver";
import { ErrorBox, MetaLine, SectionTitle, Working } from "@/components/ui";
import { Workspace3, type Pane } from "@/components/workspace3";
import { api, describeError, type Analysis, type Bullet, type Check, type Profile, type ResumeFull } from "@/lib/api";
import { download } from "@/lib/download";
import { sectionLabel } from "@/lib/format";

type Tab = "overview" | "checks" | "sections";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "checks", label: "Checks" },
  { id: "sections", label: "By section" },
];

/** Which non-passing checks point at each bullet (a check's evidence lines are the resume lines it found). */
function flagsByBullet(bullets: Bullet[], checks: Check[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const c of checks) {
    if (c.status === "pass") continue;
    for (const ev of c.evidence) {
      const e = ev.text.trim();
      if (e.length < 12) continue;
      for (const b of bullets) {
        if (!(b.text.includes(e.slice(0, 48)) || e.includes(b.text.slice(0, 48)))) continue;
        const list = (out[b.id] ??= []);
        if (!list.includes(c.title)) list.push(c.title);
      }
    }
  }
  return out;
}

export default function ResumePage() {
  const { id } = useParams<{ id: string }>();
  const [resume, setResume] = useState<ResumeFull | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.resume(id).then(setResume, (e) => setError(describeError(e)));
  }, [id]);

  if (error)
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="font-display text-2xl">This resume isn&apos;t available.</p>
        <p className="mt-2 text-sm text-ink-2">{error}</p>
        <Link href="/app" className="btn-secondary mt-6">
          Back to the overview
        </Link>
      </div>
    );
  if (!resume)
    return (
      <div className="grid place-items-center py-24" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-ink-3" aria-label="Loading" />
      </div>
    );
  const doc = toViewerDoc(resume);
  return (
    <DocProvider docs={[doc]}>
      <Workspace resume={resume} setResume={setResume} />
    </DocProvider>
  );
}

function Workspace({ resume, setResume }: { resume: ResumeFull; setResume: (r: ResumeFull) => void }) {
  const [pane, setPane] = useState<Pane>("analysis");
  const [tab, setTab] = useState<Tab>("overview");
  const [mode, setMode] = useState<"ask" | "rewrite">("ask");
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const flags = useMemo(() => flagsByBullet(resume.parsed.bullets, resume.checks), [resume]);

  useEffect(() => {
    api.tailored(resume.id, null).then((t) => setSaved(Object.fromEntries(t.bullets.filter((b) => b.revised).map((b) => [b.id, b.revised!]))), () => {});
  }, [resume.id]);

  const improve = (bid: string) => {
    setSelected(bid);
    setMode("rewrite");
    setPane("assistant");
  };
  const onSaved = (bid: string, rev: string | null) =>
    setSaved((s) => {
      const next = { ...s };
      if (rev) next[bid] = rev;
      else delete next[bid];
      return next;
    });

  return (
    <Workspace3
      doc={toViewerDoc(resume)}
      pane={pane}
      setPane={setPane}
      header={<Header resume={resume} edited={Object.keys(saved).length} onRenamed={(label) => setResume({ ...resume, label })} />}
      nav={<SectionNav resume={resume} />}
      analysis={
        <>
          <Tabs<Tab> label="Analysis" tabs={TABS} value={tab} onChange={setTab} />
          <div role="tabpanel" className="px-5 pb-10 pt-1">
            {tab === "overview" && <ProfileTab resumeId={resume.id} />}
            {tab === "checks" && <ChecksReport checks={resume.checks} resumeId={resume.id} />}
            {tab === "sections" && <SectionsTab resume={resume} flags={flags} saved={saved} selected={selected} onImprove={improve} />}
          </div>
        </>
      }
      assistant={
        <>
          <Tabs
            label="Assistant"
            tabs={[
              { id: "ask", label: "Ask" },
              { id: "rewrite", label: "Rewrite" },
            ]}
            value={mode}
            onChange={setMode}
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-1">
            {mode === "ask" ? (
              <AskPanel resumeId={resume.id} />
            ) : (
              <RewritePanel resume={resume} flags={flags} saved={saved} selected={selected} onSelect={setSelected} onSaved={onSaved} />
            )}
          </div>
        </>
      }
    />
  );
}

function Tabs<T extends string>({ label, tabs, value, onChange }: { label: string; tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="sticky top-0 z-10 bg-inherit px-4 pb-3 pt-3">
      <div role="tablist" aria-label={label} className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={value === t.id}
            onClick={() => onChange(t.id)}
            className={clsx("whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors", value === t.id ? "bg-accent font-medium text-accent-ink" : "text-ink-2 hover:text-ink")}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Header({ resume, edited, onRenamed }: { resume: ResumeFull; edited: number; onRenamed: (label: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(resume.label);
  const [exporting, setExporting] = useState(false);
  const c = resume.parsed.contact;
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 pb-3 pt-4 sm:px-6">
      <Link href="/app" className="btn-secondary h-10 w-10 shrink-0 p-0" aria-label="Back to overview">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">Resume analysis</p>
        {editing ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!label.trim()) return;
              await api.renameResume(resume.id, label.trim());
              onRenamed(label.trim());
              setEditing(false);
            }}
            className="flex gap-2"
          >
            <input className="input h-9 max-w-xs" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} aria-label="Resume name" autoFocus />
            <button className="btn-primary h-9 text-xs">Save</button>
          </form>
        ) : (
          <h1 className="flex items-center gap-2 truncate font-display text-[22px] font-bold leading-tight tracking-[-0.02em]">
            {resume.label}
            <button onClick={() => setEditing(true)} className="text-ink-3 hover:text-ink" aria-label="Rename resume">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </h1>
        )}
        <p className="truncate text-xs text-ink-3">{[resume.experience_years ? `~${resume.experience_years} years of experience` : null, c.email, c.phone].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="flex w-full justify-end gap-2 sm:w-auto">
        <Link href={`/resume/${resume.id}/edit`} className="btn-secondary h-9 text-xs" title="Edit every bullet, with suggestions and undo">
          <PenLine className="h-3.5 w-3.5" aria-hidden /> Editor
        </Link>
        <Link href={`/resume/${resume.id}/extracted`} className="btn-ghost h-9 text-xs" title="Correct what was read from the file">
          <Wrench className="h-3.5 w-3.5" aria-hidden /> Fix extraction
        </Link>
        <button
          className="btn-secondary h-9 text-xs"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              download(await api.exportDocx(resume.id, null), `${resume.label.replace(/[^A-Za-z0-9 _-]/g, "").replace(/ /g, "_") || "resume"}.docx`);
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />} Word{edited ? ` · ${edited} edited` : ""}
        </button>
      </div>
    </div>
  );
}

/** Jump to a section on the page. */
function SectionNav({ resume }: { resume: ResumeFull }) {
  const { show } = useDoc();
  const sections = resume.parsed.sections.filter((s) => s.key !== "header" && s.title);
  if (!sections.length) return null;
  return (
    <nav aria-label="Resume sections" className="flex gap-1.5 overflow-x-auto border-b border-line bg-surface px-3 py-2">
      {sections.map((s, i) => (
        <button
          key={i}
          onClick={() => show({ quote: s.title, status: "verified", source: "resume", source_id: resume.id, section: null, page: s.page })}
          className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 transition-colors hover:border-accent/50 hover:text-ink"
        >
          {s.title}
        </button>
      ))}
    </nav>
  );
}

function SectionsTab({
  resume,
  flags,
  saved,
  selected,
  onImprove,
}: {
  resume: ResumeFull;
  flags: Record<string, string[]>;
  saved: Record<string, string>;
  selected: string | null;
  onImprove: (bid: string) => void;
}) {
  const { show } = useDoc();
  const p = resume.parsed;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">Your resume, section by section, with what the checks found in each bullet. Choose a bullet to rewrite it with the assistant.</p>
      {p.sections.map((s, i) => {
        const bullets = p.bullets.filter((b) => b.section === s.key && s.text.includes(b.text.slice(0, 30)));
        const preview = s.text.split("\n").filter((l) => l.trim()).slice(0, 3);
        return (
          <section key={i} className="card p-4" aria-label={s.title || sectionLabel(s.key)}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="min-w-0 truncate text-[15px] font-semibold">{s.title || (s.key === "header" ? "Top of the resume" : "Untitled section")}</h3>
              <span className="shrink-0 rounded-full bg-sunk px-2 py-0.5 text-2xs text-ink-2">{sectionLabel(s.key)}</span>
            </div>
            <button
              className="mt-0.5 text-xs text-accent hover:underline"
              onClick={() => show({ quote: s.title || preview[0] || "", status: "verified", source: "resume", source_id: resume.id, section: null, page: s.page })}
            >
              Show on page {s.page}
            </button>
            {s.key === "skills" ? (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {p.skills_listed.map((k) => (
                  <li key={k} className="rounded-full border border-line px-2.5 py-0.5 text-xs">
                    {k}
                  </li>
                ))}
              </ul>
            ) : bullets.length ? (
              <ul className="mt-3 space-y-2">
                {bullets.map((b) => (
                  <li key={b.id} className={clsx("rounded-tile border px-3 py-2.5 transition-colors", selected === b.id ? "border-accent bg-accent-soft/40" : "border-line")}>
                    <p className="reading text-[14px]">{saved[b.id] ?? b.text}</p>
                    {saved[b.id] && <p className="mt-0.5 text-xs text-ink-3 line-through decoration-ink-3/50">{b.text}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {(flags[b.id] ?? []).map((f) => (
                        <span key={f} className="rounded-full bg-warn-soft px-2 py-0.5 text-2xs font-medium text-warn">
                          {f}
                        </span>
                      ))}
                      {saved[b.id] && <span className="rounded-full bg-ok-soft px-2 py-0.5 text-2xs font-medium text-ok">Edited</span>}
                      <button onClick={() => onImprove(b.id)} className="btn-ghost ml-auto h-7 px-2 text-xs" aria-label={`Rewrite: ${b.text.slice(0, 40)}`}>
                        <PenLine className="h-3.5 w-3.5" aria-hidden /> Rewrite
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 space-y-0.5 text-sm text-ink-2">
                {preview.length ? preview.map((l, j) => <p key={j} className="truncate">{l}</p>) : <p className="text-ink-3">Empty</p>}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function RewritePanel({
  resume,
  flags,
  saved,
  selected,
  onSelect,
  onSaved,
}: {
  resume: ResumeFull;
  flags: Record<string, string[]>;
  saved: Record<string, string>;
  selected: string | null;
  onSelect: (bid: string | null) => void;
  onSaved: (bid: string, rev: string | null) => void;
}) {
  const bullet = resume.parsed.bullets.find((b) => b.id === selected) ?? null;
  const flagged = resume.parsed.bullets.filter((b) => flags[b.id]?.length && !saved[b.id]);
  const work = resume.parsed.bullets.filter((b) => !flags[b.id]?.length && ["experience", "projects", "volunteering"].includes(b.section)).slice(0, 4);

  if (bullet)
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Rewrite this bullet</p>
          <button className="text-xs text-ink-3 hover:text-ink" onClick={() => onSelect(null)}>
            Choose another
          </button>
        </div>
        {flags[bullet.id]?.length ? <p className="text-xs text-warn">Flagged by: {flags[bullet.id].join(", ")}</p> : null}
        <BulletImprover key={bullet.id} panel resumeId={resume.id} bullet={bullet} jobId={null} saved={saved[bullet.id]} onSaved={(rev) => onSaved(bullet.id, rev)} />
        <p className="text-xs leading-relaxed text-ink-3">
          Suggestions keep your facts. Any number or skill your original doesn&apos;t contain is flagged beside the suggestion, and nothing changes until you save.
        </p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="rounded-tile border border-line bg-paper p-4">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-accent" aria-hidden /> Rewrite a bullet
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">Choose a bullet under By section, or start with one below. You get three versions, each with its reasoning, and you decide what to keep.</p>
      </div>
      {flagged.length > 0 && <BulletPicks title="Flagged by the checks" bullets={flagged} flags={flags} onSelect={onSelect} />}
      {work.length > 0 && <BulletPicks title={flagged.length ? "Other work bullets" : "Your work bullets"} bullets={work} flags={flags} onSelect={onSelect} />}
      {!resume.parsed.bullets.length && <p className="text-sm text-ink-3">No bullet points were found. If your experience is there, use Fix extraction to set the right section type.</p>}
    </div>
  );
}

function BulletPicks({ title, bullets, flags, onSelect }: { title: string; bullets: Bullet[]; flags: Record<string, string[]>; onSelect: (bid: string) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3">{title}</p>
      <ul className="space-y-1.5">
        {bullets.map((b) => (
          <li key={b.id}>
            <button onClick={() => onSelect(b.id)} className="w-full rounded-tile border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-accent/50">
              <span className="line-clamp-2 text-sm">{b.text}</span>
              {flags[b.id]?.length ? <span className="mt-1 block text-2xs text-warn">{flags[b.id].join(" · ")}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProfileTab({ resumeId }: { resumeId: string }) {
  const [data, setData] = useState<Analysis<Profile> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = (refresh = false) => {
    setLoading(true);
    setError(null);
    api
      .profile(resumeId, refresh)
      .then(setData, (e) => setError(describeError(e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);
  if (error) return <ErrorBox message={error} onRetry={() => load()} />;
  if (!data) return <Working text="Reading your resume for strengths, skills and gaps…" hint="This is an AI step. Every claim it makes will cite a line of your resume." />;
  const p = data.result;
  const demonstrated = p.skills.filter((s) => s.strength === "demonstrated");
  const listed = p.skills.filter((s) => s.strength === "listed");
  return (
    <div className="animate-rise">
      <p className="font-display text-xl font-bold tracking-[-0.02em]">{p.headline}</p>
      <div className="mt-3">
        <GroundingNote g={p.grounding} />
      </div>
      <SectionTitle>
        <span className="inline-flex items-center gap-1.5">
          <FileCheck2 className="h-3.5 w-3.5" aria-hidden /> Summary
        </span>
      </SectionTitle>
      <div className="space-y-3">
        {p.summary.map((c, i) => (
          <ClaimView key={i} claim={c} />
        ))}
      </div>
      <SectionTitle aside={<span className="text-2xs text-ink-3">{demonstrated.length}</span>}>Skills shown in your work</SectionTitle>
      <SkillChips skills={demonstrated} />
      <SectionTitle aside={<span className="text-2xs text-ink-3">{listed.length}</span>}>Skills only listed</SectionTitle>
      {listed.length ? (
        <>
          <SkillChips skills={listed} muted />
          <p className="mt-2 text-xs text-ink-3">Recruiters trust skills they can see in use. If you&apos;ve used these, mention them in a bullet about the work.</p>
        </>
      ) : (
        <p className="text-sm text-ink-3">Every skill you list also appears in your work.</p>
      )}
      <SectionTitle>Strongest achievements</SectionTitle>
      <ul className="space-y-3">
        {p.achievements.map((a, i) => (
          <li key={i} className="border-l-[3px] border-mark-strong pl-3">
            <p className="reading text-[15px]">
              {a.text}
              {!a.has_metric && <span className="ml-1.5 align-middle text-2xs text-warn">no number given</span>}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {a.citations.map((c, j) => (
                <CitationChip key={j} c={c} />
              ))}
            </div>
          </li>
        ))}
      </ul>
      {p.improvement_areas.length > 0 && (
        <>
          <SectionTitle>
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Where your resume undersells you
            </span>
          </SectionTitle>
          <div className="space-y-3">
            {p.improvement_areas.map((c, i) => (
              <ClaimView key={i} claim={c} />
            ))}
          </div>
        </>
      )}
      <MetaLine meta={data.meta} onRefresh={() => load(true)} refreshing={loading} />
    </div>
  );
}

function SkillChips({ skills, muted }: { skills: Profile["skills"]; muted?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {skills.map((s) => (
        <li
          key={s.name}
          title={s.citations[0] ? `“${s.citations[0].quote}”` : undefined}
          className={clsx("rounded-full border px-2.5 py-1 text-xs", muted ? "border-dashed border-line text-ink-2" : "border-accent/30 bg-accent-soft text-accent")}
        >
          {s.name}
        </li>
      ))}
    </ul>
  );
}
