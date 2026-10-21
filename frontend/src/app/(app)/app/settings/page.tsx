"use client";

import clsx from "clsx";
import { Download, Laptop, Loader2, Moon, Sun, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorLine, PageTitle, Panel } from "@/components/workspace-ui";
import { api, describeError, type Health, type WorkspaceSummary } from "@/lib/api";
import { download } from "@/lib/download";

type Theme = "system" | "light" | "dark";
const THEME_KEY = "shortlist.theme";

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (t !== "system") root.classList.add(t);
  try {
    if (t === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
}

export default function SettingsPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("system");
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
    api.workspace().then(setSummary, (e) => setError(describeError(e)));
    api.health().then(setHealth, () => {});
  }, []);

  return (
    <div className="mx-auto max-w-[760px] space-y-4 px-4 pb-24 pt-8 sm:px-8">
      <ErrorLine message={error} />
      <PageTitle title="Settings" subtitle="Appearance, your data, and how the AI is used." />

      <Panel title="Appearance" className="mt-6">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
          {(
            [
              ["system", Laptop, "System"],
              ["light", Sun, "Light"],
              ["dark", Moon, "Dark"],
            ] as const
          ).map(([t, Icon, label]) => (
            <button
              key={t}
              role="radio"
              aria-checked={theme === t}
              onClick={() => {
                setTheme(t);
                applyTheme(t);
              }}
              className={clsx("flex flex-col items-center gap-1.5 rounded-tile border px-3 py-3 text-sm transition-colors", theme === t ? "border-accent bg-accent-soft font-medium text-accent" : "border-line hover:border-ink-3")}
            >
              <Icon className="h-5 w-5" aria-hidden /> {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">Saved in this browser only.</p>
      </Panel>

      <Panel title="Your workspace">
        {summary ? (
          <>
            <p className="text-sm text-ink-2">
              A private workspace tied to this browser, created {summary.created_at ? new Date(summary.created_at * 1000).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "recently"}.
              There&apos;s no account: if you clear this site&apos;s data, the workspace can&apos;t be recovered.
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["Resumes", summary.resumes],
                  ["Job ads", summary.jobs],
                  ["AI results", summary.analyses],
                  ["Saved", summary.saved],
                ] as const
              ).map(([l, n]) => (
                <div key={l} className="rounded-tile border border-line bg-paper px-3 py-2.5">
                  <dd className="font-display text-xl font-bold">{n}</dd>
                  <dt className="text-2xs text-ink-3">{l}</dt>
                </div>
              ))}
            </dl>
          </>
        ) : (
          !error && <div className="skeleton h-24" />
        )}
        <button
          className="btn-secondary mt-4"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            setError(null);
            try {
              const data = await api.exportWorkspace();
              download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `shortlist-workspace-${new Date().toISOString().slice(0, 10)}.json`);
            } catch (e) {
              setError(describeError(e));
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />} Export my data (JSON)
        </button>
        <p className="mt-2 text-xs text-ink-3">Everything stored for this workspace: parsed resumes and their text, job ads, AI results, edits and saved items. Original files aren&apos;t included.</p>
      </Panel>

      <Panel title="AI and privacy">
        <ul className="space-y-2 text-sm leading-relaxed text-ink-2">
          <li>
            Language model: <span className="font-mono text-xs text-ink">{health?.model ?? "…"}</span> (Google Gemini).{" "}
            {health && !health.ai_configured && "AI features are switched off on this server."}
          </li>
          <li>Readability checks, parsing and keyword matching run without AI and send nothing anywhere.</li>
          <li>AI features send the resume and job ad you&apos;re working on to Gemini. This demo uses the free tier, whose terms allow Google to use submitted content to improve its services.</li>
          <li>Profiles, matches and rewrites are cached, so repeating one doesn&apos;t send your resume again. Each assistant question is a new request.</li>
        </ul>
      </Panel>

      <section aria-label="Delete everything" className="card border-bad/30 p-5">
        <h2 className="text-[15px] font-semibold text-bad">Delete everything</h2>
        <p className="mt-1 text-sm text-ink-2">Removes every resume and its file, job ad, AI result, edit and saved item from the server, and starts a new empty workspace. This can&apos;t be undone.</p>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (confirmText.trim().toLowerCase() !== "delete") return;
            setDeleting(true);
            setError(null);
            try {
              await api.deleteWorkspace();
              router.push("/app");
            } catch (err) {
              setError(describeError(err));
              setDeleting(false);
            }
          }}
        >
          <label htmlFor="confirm-delete" className="sr-only">
            Type delete to confirm
          </label>
          <input id="confirm-delete" className="input sm:max-w-xs" placeholder='Type "delete" to confirm' value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          <button className="btn h-11 bg-bad text-surface hover:bg-bad/90" disabled={confirmText.trim().toLowerCase() !== "delete" || deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />} Delete everything
          </button>
        </form>
      </section>
    </div>
  );
}
