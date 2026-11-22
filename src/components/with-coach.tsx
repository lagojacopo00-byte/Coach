"use client";

import type { ReactNode } from "react";
import { useCoach, type Snapshot } from "../data/store";
import { Loading } from "./ui";

/** Mostra il contenuto solo quando lo stato locale è caricato (evita differenze server/client). */
export function WithCoach({ children }: { children: (c: Snapshot) => ReactNode }) {
  const c = useCoach();
  if (!c) return <Loading />;
  return <>{children(c)}</>;
}
