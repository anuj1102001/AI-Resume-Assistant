/** Typed client for the Shortlist API. A private workspace is created on first visit; its token lives in this browser. */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
const TOKEN_KEY = "shortlist.workspace";

export type Support = "verified" | "approximate" | "unverified";
export type Citation = { quote: string; status: Support; source: "resume" | "job"; source_id: string | null; section: string | null; page: number | null };
export type Claim = { text: string; kind: "stated" | "inferred"; citations: Citation[]; support: Support };
export type Grounding = { claims: number; verified?: number; approximate?: number; unverified?: number; stated_unverified?: number; grounded_rate: number | null };

export type CheckStatus = "pass" | "warn" | "fail" | "info";
export type Check = { id: string; title: string; status: CheckStatus; found: string; why: string; fix: string | null; evidence: { text: string; page: number | null }[] };

export type Bullet = { id: string; section: string; text: string; page: number; entry: number | null };
export type Entry = { section: string; header: string; start: string | null; end: string | null; months: number | null; bullets: string[] };
export type Parsed = {
  name: string | null;
  contact: Record<"email" | "phone" | "linkedin" | "github", string | null>;
  sections: { key: string; title: string; text: string; page: number }[];
  bullets: Bullet[];
  entries: Entry[];
  skills_listed: string[];
  experience_months: number | null;
};

export type ResumeInfo = {
  id: string;
  label: string;
  filename: string;
  kind: "pdf" | "docx" | "text";
  size_bytes: number;
  page_count: number;
  name: string | null;
  experience_years: number | null;
  check_counts: Record<CheckStatus, number>;
  created_at: number;
};
export type ResumeFull = ResumeInfo & { parsed: Parsed; checks: Check[]; layout: { pages: number; multi_column_pages: number[]; tables: number; images: number } };

export type JobInfo = { id: string; title: string; company: string | null; created_at: number; has_requirements: boolean };
export type Requirement = { id: string; text: string; kind: "must" | "nice"; category: string; citations: Citation[]; support: Support };
export type Requirements = { title: string; company: string | null; seniority: string | null; requirements: Requirement[]; grounding: Grounding };
export type JobFull = JobInfo & { text: string; requirements: Requirements | null };

export type AnalysisMeta = { model: string; prompt_version: string; input_tokens: number; output_tokens: number; latency_ms: number; cached: boolean; created_at: number };
export type Analysis<T> = { id: string; kind: string; resume_id: string | null; job_id: string | null; input: unknown; result: T; meta: AnalysisMeta };

export type Profile = {
  headline: string;
  summary: Claim[];
  skills: { name: string; category: string; strength: "demonstrated" | "listed"; citations: Citation[]; support: Support }[];
  achievements: { text: string; has_metric: boolean; citations: Citation[]; support: Support }[];
  improvement_areas: Claim[];
  grounding: Grounding;
};

export type Assessment = {
  requirement: string;
  status: "met" | "partial" | "missing";
  explanation: string;
  evidence: Citation[];
  suggestion: string | null;
  support?: Support;
  downgraded?: boolean;
  text: string;
  kind: "must" | "nice";
  category: string;
  job_citations: Citation[];
};
export type Keywords = {
  job_skills: number;
  matched: { skill: string; mentions_in_resume: number }[];
  missing: string[];
  coverage: number | null;
  years_required: number | null;
  years_estimated: number | null;
  note: string;
};
export type MatchResult = {
  score: { coverage: number | null; met: number; partial: number; missing: number; must_met: number; must_total: number };
  assessments: Assessment[];
  summary: Claim[];
  keywords: Keywords;
  grounding: Grounding;
  passages_used: number;
};
export type MatchSummary = { resume_id: string; job_id: string; score: MatchResult["score"]; created_at: number };

export type VariantChecks = { new_numbers: string[]; new_skills: string[]; placeholders: string[]; words: number };
export type Rewrite = { bullet_id: string; original: string; variants: { text: string; rationale: string; checks: VariantChecks }[]; questions: string[] };
export type Tailored = { resume_id: string; job_id: string | null; changed: number; bullets: { id: string; section: string; original: string; revised: string | null }[] };

export type Answer = {
  status: "answered" | "partial" | "not_found";
  answer: Claim[];
  follow_ups: string[];
  retrieval: { label: string; section: string; page: number; dense_rank: number | null; sparse_rank: number | null }[];
  grounding: Grounding;
};

export type Health = { status: string; ai_configured: boolean; model: string | null; embedding_model: string };

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function describeError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof TypeError) return "Can't reach the Shortlist server. Check your connection, or the server may be waking up (try again in ~30 seconds).";
  return "Something went wrong. Please try again.";
}

