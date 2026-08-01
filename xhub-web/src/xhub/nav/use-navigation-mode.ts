"use client";

import { useCallback, useMemo, useState } from "react";
import type { NavigationMode } from "./types";

interface UseNavigationModeOptions {
  initialSavedMode: NavigationMode;
  forcedResponsiveMode?: NavigationMode;
  persist: (mode: NavigationMode) => Promise<void>;
}

export function useNavigationMode(options: UseNavigationModeOptions) {
  const [savedMode, setSavedMode] = useState(options.initialSavedMode);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveMode = options.forcedResponsiveMode ?? savedMode;

  const updateMode = useCallback(async (nextMode: NavigationMode) => {
    const previousMode = savedMode;
    setSavedMode(nextMode);
    setPending(true);
    setError(null);

    try {
      await options.persist(nextMode);
    } catch (cause) {
      setSavedMode(previousMode);
      setError(cause instanceof Error ? cause.message : "Không thể lưu kiểu điều hướng.");
      throw cause;
    } finally {
      setPending(false);
    }
  }, [options, savedMode]);

  return useMemo(() => ({
    savedMode,
    effectiveMode,
    isResponsiveOverride: Boolean(options.forcedResponsiveMode),
    pending,
    error,
    updateMode
  }), [savedMode, effectiveMode, options.forcedResponsiveMode, pending, error, updateMode]);
}
