import { useEffect, useRef, useState } from 'react';

/**
 * Lightweight useState wrapper that mirrors the value into `localStorage`.
 *
 * - Reads once on mount (SSR safe — falls back to initial on missing `window`).
 * - Writes on every change, wrapped in try/catch so quota or private-mode
 *   failures never crash the app.
 * - Keys are namespaced by the caller; no global migrations.
 * - If JSON parse fails (corrupt value, schema drift), the bad entry is
 *   removed and the initial value is used.
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T | (() => T)
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const isInitialRef = useRef(true);

  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
    }
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) {
        return JSON.parse(raw) as T;
      }
    } catch {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* noop */
      }
    }
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  });

  useEffect(() => {
    if (isInitialRef.current) {
      isInitialRef.current = false;
      return;
    }
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* swallow — quota exceeded or storage disabled */
    }
  }, [key, value]);

  return [value, setValue];
}

/** Clear every persisted key written by the app. */
export function clearPersistedState(keys: string[]): void {
  if (typeof window === 'undefined') return;
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  }
}
