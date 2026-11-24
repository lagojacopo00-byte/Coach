import type { StravaActivity } from "../domain/strava";

/** Chiamate dal browser alle nostre route /api/strava (che parlano con Strava). */

export interface StravaStatus {
  /** Le chiavi di Strava sono sul server (Vercel). */
  configured: boolean;
  /** Questo browser è collegato a Strava. */
  connected: boolean;
}

export async function getStravaStatus(): Promise<StravaStatus | undefined> {
  try {
    const r = await fetch("/api/strava/status", { cache: "no-store" });
    if (!r.ok) return undefined;
    const j = (await r.json()) as Partial<StravaStatus>;
    return { configured: j.configured === true, connected: j.connected === true };
  } catch {
    return undefined;
  }
}

export type ActivitiesResult =
  | { ok: true; activities: StravaActivity[] }
  | { ok: false; error: "not_configured" | "not_connected" | "strava_error" | "network" };

export async function fetchStravaActivities(afterSec?: number): Promise<ActivitiesResult> {
  try {
    const r = await fetch(`/api/strava/activities${afterSec ? `?after=${Math.floor(afterSec)}` : ""}`, { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as { activities?: StravaActivity[] };
      return { ok: true, activities: Array.isArray(j.activities) ? j.activities : [] };
    }
    const e = ((await r.json().catch(() => ({}))) as { error?: string }).error;
    if (e === "not_configured" || e === "not_connected") return { ok: false, error: e };
    return { ok: false, error: "strava_error" };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function disconnectStrava(): Promise<boolean> {
  try {
    return (await fetch("/api/strava/disconnect", { method: "POST" })).ok;
  } catch {
    return false;
  }
}

export function errorText(e: Extract<ActivitiesResult, { ok: false }>["error"]): string {
  switch (e) {
    case "not_configured":
      return "Strava non è ancora configurato (mancano le chiavi su Vercel).";
    case "not_connected":
      return "Strava non è collegato: collegalo dal Profilo.";
    case "strava_error":
      return "Strava non risponde: riprova tra poco.";
    default:
      return "Nessuna connessione: riprova.";
  }
}
