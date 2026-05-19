import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Abortable sleep that rejects with an AbortError when the signal fires.
 */
export function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort);
  });
}

export interface AbortableToastRunOptions<T> {
  /** Message for the loading toast shown while the task runs. */
  loadingMessage: string;
  /** Message shown when the task resolves successfully. */
  successMessage?: string;
  /** Message shown when the task is aborted via Cancel. */
  cancelledMessage?: string;
  /** Message shown when the task throws a non-abort error. */
  errorMessage?: string;
  /** The actual unit of work — receives an AbortSignal it must respect. */
  task: (signal: AbortSignal) => Promise<T>;
  /** Optional Retry handler attached to cancelled/error toasts. */
  onRetry?: () => void;
  /**
   * "single-flight" (default): if a run is already in flight, the new call is ignored.
   * "replace": aborts the previous run before starting this one.
   */
  mode?: "single-flight" | "replace";
  /** If true, no loading toast is shown (useful for background refreshes). */
  silent?: boolean;
}

/**
 * Shared lifecycle for an async action that:
 *  - shows a sonner loading toast with a Cancel action,
 *  - drives an AbortController and exposes its signal to the task,
 *  - swaps the loading toast for success / cancelled / error toasts,
 *  - dismisses the toast and aborts the task on unmount,
 *  - prevents concurrent runs.
 */
export function useAbortableToastAction() {
  const runningRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const toastIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    };
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const run = useCallback(async <T,>(opts: AbortableToastRunOptions<T>): Promise<T | undefined> => {
    const mode = opts.mode ?? "single-flight";
    if (runningRef.current) {
      if (mode === "single-flight") return undefined;
      controllerRef.current?.abort();
      if (toastIdRef.current) toast.dismiss(toastIdRef.current);
    }
    runningRef.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    const toastId = `abortable-toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    toastIdRef.current = opts.silent ? null : toastId;

    if (!opts.silent) {
      toast.loading(opts.loadingMessage, {
        id: toastId,
        action: { label: "Cancel", onClick: () => controller.abort() },
      });
    }

    const retryAction = opts.onRetry
      ? {
          label: "Retry",
          onClick: () => {
            if (runningRef.current || !mountedRef.current) return;
            toast.dismiss(toastId);
            opts.onRetry?.();
          },
        }
      : undefined;

    try {
      const result = await opts.task(controller.signal);
      if (controller.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (mountedRef.current && !opts.silent) {
        if (opts.successMessage) {
          toast.success(opts.successMessage, { id: toastId });
        } else {
          toast.dismiss(toastId);
        }
      } else {
        toast.dismiss(toastId);
      }
      return result;
    } catch (err) {
      if (!mountedRef.current) {
        toast.dismiss(toastId);
      } else if (err instanceof DOMException && err.name === "AbortError") {
        if (opts.cancelledMessage && !opts.silent) {
          toast.message(opts.cancelledMessage, { id: toastId, action: retryAction });
        } else {
          toast.dismiss(toastId);
        }
      } else {
        console.error("Abortable toast action failed", err);
        if (!opts.silent) {
          toast.error(opts.errorMessage ?? "Something went wrong. Please try again.", {
            id: toastId,
            action: retryAction,
          });
        }
      }
      return undefined;
    } finally {
      runningRef.current = false;
      controllerRef.current = null;
      toastIdRef.current = null;
    }
  }, []);

  return { run, abort };
}
