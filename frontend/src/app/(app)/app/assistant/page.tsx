"use client";

import clsx from "clsx";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AskPanel } from "@/components/ask";
import { DocProvider, toViewerDoc, useDoc } from "@/components/doc-context";
import { JobViewer } from "@/components/job-viewer";
import { PageViewer } from "@/components/page-viewer";
import { ErrorBox } from "@/components/ui";
import { api, describeError, type JobFull, type JobInfo, type ResumeFull, type ResumeInfo } from "@/lib/api";

export default function AssistantPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Assistant />
    </Suspense>
  );
}

function Spinner() {
  return (
    <div className="grid place-items-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-ink-3" aria-label="Loading" />
    </div>
  );
}

/** The career assistant: grounded Q&A over one resume and, optionally, one job ad, with both documents beside it. */
function Assistant() {
  const search = useSearchParams();
  const router = useRouter();
  const [list, setList] = useState<{ resumes: ResumeInfo[]; jobs: JobInfo[] } | null>(null);
  const [resume, setResume] = useState<ResumeFull | null>(null);
  const [job, setJob] = useState<JobFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rid = search.get("resume") ?? list?.resumes[0]?.id ?? null;
  const jid = search.get("job");

  useEffect(() => {
    api.overview().then((o) => setList({ resumes: o.resumes, jobs: o.jobs }), (e) => setError(describeError(e)));
  }, []);
  useEffect(() => {
    if (!rid) return;
    setResume(null);
    api.resume(rid).then(setResume, (e) => setError(describeError(e)));
  }, [rid]);
  useEffect(() => {
    if (!jid) return setJob(null);
    api.job(jid).then(setJob, (e) => setError(describeError(e)));
  }, [jid]);

  const go = (r: string | null, j: string | null) => router.replace(`/app/assistant?${new URLSearchParams({ ...(r ? { resume: r } : {}), ...(j ? { job: j } : {}) })}`);

  if (error)
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <ErrorBox message={error} />
      </div>
    );
  if (!list) return <Spinner />;
  if (!list.resumes.length)
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold">The assistant needs a resume</h1>
        <p className="mt-2 text-sm text-ink-2">It answers only from your documents, so upload a resume first. Add a job ad too, to ask about your fit for a role.</p>
        <Link href="/app#upload" className="btn-primary mt-6">
          Upload a resume
        </Link>
      </div>
    );

  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col">
      <div className="flex flex-wrap items-end gap-3 border-b border-line px-4 pb-3 pt-4 sm:px-6">
        <div className="mr-auto">
          <p className="eyebrow">AI career assistant</p>
          <h1 className="font-display text-[22px] font-bold leading-tight tracking-[-0.02em]">Ask about your experience</h1>
        </div>
        <label className="text-xs text-ink-2">
          <span className="mb-1 block">Resume</span>
          <select className="input h-9 w-48 py-0 text-xs" value={rid ?? ""} onChange={(e) => go(e.target.value, jid)}>
            {list.resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-2">
          <span className="mb-1 block">Job ad (optional)</span>
          <select className="input h-9 w-52 py-0 text-xs" value={jid ?? ""} onChange={(e) => go(rid, e.target.value || null)}>
            <option value="">None: resume only</option>
            {list.jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!resume || (jid && !job) ? (
        <Spinner />
      ) : (
        <DocProvider key={`${resume.id}-${job?.id ?? ""}`} docs={[toViewerDoc(resume)]} job={job ? { id: job.id, title: job.title, text: job.text } : null}>
          <Panels resume={resume} job={job} />
        </DocProvider>
      )}
    </div>
  );
}

function Panels({ resume, job }: { resume: ResumeFull; job: JobFull | null }) {
  const { focus, jobFocus } = useDoc();
  const [doc, setDoc] = useState<"resume" | "job">("resume");
  const [mobile, setMobile] = useState<"docs" | "chat">("chat");
  // A citation click shows its document: resume quotes on the page, job-ad quotes in the ad.
  useEffect(() => {
    if (focus) {
      setDoc("resume");
      setMobile("docs");
    }
  }, [focus]);
  useEffect(() => {
    if (jobFocus) {
      setDoc("job");
      setMobile("docs");
    }
  }, [jobFocus]);

  return (
    <>
      <div className="mx-3 my-2 flex rounded-lg bg-sunk p-1 lg:hidden" role="tablist" aria-label="Panel">
        {(["chat", "docs"] as const).map((p) => (
          <button key={p} role="tab" aria-selected={mobile === p} onClick={() => setMobile(p)} className={clsx("flex-1 rounded-md py-1.5 text-sm", mobile === p ? "bg-surface font-medium shadow-card" : "text-ink-3")}>
            {p === "chat" ? "Conversation" : "Documents"}
          </button>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
        <section aria-label="Documents" className={clsx("min-h-0 flex-col bg-sunk/70", mobile === "docs" ? "flex" : "hidden lg:flex")}>
          {job && (
            <div className="flex gap-1 border-b border-line bg-surface px-3 py-2" role="tablist" aria-label="Document">
              {(["resume", "job"] as const).map((d) => (
                <button key={d} role="tab" aria-selected={doc === d} onClick={() => setDoc(d)} className={clsx("rounded-md px-3 py-1 text-sm", doc === d ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:text-ink")}>
                  {d === "resume" ? resume.label : "Job ad"}
                </button>
              ))}
            </div>
          )}
          <div data-scroll-root className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6">
            <div className="mx-auto max-w-[680px]">{doc === "job" && job ? <JobViewer /> : <PageViewer doc={toViewerDoc(resume)} />}</div>
          </div>
        </section>
        <section aria-label="Conversation" className={clsx("min-h-0 overflow-y-auto border-line bg-surface px-4 pt-4 lg:border-l", mobile === "chat" ? "block" : "hidden lg:block")}>
          <AskPanel resumeId={resume.id} jobId={job?.id ?? null} jobTitle={job?.title} />
        </section>
      </div>
    </>
  );
}
