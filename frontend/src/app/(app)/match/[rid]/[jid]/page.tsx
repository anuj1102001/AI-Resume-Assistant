"use client";

import clsx from "clsx";
import { ArrowLeft, Download, Lightbulb, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CitationChip, ClaimView, GroundingNote, Quote } from "@/components/claim";
import { DocProvider, toViewerDoc } from "@/components/doc-context";
import { BulletImprover } from "@/components/improver";
import { Split } from "@/components/split";
import { CoverageRing, ErrorBox, KindTag, Meter, MetaLine, SectionTitle, STATUS, StatusPill, Working } from "@/components/ui";
import { api, describeError, type Analysis, type Assessment, type JobFull, type Keywords, type MatchResult, type ResumeFull, type Tailored } from "@/lib/api";
import { wordDiff } from "@/lib/diff";
import { download } from "@/lib/download";

type Tab = "match" | "tailor";

export default function MatchPage() {
  const { rid, jid } = useParams<{ rid: string; jid: string }>();
  const [resume, setResume] = useState<ResumeFull | null>(null);
  const [job, setJob] = useState<JobFull | null>(null);
  const [kw, setKw] = useState<Keywords | null>(null);
  const [match, setMatch] = useState<Analysis<MatchResult> | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("match");

  const run = (refresh = false) => {
    setLoading(true);
    setMatchError(null);
    api
      .match(rid, jid, refresh)
      .then(setMatch, (e) => setMatchError(describeError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([api.resume(rid), api.job(jid)]).then(([r, j]) => {
      setResume(r);
      setJob(j);
    }, (e) => setError(describeError(e)));
    api.keywords(rid, jid).then(setKw, () => {});
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid, jid]);

  if (error) return <div className="mx-auto max-w-lg px-4 py-20"><ErrorBox message={error} /></div>;
  if (!resume || !job)
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
        evidenceSide
        header={
          <div className="flex items-center gap-3 px-4 pb-3 pt-4 sm:px-6">
            <Link href="/app" className="btn-secondary h-10 w-10 shrink-0 p-0" aria-label="Back to dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Match report</p>
              <h1 className="truncate font-display text-[22px] font-bold leading-tight tracking-[-0.02em]">{job.title}</h1>
              <p className="truncate text-xs text-ink-3">
                <Link href={`/resume/${resume.id}`} className="hover:text-ink hover:underline">
                  {resume.label}
                </Link>{" "}
                vs{" "}
                <Link href={`/jobs/${job.id}`} className="hover:text-ink hover:underline">
                  {job.company ?? "the job description"}
                </Link>
              </p>
            </div>
          </div>
        }
      >
        <div className="sticky top-0 z-10 bg-paper/90 px-4 pb-3 pt-1 backdrop-blur sm:px-6">
          <div role="tablist" aria-label="Match tools" className="mx-auto flex w-fit gap-1 rounded-full border border-line bg-surface p-1 shadow-card lg:mx-0">
            {(["match", "tailor"] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={clsx("rounded-full px-4 py-1.5 text-sm transition-colors", tab === t ? "bg-accent font-medium text-accent-ink" : "text-ink-2 hover:text-ink")}>
                {t === "match" ? "Match" : "Tailor for this job"}
              </button>
            ))}
          </div>
        </div>
        <div role="tabpanel" className="mx-auto max-w-[780px] px-4 pb-10 pt-2 sm:px-6">
          {tab === "match" ? (
            <MatchTab kw={kw} match={match} loading={loading} error={matchError} onRetry={() => run()} onRefresh={() => run(true)} onTailor={() => setTab("tailor")} />
          ) : (
            <TailorTab resume={resume} jobId={job.id} match={match?.result ?? null} />
          )}
        </div>
      </Split>
    </DocProvider>
  );
}

const ORDER = { missing: 0, partial: 1, met: 2 } as const;

function MatchTab({
  kw,
  match,
  loading,
  error,
  onRetry,
  onRefresh,
  onTailor,
}: {
  kw: Keywords | null;
  match: Analysis<MatchResult> | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRefresh: () => void;
  onTailor: () => void;
}) {
  const r = match?.result;
  const sorted = useMemo(
    () => (r ? [...r.assessments].sort((a, b) => (a.kind === b.kind ? ORDER[a.status] - ORDER[b.status] : a.kind === "must" ? -1 : 1)) : []),
    [r],
  );
  return (
    <div>
      {r ? (
        <ScoreHeader r={r} />
      ) : error ? (
        <ErrorBox message={error} onRetry={onRetry} />
      ) : (
        <Working text="Reading the requirements and finding evidence in your resume…" hint="The instant keyword check below is ready now; the full match takes a few seconds." />
      )}

      {kw && <KeywordPanel kw={kw} />}

      {r && (
        <div className="animate-rise">
          {r.summary.length > 0 && (
            <>
              <SectionTitle>Overall</SectionTitle>
              <div className="space-y-3">
                {r.summary.map((c, i) => (
                  <ClaimView key={i} claim={c} />
                ))}
              </div>
            </>
          )}
          <SectionTitle aside={<GroundingNote g={r.grounding} />}>Requirement by requirement</SectionTitle>
          <ul className="space-y-2.5">
            {sorted.map((a) => (
              <AssessmentCard key={a.requirement} a={a} onTailor={onTailor} />
            ))}
          </ul>
          {match && <MetaLine meta={match.meta} onRefresh={onRefresh} refreshing={loading} />}
        </div>
      )}
    </div>
  );
}

