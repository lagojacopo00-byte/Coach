"use client";

import { useEffect } from "react";

/** Registra il service worker (solo in produzione) per usare l'app anche offline. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
