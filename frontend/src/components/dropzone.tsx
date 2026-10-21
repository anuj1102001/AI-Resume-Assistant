"use client";

import clsx from "clsx";
import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { ACCEPTED_TYPES, MAX_UPLOAD_MB } from "@/lib/format";

/** Drag-and-drop or click (or Enter/Space) to choose files. Accessible as a button. */
export function Dropzone({ onFiles, compact, busy }: { onFiles: (files: File[]) => void; compact?: boolean; busy?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload documents"
      aria-busy={busy}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          input.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={clsx(
        "group flex cursor-pointer rounded-card border-2 transition-colors",
        compact ? "flex-col items-center justify-center gap-1 border-dashed px-4 py-5 text-center" : "flex-col items-center gap-4 px-5 py-6 text-center sm:flex-row sm:text-left",
        over ? "border-accent bg-accent-soft" : compact ? "border-line bg-surface hover:border-accent/50" : "border-accent/25 bg-surface shadow-card hover:border-accent/60",
      )}
    >
      <span className={clsx("grid shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent", compact ? "h-9 w-9" : "h-12 w-12")}>
        <UploadCloud className={compact ? "h-5 w-5" : "h-6 w-6"} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={clsx("block font-semibold", compact ? "text-sm" : "text-base")}>{over ? "Drop to upload" : compact ? "Add another resume" : "Drop your resume here"}</span>
        <span className="mt-0.5 block text-xs text-ink-3">
          PDF, Word, TXT or Markdown · up to {MAX_UPLOAD_MB} MB · text-based PDFs (scans aren&apos;t supported yet)
        </span>
      </span>
      {!compact && (
        <span aria-hidden className="btn-primary pointer-events-none">
          Choose a file
        </span>
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </div>
  );
}
