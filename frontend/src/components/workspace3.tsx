"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { useDoc, type ViewerDoc } from "./doc-context";
import { PageViewer } from "./page-viewer";

export type Pane = "document" | "analysis" | "assistant";

/**
 * The resume workspace: resume | analysis | assistant.
 * xl: all three side by side. lg: the resume stays, analysis and assistant share the second column.
 * Below lg: one panel at a time with a switch. Citation clicks (useDoc().show) bring the resume into view.
 */
export function Workspace3({
  doc,
  header,
  nav,
  analysis,
  assistant,
  pane,
  setPane,
}: {
  doc: ViewerDoc;
  header: React.ReactNode;
  nav?: React.ReactNode;
  analysis: React.ReactNode;
  assistant: React.ReactNode;
  pane: Pane;
  setPane: (p: Pane) => void;
}) {
  const ctx = useDoc();
  // A citation click sets the shared pane to "document"; mirror it here so phones switch to the resume.
  useEffect(() => {
    if (ctx.pane === "document") setPane("document");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.pane, ctx.focus?.nonce]);
  const choose = (p: Pane) => {
    setPane(p);
    ctx.setPane(p === "document" ? "document" : "insights");
  };
  // On lg the second column keeps showing whichever of analysis/assistant was chosen last, even while a citation
  // click brings the resume into focus (on lg the resume is always visible anyway).
  const [second, setSecond] = useState<Pane>("analysis");
  useEffect(() => {
    if (pane !== "document") setSecond(pane);
  }, [pane]);

  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col">
      {header}
      {/* Phones: one panel at a time. Laptops (lg): the resume stays, so only analysis/assistant switch. xl: no switch. */}
      <PaneSwitch className="mx-3 mb-2 lg:hidden" panes={["document", "analysis", "assistant"]} active={pane} onChoose={choose} />
      <PaneSwitch className="mx-3 mb-2 ml-auto hidden w-72 lg:flex xl:hidden" panes={["analysis", "assistant"]} active={second} onChoose={choose} />
      <div className="grid min-h-0 flex-1 border-t border-line lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(340px,400px)]">
        <section aria-label="Resume" className={clsx("flex min-h-0 flex-col bg-sunk/70", pane !== "document" && "hidden lg:flex")}>
          {nav}
          <div data-scroll-root className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6">
            <div className="mx-auto max-w-[640px]">
              <PageViewer doc={doc} />
            </div>
          </div>
        </section>
        <section aria-label="Analysis" className={clsx("min-h-0 overflow-y-auto border-line bg-paper lg:border-l", pane !== "analysis" && "hidden", second === "analysis" ? "lg:block" : "lg:hidden", "xl:block")}>
          {analysis}
        </section>
        <section
          aria-label="Assistant"
          className={clsx("flex min-h-0 flex-col border-line bg-surface lg:border-l", pane !== "assistant" && "hidden", second === "assistant" ? "lg:flex" : "lg:hidden", "xl:flex")}
        >
          {assistant}
        </section>
      </div>
    </div>
  );
}

function PaneSwitch({ panes, active, onChoose, className }: { panes: Pane[]; active: Pane; onChoose: (p: Pane) => void; className?: string }) {
  return (
    <div className={clsx("flex rounded-lg bg-sunk p-1", className)} role="tablist" aria-label="Panel">
      {panes.map((p) => (
        <button key={p} role="tab" aria-selected={active === p} onClick={() => onChoose(p)} className={clsx("flex-1 rounded-md py-1.5 text-sm", active === p ? "bg-surface font-medium shadow-card" : "text-ink-3")}>
          {p === "document" ? "Resume" : p === "analysis" ? "Analysis" : "Assistant"}
        </button>
      ))}
    </div>
  );
}
