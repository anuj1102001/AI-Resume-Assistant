"use client";

import clsx from "clsx";
import { useDoc, type ViewerDoc } from "./doc-context";
import { PageViewer } from "./page-viewer";

/**
 * The resume and the analysis side by side; on phones, a toggle between the two.
 * `evidenceSide` puts the analysis first and the resume on the right, as supporting evidence (the match report);
 * otherwise the resume leads (the resume workspace).
 */
export function Split({ doc, header, children, evidenceSide = false }: { doc: ViewerDoc; header: React.ReactNode; children: React.ReactNode; evidenceSide?: boolean }) {
  const { pane, setPane } = useDoc();
  const resume = (
    <section
      key="resume"
      aria-label="Resume"
      data-scroll-root
      className={clsx("min-h-0 overflow-y-auto bg-sunk/70 px-3 py-6 sm:px-6", evidenceSide && "lg:rounded-tl-card lg:border-l lg:border-t lg:border-line", pane === "insights" && "hidden lg:block")}
    >
      <div className={clsx("mx-auto", evidenceSide ? "max-w-[600px]" : "max-w-[720px]")}>
        <PageViewer doc={doc} />
      </div>
    </section>
  );
  const insights = (
    <section key="insights" aria-label="Insights" className={clsx("min-h-0 overflow-y-auto bg-paper", !evidenceSide && "border-l border-line", pane === "document" && "hidden lg:block")}>
      {children}
    </section>
  );
  return (
    <div className="flex h-[calc(100dvh-68px)] flex-col">
      {header}
      <div className="mx-3 mb-1 flex rounded-full bg-sunk p-1 lg:hidden" role="tablist" aria-label="View">
        {(evidenceSide ? (["insights", "document"] as const) : (["document", "insights"] as const)).map((p) => (
          <button key={p} role="tab" aria-selected={pane === p} onClick={() => setPane(p)} className={clsx("flex-1 rounded-full py-2 text-sm", pane === p ? "bg-surface font-medium shadow-card" : "text-ink-3")}>
            {p === "document" ? "Resume" : evidenceSide ? "Report" : "Insights"}
          </button>
        ))}
      </div>
      <div className={clsx("grid min-h-0 flex-1", evidenceSide ? "lg:grid-cols-[minmax(0,1fr)_minmax(380px,46%)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]")}>
        {evidenceSide ? [insights, resume] : [resume, insights]}
      </div>
    </div>
  );
}
