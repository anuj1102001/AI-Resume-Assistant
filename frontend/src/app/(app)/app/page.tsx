"use client";

import clsx from "clsx";
import { ArrowRight, Check, CircleAlert, FileText, Lightbulb, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Dropzone } from "@/components/dropzone";
import { BusyOverlay, ErrorLine, UploadProgress, JobRow, MatchRow, Panel, ResumeRow } from "@/components/workspace-ui";
import { api, type ResumeFull } from "@/lib/api";
import { SAMPLES, useWorkspace, type Overview } from "@/lib/workspace";

export default function OverviewPage() {
  const ws = useWorkspace();
  const { data } = ws;
  const [full, setFull] = useState<ResumeFull[] | null>(null);

  // Full records (checks and parsed skills) for the most recent resumes; the overview list only has counts.
  const ids = data?.resumes.slice(0, 6).map((r) => r.id).join(",") ?? "";
  useEffect(() => {
    if (!data) return;
    if (!data.resumes.length) return setFull([]);
    Promise.all(data.resumes.slice(0, 6).map((r) => api.resume(r.id))).then(setFull, () => setFull([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const empty = data && data.resumes.length === 0 && data.jobs.length === 0;

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-8 sm:px-8">
      <BusyOverlay text={ws.busy} />
      <UploadProgress state={ws.uploading} />
      <ErrorLine message={ws.error} />
      {data === null && !ws.error ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading your workspace">
          <div className="skeleton h-9 w-72" />
          <div className="skeleton h-40" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="skeleton h-56" />
            <div className="skeleton h-56" />
          </div>
        </div>
      ) : empty ? (
        <Welcome onFiles={ws.upload} onSample={ws.trySample} />
      ) : (
        data && (
          <div className="animate-rise">
            <p className="text-sm text-ink-3">{greeting()}</p>
            <h1 className="mt-1 font-display text-[30px] font-bold leading-tight tracking-[-0.03em] sm:text-[34px]">Your workspace</h1>

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <NextStep data={data} latest={full?.[0] ?? null} />
              <div id="upload" className="scroll-mt-24">
                <Dropzone onFiles={ws.upload} compact />
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Checklist resume={full?.[0] ?? null} loading={full === null} />
              <Panel title="Recent matches" aside={data.matches.length > 0 && <Link href="/app/matches" className="text-xs font-medium text-accent hover:underline">All matches</Link>}>
                {data.matches.length ? (
                  <ul className="-mx-2">
                    {data.matches.slice(0, 4).map((m) => (
                      <MatchRow key={`${m.resume_id}-${m.job_id}`} m={m} resumeName={ws.resumeName(m.resume_id)} jobName={ws.jobName(m.job_id)} />
                    ))}
                  </ul>
                ) : (
                  <EmptyHint text="No matches yet. Add a job ad and Shortlist checks your resume against each of its requirements." href="/jobs/new" cta="Add a job" />
                )}
              </Panel>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <Panel title="My resumes" aside={<Link href="/app/resumes" className="text-xs font-medium text-accent hover:underline">Manage</Link>}>
                <ul className="-mx-2">
                  {data.resumes.slice(0, 4).map((r) => (
                    <ResumeRow key={r.id} r={r} />
                  ))}
                </ul>
                {data.resumes.length === 0 && <EmptyHint text="Upload a resume to see how it reads." href="#upload" cta="Upload" />}
              </Panel>
              <Panel title="Jobs you're considering" aside={<Link href="/jobs/new" className="text-xs font-medium text-accent hover:underline">Add a job</Link>}>
                {data.jobs.length ? (
                  <ul className="-mx-2">
                    {data.jobs.slice(0, 4).map((j) => (
                      <JobRow key={j.id} j={j} />
                    ))}
                  </ul>
                ) : (
                  <EmptyHint text="Paste a job description to see its requirements, each with a quote from the ad." href="/jobs/new" cta="Add a job" />
                )}
              </Panel>
              <Skills resumes={full} />
            </div>
          </div>
        )
      )}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** One clear next step, worked out from what's actually in the workspace. */
function NextStep({ data, latest }: { data: Overview; latest: ResumeFull | null }) {
  const step = useMemo(() => {
    const resume = data.resumes[0];
    const toFix = latest ? latest.checks.filter((c) => c.status === "fail" || c.status === "warn").length : 0;
    const weakest = [...data.matches].filter((m) => m.score.must_met < m.score.must_total).sort((a, b) => (a.score.coverage ?? 0) - (b.score.coverage ?? 0))[0];
    if (!resume) return { title: "Upload your resume", body: "Checks run instantly, without AI, and show how your resume reads to people and tracking systems.", href: "#upload", cta: "Upload a resume" };
    if (latest && toFix > 0)
      return { title: `Fix ${toFix} readability issue${toFix === 1 ? "" : "s"} in ${latest.label}`, body: "Each one shows the lines involved, why it matters and what to change.", href: `/resume/${latest.id}`, cta: "Review the checks" };
    if (!data.jobs.length) return { title: "Add a job you're considering", body: "Paste the ad. Shortlist lists its requirements and checks your resume against each one, quoting both.", href: "/jobs/new", cta: "Add a job" };
    if (!data.matches.length) return { title: "Match your resume to a job", body: "Open a job and choose a resume to see which requirements your resume shows, partly shows, or doesn't show.", href: `/jobs/${data.jobs[0].id}`, cta: "Open the job" };
    if (weakest) {
      const gap = weakest.score.must_total - weakest.score.must_met;
      const job = data.jobs.find((j) => j.id === weakest.job_id)?.title ?? "this job";
      return { title: `${gap} required item${gap === 1 ? "" : "s"} not clearly shown for ${job}`, body: "Tailor the bullets that relate to them. Suggestions keep to your facts and flag anything new.", href: `/match/${weakest.resume_id}/${weakest.job_id}`, cta: "Open the match" };
    }
    return { title: "Try another role", body: "Your matches cover every required item. Add another job ad to compare.", href: "/jobs/new", cta: "Add a job" };
  }, [data, latest]);

  return (
    <section aria-label="Recommended next step" className="relative overflow-hidden rounded-card bg-ink p-6 text-paper shadow-lift">
      <span aria-hidden className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-accent/50 blur-3xl" />
      <p className="relative flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.12em] text-mark">
        <Sparkles className="h-3.5 w-3.5" aria-hidden /> Recommended next step
      </p>
      <h2 className="relative mt-2 font-display text-[22px] font-bold leading-snug tracking-[-0.02em]">{step.title}</h2>
      <p className="relative mt-1.5 max-w-lg text-sm leading-relaxed text-paper/75">{step.body}</p>
      <Link href={step.href} className="btn relative mt-5 bg-paper text-ink hover:bg-paper/90">
        {step.cta} <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

function Checklist({ resume, loading }: { resume: ResumeFull | null; loading: boolean }) {
  if (loading) return <div className="skeleton h-64" />;
  if (!resume)
    return (
      <Panel title="Resume checklist">
        <EmptyHint text="Upload a resume to get a checklist of readability checks: contact details, headings, layout, bullets, dates and more." href="#upload" cta="Upload" />
      </Panel>
    );
  const order = { fail: 0, warn: 1, info: 2, pass: 3 } as const;
  const checks = [...resume.checks].sort((a, b) => order[a.status] - order[b.status]);
  const passing = checks.filter((c) => c.status === "pass").length;
  return (
    <Panel title="Resume checklist" aside={<span className="truncate text-xs text-ink-3">{resume.label}</span>}>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-sunk" role="meter" aria-valuemin={0} aria-valuemax={checks.length} aria-valuenow={passing} aria-label="Checks passing">
          <div className="h-full rounded-full bg-ok transition-[width] duration-700" style={{ width: `${(passing / checks.length) * 100}%` }} />
        </div>
        <span className="text-xs font-medium text-ink-2">
          {passing} of {checks.length} pass
        </span>
      </div>
      <ul className="mt-4 space-y-1">
        {checks.slice(0, 6).map((c) => (
          <li key={c.id}>
            <Link href={`/resume/${resume.id}`} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-sunk/70">
              <StatusIcon status={c.status} />
              <span className="min-w-0 flex-1">
                <span className={clsx("block", c.status === "pass" ? "text-ink-2" : "font-medium")}>{c.title}</span>
                {c.status !== "pass" && <span className="block truncate text-xs text-ink-3">{c.found}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {checks.length > 6 && (
        <Link href={`/resume/${resume.id}`} className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
          See all {checks.length} checks
        </Link>
      )}
    </Panel>
  );
}

function StatusIcon({ status }: { status: "pass" | "warn" | "fail" | "info" }) {
  if (status === "pass")
    return (
      <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ok text-surface" aria-label="Passes">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  if (status === "info") return <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-label="Tip" />;
  return <CircleAlert className={clsx("mt-0.5 h-4 w-4 shrink-0", status === "fail" ? "text-bad" : "text-warn")} aria-label={status === "fail" ? "To fix" : "Worth fixing"} />;
}

function Skills({ resumes }: { resumes: ResumeFull[] | null }) {
  if (resumes === null) return <div className="skeleton h-56" />;
  const count = new Map<string, number>();
  for (const r of resumes) for (const s of new Set(r.parsed.skills_listed)) count.set(s, (count.get(s) ?? 0) + 1);
  const skills = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return (
    <Panel title="Skills on your resumes" aside={skills.length > 0 && <span className="text-xs text-ink-3">{skills.length}</span>}>
      {skills.length ? (
        <>
          <ul className="flex flex-wrap gap-1.5">
            {skills.slice(0, 24).map(([s, n]) => (
              <li key={s} className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs" title={n > 1 ? `On ${n} resumes` : undefined}>
                {s}
                {n > 1 && <span className="ml-1 text-ink-3">×{n}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-ink-3">From each resume&apos;s skills section. Open a resume&apos;s Profile to see which ones your work actually shows.</p>
        </>
      ) : (
        <EmptyHint text="No skills section found yet." href="#upload" cta="Upload a resume" />
      )}
    </Panel>
  );
}

function EmptyHint({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="rounded-tile border border-dashed border-line px-4 py-6 text-center">
      <p className="text-sm text-ink-2">{text}</p>
      <Link href={href} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
        {cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

/** First visit: nothing in the workspace yet. */
function Welcome({ onFiles, onSample }: { onFiles: (f: File[]) => void; onSample: (s: (typeof SAMPLES)[number]) => void }) {
  return (
    <section className="mx-auto max-w-3xl animate-rise">
      <p className="text-sm text-ink-3">{greeting()}</p>
      <h1 className="mt-1 font-display text-[34px] font-bold leading-tight tracking-[-0.03em] sm:text-[40px]">Let&apos;s start with your resume</h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-2">
        Your workspace is private to this browser. Nothing is analysed until you upload something, and you can delete it at any time.
      </p>
      <div id="upload" className="mt-6 scroll-mt-24">
        <Dropzone onFiles={onFiles} />
      </div>
      <div className="mt-6">
        <p className="text-sm font-medium text-ink-2">Or explore with a sample</p>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          {SAMPLES.map((s) => (
            <button key={s.resume} onClick={() => onSample(s)} className="card group flex items-center gap-3 px-4 py-3 text-left transition-colors hover:border-accent/50">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                <FileText className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{s.title}</span>
                <span className="block truncate text-xs text-ink-3">
                  {s.who} → {s.jobTitle}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-xs text-ink-3">Sample resumes and job ads are fictional, written for testing.</p>
      </div>
      <ol className="mt-10 grid gap-3 sm:grid-cols-3">
        {[
          ["Upload", "Readability checks run instantly, without AI: layout, headings, contact details, bullets, dates."],
          ["Analyze", "See which skills your work shows, and match the resume to a job, with quotes."],
          ["Improve", "Rewrite bullets with suggestions that keep to your facts, then export to Word."],
        ].map(([t, d], i) => (
          <li key={t} className="rounded-tile border border-line bg-surface p-4">
            <span className="font-mono text-2xs text-accent">0{i + 1}</span>
            <p className="mt-1 text-sm font-semibold">{t}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-3">{d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
