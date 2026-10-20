"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, describeError } from "@/lib/api";

export default function NewJobPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const job = await api.createJob(text, title.trim() || undefined, company.trim() || undefined);
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-10 sm:px-6">
      <h1 className="font-serif text-[30px] font-semibold tracking-tight">Add a job</h1>
      <p className="mt-1 text-sm text-ink-2">Paste the whole job description. Shortlist lists its requirements, then checks your resume against each one.</p>
      <form onSubmit={submit} className="card mt-6 space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">Job title (optional)</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="We'll use the first line if blank" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">Company (optional)</span>
            <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">Job description</span>
          <textarea className="input h-auto min-h-[320px] py-2.5 font-mono text-[13px] leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} maxLength={20000} required />
          <span className="mt-1 block text-right font-mono text-2xs text-ink-3">{text.length.toLocaleString()} / 20,000</span>
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}
        <button className="btn-primary" disabled={busy || text.trim().length < 150}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Save job
        </button>
        {text.trim().length > 0 && text.trim().length < 150 && <p className="text-xs text-ink-3">Paste the full description: a few lines at least, so requirements can be found.</p>}
      </form>
    </div>
  );
}
