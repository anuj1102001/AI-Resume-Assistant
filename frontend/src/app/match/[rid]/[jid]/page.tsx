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
import { ErrorBox, KindTag, Meter, MetaLine, SectionTitle, StatusPill, Working } from "@/components/ui";
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
        header={
          <div className="flex items-center gap-3 border-b border-line px-4 py-2.5 sm:px-6">
            <Link href="/" className="btn-ghost h-8 w-8 p-0" aria-label="Back to dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-serif text-[17px] font-semibold">{job.title}</h1>
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
        <div role="tablist" aria-label="Match tools" className="sticky top-0 z-10 flex gap-1 border-b border-line bg-paper px-4 pt-3">
          {(["match", "tailor"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={clsx("-mb-px border-b-2 px-3 pb-2.5 pt-1 text-sm", tab === t ? "border-ink font-medium" : "border-transparent text-ink-3 hover:text-ink")}>
              {t === "match" ? "Match" : "Tailor for this job"}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="px-5 py-5">
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
          <ul className="space-y-2">
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
  const pct = Math.round((r.score.coverage ?? 0) * 100);
  const total = r.score.met + r.score.partial + r.score.missing;
  return (
    <section aria-label="Match summary" className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Requirement coverage</p>
          <p className="mt-1 font-serif text-[44px] font-semibold leading-none">{pct}%</p>
        </div>
        <p className="text-right text-sm text-ink-2">
          <span className="font-medium text-ink">
            {r.score.must_met} of {r.score.must_total}
          </span>{" "}
          required
          <br />
          shown on your resume
        </p>
      </div>
      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-sunk" role="img" aria-label={`${r.score.met} met, ${r.score.partial} partly, ${r.score.missing} not shown`}>
        <span className="bg-ok" style={{ width: `${(r.score.met / total) * 100}%` }} />
        <span className="bg-warn" style={{ width: `${(r.score.partial / total) * 100}%` }} />
      </div>
      <p className="mt-2 flex gap-4 text-xs text-ink-2">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-ok" />
          {r.score.met} met
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-warn" />
          {r.score.partial} partly
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-sunk ring-1 ring-line" />
          {r.score.missing} not shown
        </span>
      </p>
      <p className="mt-3 text-xs text-ink-3">
        Required items count double. This measures what your resume shows against this ad; it isn&apos;t a prediction of an interview or of any ATS ranking.
      </p>
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
    <li className="rounded-lg border border-line bg-surface px-3 py-3">
      <div className="flex items-start gap-2">
        <StatusPill status={a.status} />
        <p className="min-w-0 flex-1 text-sm font-medium">{a.text}</p>
        <KindTag kind={a.kind} />
      </div>
      <p className="mt-1.5 text-sm text-ink-2">{a.explanation}</p>
      {a.downgraded && <p className="mt-1 text-xs text-warn">The AI said this was met, but its quote wasn&apos;t found in your resume, so it&apos;s shown as partly met.</p>}
      {a.evidence.slice(0, 2).map((c, i) => (
        <Quote key={i} c={c} />
      ))}
      {a.suggestion && (
        <div className="mt-2 flex items-start gap-2 rounded-md bg-accent-soft px-2.5 py-2 text-xs text-accent">
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
                  <span key={i} className={clsx(p.type === "added" && "rounded-sm bg-ok-soft text-ok", p.type === "removed" && "text-ink-3 line-through")}>
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