function ScoreHeader({ r }: { r: MatchResult }) {
  const counts = [
    ["met", r.score.met],
    ["partial", r.score.partial],
    ["missing", r.score.missing],
  ] as const;
  return (
    <section aria-label="Match summary" className="card flex flex-col items-center gap-5 p-5 sm:flex-row sm:items-center sm:gap-7">
      <CoverageRing coverage={r.score.coverage ?? 0} />
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="eyebrow">Requirement coverage</p>
        <p className="mt-1 font-display text-[26px] font-bold leading-tight tracking-[-0.02em]">
          {r.score.must_met} of {r.score.must_total} required shown
        </p>
        <ul className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
          {counts.map(([s, n]) => (
            <li key={s} className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", STATUS[s].cls)}>
              <span className={clsx("h-2 w-2 rounded-full", STATUS[s].bar)} aria-hidden />
              {n} {STATUS[s].label.toLowerCase()}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-ink-3">
          Required items count double, partial evidence half. This measures what your resume shows against this ad; it isn&apos;t a prediction of an interview or of
          any ATS ranking.
        </p>
      </div>
    </section>
  );
}

function KeywordPanel({ kw }: { kw: Keywords }) {
  if (!kw.job_skills && kw.years_required === null) return null;
  return (
    <details className="group mt-4 rounded-card border border-line bg-surface" open={false}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-medium">Keyword check</span>
          <span className="block text-xs text-ink-3">
            {kw.matched.length} of {kw.job_skills} named skills appear on your resume
            {kw.years_required !== null && ` · asks ${kw.years_required}+ years, you have ~${kw.years_estimated ?? 0}`}
          </span>
        </span>
        {kw.coverage !== null && <Meter value={kw.coverage} label="Keyword coverage" className="w-24" />}
      </summary>
      <div className="space-y-3 border-t border-line px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {kw.matched.map((m) => (
            <span key={m.skill} className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs text-ok">
              {m.skill}
            </span>
          ))}
          {kw.missing.map((m) => (
            <span key={m} className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-ink-3">
              {m}
            </span>
          ))}
        </div>
        <p className="text-xs text-ink-3">{kw.note}</p>
      </div>
    </details>
  );
}

function AssessmentCard({ a, onTailor }: { a: Assessment; onTailor: () => void }) {
  return (
    <li className="relative overflow-hidden rounded-tile border border-line bg-surface py-3.5 pl-5 pr-4 shadow-card">
      <span aria-hidden className={clsx("absolute inset-y-0 left-0 w-1.5", STATUS[a.status].bar)} />
      <div className="flex items-start gap-2">
        <StatusPill status={a.status} />
        <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{a.text}</p>
        <KindTag kind={a.kind} />
      </div>
      <p className="mt-1.5 text-sm text-ink-2">{a.explanation}</p>
      {a.downgraded && <p className="mt-1 text-xs text-warn">The AI said this was met, but its quote wasn&apos;t found in your resume, so it&apos;s shown as partly met.</p>}
      {a.evidence.slice(0, 2).map((c, i) => (
        <Quote key={i} c={c} />
      ))}
      {a.suggestion && (
        <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-accent-soft px-3 py-2 text-xs text-accent">
          <Lightbulb className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {a.suggestion}{" "}
            <button onClick={onTailor} className="font-medium underline underline-offset-2">
              Tailor a bullet
            </button>
          </span>
        </div>
      )}
      {a.job_citations[0] && (
        <div className="mt-2">
          <CitationChip c={a.job_citations[0]} />
        </div>
      )}
    </li>
  );
}

function TailorTab({ resume, jobId, match }: { resume: ResumeFull; jobId: string; match: MatchResult | null }) {
  const [version, setVersion] = useState<Tailored | null>(null);
  const [exporting, setExporting] = useState(false);
  const reload = () => api.tailored(resume.id, jobId).then(setVersion, () => {});
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume.id, jobId]);

  // Bullets the match cited as evidence come first: they're the ones this job cares about.
  const cited = new Set(match?.assessments.flatMap((a) => a.evidence.map((e) => e.quote.slice(0, 30))) ?? []);
  const bullets = [...resume.parsed.bullets].sort((a, b) => Number([...cited].some((q) => b.text.includes(q))) - Number([...cited].some((q) => a.text.includes(q))));
  const changes = version?.bullets.filter((b) => b.revised) ?? [];

  return (
    <div>
      <p className="text-sm text-ink-2">Rewrite bullets to speak to this job. Suggestions are tailored to its requirements but keep to your facts; anything new is flagged.</p>
      {changes.length > 0 && (
        <section className="mt-5 rounded-card border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">
              Tailored version · {changes.length} bullet{changes.length === 1 ? "" : "s"} changed
            </h3>
            <button
              className="btn-primary h-8 text-xs"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  download(await api.exportDocx(resume.id, jobId), `${resume.label.replace(/[^A-Za-z0-9 _-]/g, "").replace(/ /g, "_") || "resume"}_tailored.docx`);
                } finally {
                  setExporting(false);
                }
              }}
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />} Download .docx
            </button>
          </div>
          <ul className="mt-3 space-y-3">
            {changes.map((c) => (
              <li key={c.id} className="reading text-[14px]">
                {wordDiff(c.original, c.revised!).map((p, i) => (
                  <span key={i} className={clsx(p.type === "added" && "rounded-sm bg-ok-soft text-ok", p.type === "removed" && "mr-1 text-ink-3 line-through")}>
                    {p.text}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mt-5 space-y-2">
        {bullets.map((b) => (
          <BulletImprover key={b.id} resumeId={resume.id} bullet={b} jobId={jobId} saved={version?.bullets.find((x) => x.id === b.id)?.revised} onSaved={() => reload()} />
        ))}
      </div>
    </div>
  );
}
