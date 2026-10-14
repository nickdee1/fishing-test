"use client";
import { useCallback, useEffect, useState } from "react";

export type Stat = { r: number; w: number; last: 0 | 1 };
export type Progress = {
  stats: Record<string, Stat>;
  saved: string[];
  shuffleOptions: boolean;
};

const KEY = "rz-progress-v1";
const empty: Progress = { stats: {}, saved: [], shuffleOptions: true };

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode etc.)
  }
}

export function useProgress() {
  const [p, setP] = useState<Progress>(empty);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setP(load(KEY, empty));
    setReady(true);
  }, []);

  const update = useCallback((fn: (p: Progress) => Progress) => {
    setP((prev) => {
      const next = fn(prev);
      save(KEY, next);
      return next;
    });
  }, []);

  const record = useCallback(
    (id: string, ok: boolean) =>
      update((p) => {
        const s = p.stats[id] ?? { r: 0, w: 0, last: 0 };
        return {
          ...p,
          stats: { ...p.stats, [id]: { r: s.r + (ok ? 1 : 0), w: s.w + (ok ? 0 : 1), last: ok ? 1 : 0 } },
        };
      }),
    [update],
  );

  const toggleSaved = useCallback(
    (id: string) =>
      update((p) => ({
        ...p,
        saved: p.saved.includes(id) ? p.saved.filter((x) => x !== id) : [...p.saved, id],
      })),
    [update],
  );

  const reset = useCallback(() => update((p) => ({ ...empty, saved: p.saved, shuffleOptions: p.shuffleOptions })), [update]);

  return { p, ready, update, record, toggleSaved, reset };
}
