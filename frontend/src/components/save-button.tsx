"use client";

import clsx from "clsx";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { api, describeError, type NewSaved } from "@/lib/api";

/** Save a recommendation, gap or answer to the workspace's Saved list. */
export function SaveButton({ item, className, label = "Save" }: { item: NewSaved; className?: string; label?: string }) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  return (
    <button
      type="button"
      disabled={state !== "idle"}
      onClick={async () => {
        setState("saving");
        setError(null);
        try {
          await api.save(item);
          setState("saved");
        } catch (e) {
          setError(describeError(e));
          setState("idle");
        }
      }}
      title={error ?? (state === "saved" ? "Saved. Find it under Saved in the sidebar." : "Save for later")}
      aria-label={state === "saved" ? "Saved" : `${label}: ${item.text.slice(0, 60)}`}
      className={clsx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors", state === "saved" ? "text-ok" : "text-ink-3 hover:bg-sunk hover:text-ink", className)}
    >
      {state === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : state === "saved" ? <BookmarkCheck className="h-3.5 w-3.5" aria-hidden /> : <Bookmark className="h-3.5 w-3.5" aria-hidden />}
      {state === "saved" ? "Saved" : label}
      {error && <span className="sr-only">{error}</span>}
    </button>
  );
}
