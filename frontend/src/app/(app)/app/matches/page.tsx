"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorLine, MatchRow, PageTitle, Panel } from "@/components/workspace-ui";
import { useWorkspace } from "@/lib/workspace";

export default function MatchesPage() {
  const ws = useWorkspace();
  const router = useRouter();
  const { data } = ws;
  const [pick, setPick] = useState({ resume: "", job: "" });
  return (
    <div className="mx-auto max-w-[960px] px-4 pb-24 pt-8 sm:px-8">
      <ErrorLine message={ws.error} />
      <PageTitle title="Job matches" subtitle="Every match checks one resume against one job ad, requirement by requirement, with quotes from both." />
      {data === null && !ws.error ? (
        <div className="mt-6 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-14" />
          ))}
        </div>
      ) : (
        data && (
          <>
            <Panel title="New match" className="mt-6">
              {data.resumes.length && data.jobs.length ? (
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (pick.resume && pick.job) router.push(`/match/${pick.resume}/${pick.job}`);
                  }}
                >
                  <select aria-label="Resume" className="input sm:flex-1" value={pick.resume} onChange={(e) => setPick({ ...pick, resume: e.target.value })}>
                    <option value="">Choose a resume…</option>
                    {data.resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <select aria-label="Job" className="input sm:flex-1" value={pick.job} onChange={(e) => setPick({ ...pick, job: e.target.value })}>
                    <option value="">Choose a job…</option>
                    {data.jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                      </option>
                    ))}
                  </select>
                  <button className="btn-primary h-11" disabled={!pick.resume || !pick.job}>
                    Match <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                </form>
              ) : (
                <p className="text-sm text-ink-2">
                  You need a resume and a job ad.{" "}
                  <Link href={data.resumes.length ? "/jobs/new" : "/app#upload"} className="font-medium text-accent hover:underline">
                    {data.resumes.length ? "Add a job" : "Upload a resume"}
                  </Link>
                </p>
              )}
            </Panel>
            <Panel title={`History · ${data.matches.length}`} className="mt-4">
              {data.matches.length ? (
                <ul className="-mx-2">
                  {data.matches.map((m) => (
                    <MatchRow key={`${m.resume_id}-${m.job_id}`} m={m} resumeName={ws.resumeName(m.resume_id)} jobName={ws.jobName(m.job_id)} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-3">No matches yet.</p>
              )}
              <p className="mt-3 text-xs leading-relaxed text-ink-3">
                Coverage counts required items double and partial evidence half. It measures what a resume shows against an ad, not your chances of an interview or
                any ATS ranking.
              </p>
            </Panel>
          </>
        )
      )}
    </div>
  );
}
