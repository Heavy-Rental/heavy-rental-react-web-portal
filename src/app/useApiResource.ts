import { useEffect, useState, type DependencyList } from "react";

type AsyncState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function useApiResource<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: DependencyList = []) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading", data: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    fetcher(controller.signal)
      .then((data) => {
        if (!cancelled) setState({ status: "success", data, error: null });
      })
      .catch((err) => {
        // Aborting on cleanup (below) rejects this same promise — not a real
        // failure, so don't surface it as one.
        if (!cancelled && err?.name !== "AbortError") {
          setState({ status: "error", data: null, error: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  return {
    ...state,
    reload: () => {
      // Reset to loading from the triggering event handler (not inside the effect
      // above) so re-fetches show a loading state without re-running on every render.
      setState({ status: "loading", data: null, error: null });
      setReloadKey((k) => k + 1);
    },
  };
}
