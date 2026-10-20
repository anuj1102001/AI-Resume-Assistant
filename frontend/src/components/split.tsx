"use client";

import clsx from "clsx";
import { useDoc, type ViewerDoc } from "./doc-context";
import { PageViewer } from "./page-viewer";

/** Resume on the left, analysis on the right; on phones, a toggle between the two. */
export function Split({ doc, header, children }: { doc: ViewerDoc; header: React.ReactNode; children: React.ReactNode }) {
  const { pane, setPane } = useDoc();
  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col">
      {header}
      <div className="flex border-b border-line lg:hidden" role="tablist" aria-label="View">
        {(["document", "insights"] as const).map((p) => (
          <button key={p} role="tab" aria-selected={pane === p} onClick={() => setPane(p)} className={clsx("flex-1 py-2.5 text-sm", pane === p ? "border-b-2 border-ink font-medium" : "text-ink-3")}>
            {p === "document" ? "Resume" : "Insights"}
          </button>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
        <section aria-label="Resume" data-scroll-root className={clsx("min-h-0 overflow-y-auto bg-sunk/60 px-3 py-6 sm:px-8", pane === "insights" && "hidden lg:block")}>
          <div className="mx-auto max-w-[720px]">
            <PageViewer doc={doc} />
          </div>
        </section>
        <section aria-label="Insights" className={clsx("min-h-0 overflow-y-auto border-l border-line bg-paper", pane === "document" && "hidden lg:block")}>
          {children}
        </section>
      </div>
    </div>
  );
}
