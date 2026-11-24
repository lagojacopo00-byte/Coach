import type { ImportedActivity } from "../domain/strava";

/** Chiamate dal browser alle nostre route /api/garmin (che parlano con Garmin). */

export interface GarminStatus {
  /** Chiave e PIN sono sul server (Vercel). */
  configured: boolean;
  issue?: "missing_key" | "missing_pin" | "short_pin";
  /** Questo browser ha scritto il PIN giusto. */
  unlocked: boolean;
}

export async function getGarminStatus(): Promise<GarminStatus | undefined> {
  try {
    const r = await fetch("/api/garmin/status", { cache: "no-store" });
    if (!r.ok) return undefined;
    const j = (await r.json()) as Partial<GarminStatus>;
    return { configured: j.configured === true, issue: j.issue, unlocked: j.unlocked === true };
  } catch {
    return undefined;
  }
}

export async function unlockGarmin(pin: string): Promise<"ok" | "wrong_pin" | "error"> {
  try {
    const r = await fetch("/api/garmin/unlock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
    if (r.ok) return "ok";
    return r.status === 401 ? "wrong_pin" : "error";
  } catch {
    return "error";
  }
}

export async function lockGarmin(): Promise<void> {
  try {
    await fetch("/api/garmin/lock", { method: "POST" });
  } catch {
    /* il cookie scade comunque */
  }
}

export type GarminResult =
  | { ok: true; activities: ImportedActivity[]; message?: string }
  | { ok: false; error: "not_configured" | "locked" | "key_invalid" | "garmin_error" | "network" };

/** Corse Garmin tra due date (YYYY-MM-DD); senza date, gli ultimi 30 giorni. */
export async function fetchGarminActivities(from?: string, to?: string): Promise<GarminResult> {
  try {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const r = await fetch(`/api/garmin/activities${q.size ? `?${q.toString()}` : ""}`, { cache: "no-store" });
    if (r.ok) {
      const j = (await r.json()) as { activities?: ImportedActivity[]; message?: string };
      return { ok: true, activities: Array.isArray(j.activities) ? j.activities : [], message: j.message };
    }
    const e = ((await r.json().catch(() => ({}))) as { error?: string }).error;
    if (e === "not_configured" || e === "locked" || e === "key_invalid") return { ok: false, error: e };
    return { ok: false, error: "garmin_error" };
  } catch {
    return { ok: false, error: "network" };
  }
}

export function garminErrorText(e: Extract<GarminResult, { ok: false }>["error"]): string {
  switch (e) {
    case "not_configured":
      return "Garmin non è ancora configurato (mancano la chiave o il PIN su Vercel).";
    case "locked":
      return "Import Garmin bloccato: scrivi il PIN dal Profilo.";
    case "key_invalid":
      return "La chiave Garmin è scaduta o revocata. Creane una nuova su Garmin Connect (Impostazioni → Personal API), aggiornala su Vercel (GARMIN_API_KEY) e fai Redeploy.";
    case "garmin_error":
      return "Garmin non risponde: riprova tra poco.";
    default:
      return "Nessuna connessione: riprova.";
  }
}
