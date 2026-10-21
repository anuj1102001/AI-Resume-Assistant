"use client";

import clsx from "clsx";
import { ArrowLeft, Download, Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AskPanel } from "@/components/ask";
import { ChecksReport } from "@/components/checks";
import { CitationChip, ClaimView, GroundingNote } from "@/components/claim";
import { DocProvider, toViewerDoc } from "@/components/doc-context";
import { BulletImprover } from "@/components/improver";
import { Split } from "@/components/split";
import { ErrorBox, MetaLine, SectionTitle, Working } from "@/components/ui";
import { api, describeError, type Analysis, type Profile, type ResumeFull } from "@/lib/api";
import { download } from "@/lib/download";

type Tab = "review" | "profile" | "improve" | "ask";
const TABS: { id: Tab; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "profile", label: "Profile" },
  { id: "improve", label: "Improve" },
  { id: "ask", label: "Ask" },
];

export default function ResumePage() {
  const { id } = useParams<{ id: string }>();
  const [resume, setResume] = useState<ResumeFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("review");

  useEffect(() => {
    api.resume(id).then(setResume, (e) => setError(describeError(e)));
  }, [id]);

  if (error)
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="font-display text-2xl">This resume isn&apos;t available.</p>
        <p className="mt-2 text-sm text-ink-2">{error}</p>
        <Link href="/app" className="btn-secondary mt-6">
          Back to the dashboard
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
      <Split doc={doc} header={<Header resume={resume} onRenamed={(label) => setResume({ ...resume, label })} />}>
        <div className="sticky top-0 z-10 bg-paper/90 px-4 pb-3 pt-4 backdrop-blur">
          <div role="tablist" aria-label="Resume tools" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1 shadow-card">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={clsx("whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors", tab === t.id ? "bg-accent font-medium text-accent-ink" : "text-ink-2 hover:text-ink")}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div role="tabpanel" className="px-5 pb-8 pt-1">
          {tab === "review" && <ChecksReport checks={resume.checks} resumeId={resume.id} />}
          {tab === "profile" && <ProfileTab resumeId={resume.id} />}
          {tab === "improve" && <ImproveTab resume={resume} />}
          {tab === "ask" && <AskPanel resumeId={resume.id} />}
        </div>
      </Split>
    </DocProvider>
  );
}

function Header({ resume, onRenamed }: { resume: ResumeFull; onRenamed: (label: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(resume.label);
  const c = resume.parsed.contact;
  return (
    <div className="flex items-center gap-3 px-4 pb-3 pt-4 sm:px-6">
      <Link href="/app" className="btn-secondary h-10 w-10 shrink-0 p-0" aria-label="Back to dashboard">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">Resume</p>
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
            <input className="input h-8 max-w-xs" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} aria-label="Resume name" autoFocus />
            <button className="btn-primary h-8 text-xs">Save</button>
          </form>
        ) : (
          <h1 className="flex items-center gap-2 truncate font-display text-[22px] font-bold leading-tight tracking-[-0.02em]">
            {resume.label}
            <button onClick={() => setEditing(true)} className="text-ink-3 hover:text-ink" aria-label="Rename resume">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </h1>
        )}
        <p className="truncate text-xs text-ink-3">
          {[resume.experience_years ? `~${resume.experience_years} years of experience` : null, c.email, c.phone].filter(Boolean).join(" · ")}
        </p>
      </div>
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
  if (!data) return <Working text="Reading your resume for skills and achievements…" />;
  const p = data.result;
  const demonstrated = p.skills.filter((s) => s.strength === "demonstrated");
  const listed = p.skills.filter((s) => s.strength === "listed");
  return (
    <div className="animate-rise">
      <p className="font-display text-xl font-semibold">{p.headline}</p>
      <div className="mt-3">
        <GroundingNote g={p.grounding} />
      </div>
      <div className="mt-4 space-y-3">
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
        <p className="text-sm text-ink-3">Every skill you list also appears in your work. Nice.</p>
      )}
      <SectionTitle>Strongest achievements</SectionTitle>
      <ul className="space-y-3">
        {p.achievements.map((a, i) => (
          <li key={i} className="border-l-2 border-mark pl-3">
            <p className="reading text-[15px]">
              {a.text}
              {!a.has_metric && <span className="ml-1.5 align-middle font-sans text-2xs text-warn">no number given</span>}
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
          <SectionTitle>Where your resume undersells you</SectionTitle>
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
        <li key={s.name} title={s.citations[0] ? `“${s.citations[0].quote}”` : undefined} className={clsx("rounded-full border px-2.5 py-1 text-xs", muted ? "border-dashed border-line text-ink-2" : "border-accent/30 bg-accent-soft text-accent")}>
          {s.name}
        </li>
      ))}
    </ul>
  );
}

function ImproveTab({ resume }: { resume: ResumeFull }) {
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    api.tailored(resume.id, null).then((t) => setSaved(Object.fromEntries(t.bullets.filter((b) => b.revised).map((b) => [b.id, b.revised!]))), () => {});
  }, [resume.id]);

  const { bullets, entries } = resume.parsed;
  const groups: { title: string; ids: string[] }[] = [];
  for (const b of bullets) {
    const title = b.entry !== null && entries[b.entry] ? entries[b.entry].header : b.section[0].toUpperCase() + b.section.slice(1);
    const g = groups.find((x) => x.title === title);
    if (g) g.ids.push(b.id);
    else groups.push({ title, ids: [b.id] });
  }
  const changed = Object.keys(saved).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-sm text-sm text-ink-2">Improve any bullet. Suggestions keep your facts; anything they add that your original doesn&apos;t say is flagged.</p>
        <button
          className="btn-secondary"
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
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />} Word (.docx){changed ? ` · ${changed} edited` : ""}
        </button>
      </div>
      {bullets.length === 0 && <p className="mt-6 text-sm text-ink-3">No bullet points were found under Experience or Projects.</p>}
      {groups.map((g) => (
        <section key={g.title} className="mt-6">
          <h3 className="mb-2 text-sm font-medium">{g.title}</h3>
          <div className="space-y-2">
            {g.ids.map((bid) => {
              const b = bullets.find((x) => x.id === bid)!;
              return <BulletImprover key={bid} resumeId={resume.id} bullet={b} jobId={null} saved={saved[bid]} onSaved={(rev) => setSaved((s) => ({ ...s, [bid]: rev }))} />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
