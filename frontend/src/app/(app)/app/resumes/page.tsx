"use client";

import { Dropzone } from "@/components/dropzone";
import { BusyOverlay, ErrorLine, UploadProgress, JobRow, PageTitle, Panel, ResumeRow } from "@/components/workspace-ui";
import { useWorkspace } from "@/lib/workspace";

export default function ResumesPage() {
  const ws = useWorkspace();
  const { data } = ws;
  return (
    <div className="mx-auto max-w-[960px] px-4 pb-24 pt-8 sm:px-8">
      <BusyOverlay text={ws.busy} />
      <UploadProgress state={ws.uploading} />
      <ErrorLine message={ws.error} />
      <PageTitle title="My resumes" subtitle="Each resume keeps its checks, profile, rewrites and tailored versions. Deleting one removes all of them." />
      <div id="upload" className="mt-6 scroll-mt-24">
        <Dropzone onFiles={ws.upload} compact />
      </div>
      {data === null && !ws.error ? (
        <div className="mt-6 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-14" />
          ))}
        </div>
      ) : (
        data && (
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Panel title={`Resumes · ${data.resumes.length}`}>
              {data.resumes.length ? (
                <ul className="-mx-2">
                  {data.resumes.map((r) => (
                    <ResumeRow key={r.id} r={r} onDelete={() => ws.remove("resume", r.id, r.label)} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-3">No resumes yet. Upload one above.</p>
              )}
            </Panel>
            <Panel title={`Job ads · ${data.jobs.length}`}>
              {data.jobs.length ? (
                <ul className="-mx-2">
                  {data.jobs.map((j) => (
                    <JobRow key={j.id} j={j} onDelete={() => ws.remove("job", j.id, j.title)} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-3">No job ads yet.</p>
              )}
            </Panel>
          </div>
        )
      )}
    </div>
  );
}
