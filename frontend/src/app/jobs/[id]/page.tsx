"use client";

import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DocProvider } from "@/components/doc-context";
import { CitationChip, GroundingNote } from "@/components/claim";
import { ErrorBox, KindTag, SectionTitle, Working } from "@/components/ui";
import { api, describeError, type JobFull, type Requirements, type ResumeInfo } from "@/lib/api";

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobFull | null>(null);
  const [reqs, setReqs] = useState<Requirements | null>(null);
  const [resumes, setResumes] = useState<ResumeInfo[]>([]);
  const [resumeId, setResumeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reqError, setReqError] = useState<string | null>(null);

  useEffect(() => {
    api.job(id).then(
      (j) => {
        setJob(j);
        if (j.requirements) setReqs(j.requirements);
        else api.requirements(id).then(setReqs, (e) => setReqError(describeError(e)));
      },
      (e) => setError(describeError(e)),
    );
    api.overview().then((o) => {
      setResumes(o.resumes);
      if (o.resumes.length === 1) setResumeId(o.resumes[0].id);
    }, () => {});
  }, [id]);

  if (error) return <div className="mx-auto max-w-lg px-4 py-20"><ErrorBox message={error} /></div>;
  if (!job) return <div className="mx-auto max-w-2xl px-4 py-10"><Working text="Opening job…" /></div>;

  const must = reqs?.requirements.filter((r) => r.kind === "must") ?? [];
  const nice = reqs?.requirements.filter((r) => r.kind === "nice") ?? [];

  return (
    <DocProvider docs={[]}>
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6">
        <Link href="/" className="btn-ghost -ml-2 h-8 px-2 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Dashboard
        </Link>
        <h1 className="mt-2 font-display text-[34px] font-bold leading-tight tracking-[-0.03em]">{job.title}</h1>
        {job.company && <p className="text-sm text-ink-2">{job.company}</p>}

        <form
          className="card mt-6 flex flex-col gap-2 p-4 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (resumeId) router.push(`/match/${resumeId}/${job.id}`);
          }}
        >
          <label className="block flex-1">
            <span className="mb-1 block text-xs font-medium text-ink-2">Match against</span>
            <select className="input" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
              <option value="">{resumes.length ? "Choose a resume…" : "Upload a resume first (on the dashboard)"}</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary" disabled={!resumeId}>
            Match <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </form>

        <SectionTitle>Requirements</SectionTitle>
        {reqError ? (
          <ErrorBox message={reqError} onRetry={() => (setReqError(null), api.requirements(id).then(setReqs, (e) => setReqError(describeError(e))))} />
        ) : !reqs ? (
          <Working text="Reading the job description…" />
        ) : (
          <div className="animate-rise space-y-6">
            <GroundingNote g={reqs.grounding} subject="the job description" />
            {[
              ["Required", must],
              ["Nice to have", nice],
            ].map(([label, list]) => (
              <div key={label as string}>
                <p className="mb-2 text-sm font-medium">
                  {label as string} <span className="text-ink-3">· {(list as Requirements["requirements"]).length}</span>
                </p>
                <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                  {(list as Requirements["requirements"]).map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <span className="text-sm">{r.text}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <KindTag kind={r.kind} />
                        {r.citations[0] && <CitationChip c={r.citations[0]} />}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <details className="group mt-8 rounded-lg border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            Full job description
            <ChevronDown className="h-4 w-4 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <pre className="whitespace-pre-wrap border-t border-line px-4 py-3 font-sans text-sm leading-relaxed text-ink-2">{job.text}</pre>
        </details>
      </div>
    </DocProvider>
  );
}
