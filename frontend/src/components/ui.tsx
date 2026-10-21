"use client";

import clsx from "clsx";
import { Loader2, RefreshCw } from "lucide-react";
import type { AnalysisMeta } from "@/lib/api";

export function MetaLine({ meta, onRefresh, refreshing }: { meta: AnalysisMeta; onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 font-mono text-2xs text-ink-3">
      <span>{meta.model}</span>
      <span>
        {(meta.input_tokens + meta.output_tokens).toLocaleString()} tokens · {(meta.latency_ms / 1000).toFixed(1)} s
      </span>
      {meta.cached && <span title="Saved from an earlier run: no new AI call, no cost.">cached</span>}
      {onRefresh && (
        <button onClick={onRefresh} disabled={refreshing} className="ml-auto inline-flex items-center gap-1 hover:text-ink disabled:opacity-50">
          <RefreshCw className={clsx("h-3 w-3", refreshing && "animate-spin")} aria-hidden /> Regenerate
        </button>
      )}
    </div>
  );
}

export function Working({ text, hint }: { text: string; hint?: string }) {
  return (
    <div aria-live="polite" aria-busy="true" className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-ink-2">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {text}
      </p>
      <div className="space-y-2.5">
        {[100, 92, 97, 60, 88].map((w, i) => (
          <div key={i} className="skeleton h-3.5" style={{ width: `${w}%` }} />
        ))}
      </div>
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-medium underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-baseline justify-between gap-3 first:mt-0">
      <h3 className="eyebrow">{children}</h3>
      {aside}
    </div>
  );
}

export const STATUS = {
  met: { label: "Met", cls: "bg-ok-soft text-ok", bar: "bg-ok", icon: "✓" },
  partial: { label: "Partly", cls: "bg-warn-soft text-warn", bar: "bg-warn", icon: "◐" },
  missing: { label: "Not shown", cls: "bg-sunk text-ink-2", bar: "bg-line", icon: "–" },
} as const;

export function StatusPill({ status }: { status: keyof typeof STATUS }) {
  return (
    <span className={clsx("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-semibold", STATUS[status].cls)}>
      <span aria-hidden>{STATUS[status].icon}</span>
      {STATUS[status].label}
    </span>
  );
}

export function KindTag({ kind }: { kind: "must" | "nice" }) {
  return (
    <span className={clsx("shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium", kind === "must" ? "bg-accent-soft text-accent" : "border border-line text-ink-3")}>
      {kind === "must" ? "Required" : "Nice to have"}
    </span>
  );
}

/**
 * Requirement coverage as a ring. The arc is the coverage figure itself (required items count double, partial
 * evidence half), so the ring and the number in it always agree; counts by status are shown beside it.
 */
export function CoverageRing({ coverage, size = 132, label }: { coverage: number; size?: number; label?: string }) {
  const stroke = size >= 100 ? 12 : 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.round(Math.max(0, Math.min(1, coverage)) * 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ?? `${pct}% requirement coverage`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-sunk" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-accent transition-[stroke-dasharray] duration-700"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
        />
      </svg>
      <span aria-hidden className={clsx("absolute inset-0 grid place-items-center font-display font-bold tracking-tight", size >= 100 ? "text-[34px]" : size >= 70 ? "text-[22px]" : "text-[12px]")}>
        {pct}%
      </span>
    </div>
  );
}

/** A share shown as a bar, labelled for screen readers. */
export function Meter({ value, label, className }: { value: number; label: string; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={clsx("h-2.5 overflow-hidden rounded-full bg-sunk", className)} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${pct}%` }} />
    </div>
  );
}
