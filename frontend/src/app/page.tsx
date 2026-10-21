"use client";

import clsx from "clsx";
import { AlertTriangle, ArrowRight, Briefcase, FileText, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Dropzone } from "@/components/dropzone";
import { CoverageRing, KindTag, StatusPill } from "@/components/ui";
import { api, describeError, type JobInfo, type MatchSummary, type ResumeInfo } from "@/lib/api";
import { checkFile, timeAgo } from "@/lib/format";

const SAMPLES = [
  { resume: "priya.pdf", job: "backend-engineer.txt", title: "Backend engineer", who: "Priya, 5 years in payments", jobTitle: "Senior Backend Engineer" },
  { resume: "arjun.pdf", job: "product-designer.txt", title: "Product designer", who: "Arjun, 6 years in health and fintech", jobTitle: "Product Designer (Healthcare)" },
];

type Data = { resumes: ResumeInfo[]; jobs: JobInfo[]; matches: MatchSummary[] };

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pick, setPick] = useState<{ resume: string; job: string }>({ resume: "", job: "" });

  const refresh = useCallback(() => api.overview().then(setData, (e) => setError(describeError(e))), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function upload(files: File[]) {
    const f = files[0];
    const problem = checkFile(f);
    if (problem) return setError(problem);
    setBusy(`Reading ${f.name}…`);
    setError(null);
    try {
      const r = await api.uploadResume(f);
      router.push(`/resume/${r.resume.id}`);
    } catch (e) {
      setError(describeError(e));
      setBusy(null);
    }
  }

  async function trySample(s: (typeof SAMPLES)[number]) {
    setBusy("Loading the sample resume and job…");
    setError(null);
    try {
      const [pdf, jd] = await Promise.all([fetch(`/samples/${s.resume}`).then((r) => r.blob()), fetch(`/samples/${s.job}`).then((r) => r.text())]);
      const r = await api.uploadResume(new File([pdf], s.resume, { type: "application/pdf" }));
      const job = await api.createJob(jd, s.jobTitle);
      router.push(`/match/${r.resume.id}/${job.id}`);
    } catch (e) {
      setError(describeError(e));
      setBusy(null);
    }
  }

  async function remove(kind: "resume" | "job", id: string, label: string) {
    if (!confirm(`Delete “${label}”? Its matches and saved rewrites go too. This can't be undone.`)) return;
    try {
      await (kind === "resume" ? api.deleteResume(id) : api.deleteJob(id));
      refresh();
    } catch (e) {
      setError(describeError(e));
    }
  }

  const empty = data && data.resumes.length === 0 && data.jobs.length === 0;
  const resumeName = (id: string) => data?.resumes.find((r) => r.id === id)?.label ?? "Resume";
  const jobName = (id: string) => data?.jobs.find((j) => j.id === id)?.title ?? "Job";

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-24 pt-10 sm:px-6">
      {busy && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-paper/70 backdrop-blur-sm" aria-live="polite">
          <p className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm shadow-lift">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {busy}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="mx-auto mb-6 flex max-w-2xl items-start gap-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {error}
        </p>
      )}

      {data === null && !error ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      ) : empty ? (
        <section className="grid items-center gap-10 pt-4 animate-rise lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14 lg:pt-10">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Resume and job matching, with evidence
            </p>
            <h1 className="mt-5 font-display text-[44px] font-bold leading-[1.02] tracking-[-0.035em] sm:text-[60px]">
              Show your real experience, <span className="rounded-md bg-mark px-1.5 text-[rgb(17_19_34)] [box-decoration-break:clone]">clearly.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
              See how your resume reads to recruiters and tracking systems, how it matches a job requirement by requirement, and sharpen your bullets without
              inventing anything.
            </p>
            <div className="mt-8">
              <Dropzone onFiles={upload} />
            </div>
            <div className="mt-6">
              <p className="text-sm font-medium text-ink-2">Or try a sample match</p>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {SAMPLES.map((s) => (
                  <button key={s.resume} onClick={() => trySample(s)} className="card group flex items-center gap-3 px-4 py-3 text-left transition-[border-color,transform] hover:-translate-y-0.5 hover:border-accent/50">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
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
          </div>
          <HeroPreview />
        </section>
      ) : (
        data && (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-display text-[34px] font-bold tracking-[-0.03em]">Your applications</h1>
                <p className="mt-1 text-sm text-ink-2">Everything stays private to this browser&apos;s workspace.</p>
              </div>
              {data.resumes.length > 0 && data.jobs.length > 0 && (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (pick.resume && pick.job) router.push(`/match/${pick.resume}/${pick.job}`);
                  }}
                >
                  <select aria-label="Resume" className="input h-9 w-44" value={pick.resume} onChange={(e) => setPick({ ...pick, resume: e.target.value })}>
                    <option value="">Resume…</option>
                    {data.resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <select aria-label="Job" className="input h-9 w-44" value={pick.job} onChange={(e) => setPick({ ...pick, job: e.target.value })}>
                    <option value="">Job…</option>
                    {data.jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                      </option>
                    ))}
                  </select>
                  <button className="btn-primary" disabled={!pick.resume || !pick.job}>
                    Match <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                </form>
              )}
            </div>

            {data.matches.length > 0 && (
              <section className="mt-8" aria-label="Matches">
                <h2 className="eyebrow mb-3">Matches</h2>
                <ul className="card divide-y divide-line">
                  {data.matches.map((m) => (
                    <li key={`${m.resume_id}-${m.job_id}`}>
                      <Link href={`/match/${m.resume_id}/${m.job_id}`} className="flex flex-col gap-2 px-4 py-3.5 hover:bg-sunk/60 sm:flex-row sm:items-center sm:gap-6">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium">{jobName(m.job_id)}</span>
                          <span className="block text-xs text-ink-3">
                            {resumeName(m.resume_id)} · matched {timeAgo(m.created_at)}
                          </span>
                        </span>
                        <CoverageRing coverage={m.score.coverage ?? 0} size={44} label={`${Math.round((m.score.coverage ?? 0) * 100)}% requirement coverage`} />
                        <span className="rounded-full bg-sunk px-2.5 py-1 text-xs text-ink-2 sm:text-right">
                          {m.score.must_met}/{m.score.must_total} required met
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <section aria-label="Resumes">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="eyebrow">Resumes · {data.resumes.length}</h2>
                </div>
                <ul className="space-y-2">
                  {data.resumes.map((r) => (
                    <li key={r.id} className="card group flex items-center">
                      <Link href={`/resume/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-sunk/60">
                        <FileText className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium">{r.label}</span>
                          <span className="block text-xs text-ink-3">
                            {r.experience_years ? `~${r.experience_years} years · ` : ""}
                            {r.page_count} page{r.page_count === 1 ? "" : "s"} · {r.filename}
                          </span>
                        </span>
                        <CheckSummary counts={r.check_counts} />
                      </Link>
                      <button onClick={() => remove("resume", r.id, r.label)} className="btn-ghost mr-2 h-8 px-2 opacity-60 group-hover:opacity-100" aria-label={`Delete ${r.label}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  <Dropzone onFiles={upload} compact />
                </div>
              </section>
              <section aria-label="Jobs">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="eyebrow">Jobs · {data.jobs.length}</h2>
                  <Link href="/jobs/new" className="btn-ghost h-8 px-2 text-xs">
                    <Plus className="h-3.5 w-3.5" aria-hidden /> Add a job
                  </Link>
                </div>
                {data.jobs.length === 0 ? (
                  <Link href="/jobs/new" className="card flex flex-col items-center gap-2 px-4 py-8 text-center hover:border-ink-3">
                    <Briefcase className="h-6 w-6 text-ink-3" aria-hidden />
                    <span className="text-sm font-medium">Paste a job description</span>
                    <span className="text-xs text-ink-3">Shortlist lists its requirements and checks your resume against each one.</span>
                  </Link>
                ) : (
                  <ul className="space-y-2">
                    {data.jobs.map((j) => (
                      <li key={j.id} className="card group flex items-center">
                        <Link href={`/jobs/${j.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-sunk/60">
                          <Briefcase className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium">{j.title}</span>
                            <span className="block text-xs text-ink-3">
                              {j.company ? `${j.company} · ` : ""}added {timeAgo(j.created_at)}
                            </span>
                          </span>
                        </Link>
                        <button onClick={() => remove("job", j.id, j.title)} className="btn-ghost mr-2 h-8 px-2 opacity-60 group-hover:opacity-100" aria-label={`Delete ${j.title}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )
      )}
    </div>
  );
}

function CheckSummary({ counts }: { counts: ResumeInfo["check_counts"] }) {
  const toFix = counts.fail + counts.warn;
  return (
    <span className={clsx("shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium", toFix ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok")}>
      {toFix ? `${toFix} to fix` : "Reads well"}
    </span>
  );
}

/** A static, illustrative match report: shows what you get before you upload anything. */
function HeroPreview() {
  const rows = [
    { status: "met", kind: "must", text: "4+ years building backend services", quote: "Backend engineer with four years building payment APIs" },
    { status: "met", kind: "must", text: "Event-driven systems (Kafka or similar)", quote: "moving fraud scoring to an asynchronous Kafka consumer" },
    { status: "partial", kind: "must", text: "Kubernetes in a public cloud", quote: "Infrastructure: Docker, Kubernetes, AWS" },
    { status: "missing", kind: "nice", text: "gRPC service design", quote: null },
  ] as const;
  return (
    <figure aria-label="Example match report" className="relative">
      <div aria-hidden className="absolute -inset-4 -z-10 rounded-[32px] bg-[radial-gradient(circle_at_70%_20%,rgb(var(--accent)/0.18),transparent_60%),radial-gradient(circle_at_20%_90%,rgb(var(--mark)/0.35),transparent_55%)]" />
      <div className="card p-5 shadow-lift">
        <div className="flex items-center gap-4">
          <CoverageRing coverage={0.74} size={88} label="Example: 74% requirement coverage" />
          <div>
            <p className="eyebrow">Example match</p>
            <p className="font-display text-xl font-bold tracking-[-0.02em]">Senior Backend Engineer</p>
            <p className="text-xs text-ink-3">5 of 7 required shown on the resume</p>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={r.text} className="rounded-tile border border-line bg-paper/60 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <StatusPill status={r.status} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.text}</span>
                <KindTag kind={r.kind} />
              </div>
              {r.quote && <p className="mt-1.5 truncate rounded-r-lg border-l-[3px] border-mark-strong bg-mark/20 py-0.5 pl-2 text-xs text-ink-2">“{r.quote}”</p>}
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-3 text-center text-xs text-ink-3">Illustration of a report. Every judgement quotes your resume.</figcaption>
    </figure>
  );
}
