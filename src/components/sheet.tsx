"use client";

import { useEffect, type ReactNode } from "react";
import { IconX } from "./icons";

/** Scheda che sale dal basso (bottom sheet): dettagli e log senza cambiare pagina. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Chiudi" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative mx-auto max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl dark:bg-zinc-900"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <IconX className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
