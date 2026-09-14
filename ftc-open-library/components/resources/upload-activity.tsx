"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type UploadActivity = {
  busy: boolean;
  setBusy: (busy: boolean) => void;
};

const UploadActivityContext = createContext<UploadActivity | null>(null);

/**
 * Lets the file uploader disable Submit for Review while a transfer or
 * finalization is in flight. Server-side submit still refuses incomplete
 * intents; this is only UX.
 */
export function UploadActivityProvider({ children }: { children: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const value = useMemo(() => ({ busy, setBusy }), [busy]);
  return <UploadActivityContext.Provider value={value}>{children}</UploadActivityContext.Provider>;
}

export function useUploadActivity(): UploadActivity {
  return useContext(UploadActivityContext) ?? { busy: false, setBusy: () => undefined };
}