let tokenPromise: Promise<string> | null = null;

async function token(): Promise<string> {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) return t;
  } catch {}
  tokenPromise ??= (async () => {
    const r = await fetch(`${API_URL}/api/workspaces`, { method: "POST" });
    if (!r.ok) throw new ApiError("WORKSPACE", "Couldn't create a workspace. Please refresh the page.", r.status);
    const { token } = (await r.json()) as { token: string };
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
    return token;
  })();
  return tokenPromise;
}

function resetWorkspace() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
  tokenPromise = null;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await token()}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const r = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (r.status === 401 && retry) {
    resetWorkspace();
    return request<T>(path, init, false);
  }
  if (r.status === 204) return undefined as T;
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(body?.error?.code ?? `HTTP_${r.status}`, body?.error?.message ?? `Request failed (${r.status}).`, r.status);
  return body as T;
}

const post = (data: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(data) });

async function authedBlob(path: string): Promise<Blob> {
  const r = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${await token()}` } });
  if (!r.ok) throw new ApiError("FILE", "Couldn't load the file.", r.status);
  return r.blob();
}

export const api = {
  health: () => fetch(`${API_URL}/api/health`).then((r) => r.json() as Promise<Health>),
  overview: () => request<{ resumes: ResumeInfo[]; jobs: JobInfo[]; matches: MatchSummary[] }>("/api/overview"),

  uploadResume: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ resume: ResumeInfo; duplicate: boolean }>("/api/resumes", { method: "POST", body: fd });
  },
  resume: (id: string) => request<{ resume: ResumeFull }>(`/api/resumes/${id}`).then((r) => r.resume),
  renameResume: (id: string, label: string) => request<{ resume: ResumeInfo }>(`/api/resumes/${id}/rename`, post({ label })),
  deleteResume: (id: string) => request<void>(`/api/resumes/${id}`, { method: "DELETE" }),
  pageImage: async (id: string, page: number) => URL.createObjectURL(await authedBlob(`/api/resumes/${id}/pages/${page}/image`)),
  pageText: (id: string, page: number) => request<{ page: number; text: string }>(`/api/resumes/${id}/pages/${page}`),
  locate: (id: string, page: number, q: string) =>
    request<{ rects: [number, number, number, number][] }>(`/api/resumes/${id}/pages/${page}/locate?q=${encodeURIComponent(q.slice(0, 600))}`).then((r) => r.rects),
  profile: (id: string, refresh = false) => request<Analysis<Profile>>(`/api/resumes/${id}/profile`, post({ refresh })),
  ask: (id: string, question: string, history: [string, string][]) => request<Analysis<Answer>>(`/api/resumes/${id}/ask`, post({ question, history })),
  questions: (id: string) => request<{ analyses: Analysis<Answer>[] }>(`/api/resumes/${id}/questions`).then((r) => r.analyses),
  rewrite: (id: string, bullet_id: string, job_id: string | null, refresh = false) => request<Analysis<Rewrite>>(`/api/resumes/${id}/rewrite`, post({ bullet_id, job_id, refresh })),
  saveTailored: (id: string, bullet_id: string, job_id: string | null, revised: string) =>
    request<{ revised: string; checks: VariantChecks }>(`/api/resumes/${id}/tailored`, post({ bullet_id, job_id, revised })),
  tailored: (id: string, job_id: string | null) => request<Tailored>(`/api/resumes/${id}/tailored${job_id ? `?job_id=${job_id}` : ""}`),
  exportDocx: async (id: string, job_id: string | null) => authedBlob(`/api/resumes/${id}/export${job_id ? `?job_id=${job_id}` : ""}`),

  createJob: (text: string, title?: string, company?: string) => request<{ job: JobInfo }>("/api/jobs", post({ text, title: title || null, company: company || null })).then((r) => r.job),
  job: (id: string) => request<{ job: JobFull }>(`/api/jobs/${id}`).then((r) => r.job),
  deleteJob: (id: string) => request<void>(`/api/jobs/${id}`, { method: "DELETE" }),
  requirements: (id: string, refresh = false) => request<{ requirements: Requirements; cached: boolean }>(`/api/jobs/${id}/requirements`, post({ refresh })).then((r) => r.requirements),

  match: (resume_id: string, job_id: string, refresh = false) => request<Analysis<MatchResult>>("/api/match", post({ resume_id, job_id, refresh })),
  keywords: (resume_id: string, job_id: string) => request<Keywords>(`/api/keywords?resume_id=${resume_id}&job_id=${job_id}`),
};
