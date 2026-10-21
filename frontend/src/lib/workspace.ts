"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, describeError, type JobInfo, type MatchSummary, type ResumeInfo } from "./api";
import { checkFile } from "./format";

export type Overview = { resumes: ResumeInfo[]; jobs: JobInfo[]; matches: MatchSummary[] };
/** A resume upload in flight: bytes sent (real progress), then the server reading it (no fake percentage). */
export type UploadState = { name: string; sent: number; stage: "uploading" | "reading" };

export const SAMPLES = [
  { resume: "priya.pdf", job: "backend-engineer.txt", title: "Backend engineer", who: "Priya, 5 years in payments", jobTitle: "Senior Backend Engineer" },
  { resume: "arjun.pdf", job: "product-designer.txt", title: "Product designer", who: "Arjun, 6 years in health and fintech", jobTitle: "Product Designer (Healthcare)" },
];

/** The workspace overview plus the actions every workspace page shares: upload, try a sample, delete. */
export function useWorkspace() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState<UploadState | null>(null);

  const refresh = useCallback(() => api.overview().then(setData, (e) => setError(describeError(e))), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function upload(files: File[]) {
    const f = files[0];
    const problem = checkFile(f);
    if (problem) return setError(problem);
    setError(null);
    setUploading({ name: f.name, sent: 0, stage: "uploading" });
    try {
      const r = await api.uploadResumeWithProgress(f, (sent) => setUploading({ name: f.name, sent, stage: sent >= 1 ? "reading" : "uploading" }));
      router.push(r.duplicate ? `/resume/${r.resume.id}` : `/resume/${r.resume.id}/extracted`);
    } catch (e) {
      setError(describeError(e));
      setUploading(null);
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

  const resumeName = (id: string) => data?.resumes.find((r) => r.id === id)?.label ?? "Resume";
  const jobName = (id: string) => data?.jobs.find((j) => j.id === id)?.title ?? "Job";

  return { data, error, setError, busy, uploading, refresh, upload, trySample, remove, resumeName, jobName };
}
