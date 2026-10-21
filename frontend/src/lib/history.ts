"use client";

import { useCallback, useRef, useState } from "react";

export type History<T> = { past: T[]; present: T; future: T[] };

const LIMIT = 100;

/** Record a change. With `coalesce`, it replaces the current step instead of adding one (typing in the same field). */
export function record<T>(h: History<T>, next: T, coalesce = false): History<T> {
  return { past: coalesce ? h.past : [...h.past, h.present].slice(-LIMIT), present: next, future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  return h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h;
}

export function redo<T>(h: History<T>): History<T> {
  return h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h;
}

/**
 * Undo/redo over a whole value. Consecutive changes with the same `group` within a second (typing in one field)
 * collapse into one step, so undo goes back a phrase, not a keystroke.
 */
export function useHistory<T>(initial: T) {
  const [h, setH] = useState<History<T>>({ past: [], present: initial, future: [] });
  const last = useRef<{ group: string | null; at: number }>({ group: null, at: 0 });

  const set = useCallback((next: T, group: string | null = null) => {
    const now = Date.now();
    const coalesce = group !== null && last.current.group === group && now - last.current.at < 1000;
    last.current = { group, at: now };
    setH((s) => record(s, next, coalesce));
  }, []);
  const doUndo = useCallback(() => {
    last.current.group = null;
    setH(undo);
  }, []);
  const doRedo = useCallback(() => {
    last.current.group = null;
    setH(redo);
  }, []);
  /** Replace everything (e.g. after loading or saving) without creating an undo step. */
  const reset = useCallback((value: T) => {
    last.current.group = null;
    setH({ past: [], present: value, future: [] });
  }, []);

  return { value: h.present, set, undo: doUndo, redo: doRedo, reset, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}
