"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Citation, ResumeInfo } from "@/lib/api";

/** What the page viewer needs to know about a resume. */
export type ViewerDoc = { id: string; title: string; kind: "pdf" | "docx" | "text"; page_count: number; page_label: "Page" | "Part"; empty_pages: number[] };

export const toViewerDoc = (r: ResumeInfo): ViewerDoc => ({ id: r.id, title: r.label, kind: r.kind, page_count: r.page_count, page_label: r.kind === "pdf" ? "Page" : "Part", empty_pages: [] });

export type Focus = { documentId: string; page: number; quote: string; nonce: number };
/** A job ad shown beside the resume (the assistant page): job-ad citations highlight their quote in it. */
export type ViewerJob = { id: string; title: string; text: string };
export type JobFocus = { quote: string; nonce: number };

type Ctx = {
  docs: Record<string, ViewerDoc>;
  focus: Focus | null;
  show: (c: Citation) => void;
  job: ViewerJob | null;
  jobFocus: JobFocus | null;
  pane: "document" | "insights";
  setPane: (p: "document" | "insights") => void;
};

const DocContext = createContext<Ctx | null>(null);

export function DocProvider({ docs, job = null, children }: { docs: ViewerDoc[]; job?: ViewerJob | null; children: React.ReactNode }) {
  const [focus, setFocus] = useState<Focus | null>(null);
  const [jobFocus, setJobFocus] = useState<JobFocus | null>(null);
  const [pane, setPane] = useState<"document" | "insights">("insights");
  const show = useCallback(
    (c: Citation) => {
      if (c.source === "job") {
        if (job && c.source_id === job.id) setJobFocus({ quote: c.quote, nonce: Date.now() });
        return;
      }
      if (c.source !== "resume" || !c.source_id || !c.page) return;
      setFocus({ documentId: c.source_id, page: c.page, quote: c.quote, nonce: Date.now() });
      setPane("document");
    },
    [job],
  );
  const value = useMemo(() => ({ docs: Object.fromEntries(docs.map((d) => [d.id, d])), focus, show, pane, setPane, job, jobFocus }), [docs, focus, show, pane, job, jobFocus]);
  return <DocContext.Provider value={value}>{children}</DocContext.Provider>;
}

export function useDoc(): Ctx {
  const ctx = useContext(DocContext);
  if (!ctx) throw new Error("useDoc must be used inside DocProvider");
  return ctx;
}
