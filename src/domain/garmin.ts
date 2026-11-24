import type { ImportedActivity } from "./strava";

/**
 * Attività del Personal API di Garmin Connect → corsa dell'app.
 *
 * ATTENZIONE: Garmin non pubblica lo schema delle attività in una pagina leggibile (solo nello Swagger).
 * I nomi dei campi qui sotto sono quelli del Garmin Connect (activityId, startTimeLocal, activityType.typeKey,
 * distance in metri, duration in secondi, averageHR, elevationGain) e vanno confermati al primo uso con i
 * dati veri: per questo il server restituisce anche una diagnostica (`describeRaw`).
 */

export const GARMIN_RUN_TYPES: readonly string[] = ["running", "trail_running", "treadmill_running", "track_running", "virtual_run"];

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const num = (...candidates: unknown[]): number | undefined => candidates.find(isNum);

function typeKeyOf(r: Record<string, unknown>): string {
  const t = r.activityType;
  if (typeof t === "string") return t.toLowerCase();
  if (typeof t === "object" && t !== null) {
    const k = (t as Record<string, unknown>).typeKey;
    if (typeof k === "string") return k.toLowerCase();
  }
  return typeof r.type === "string" ? r.type.toLowerCase() : "";
}

export function mapGarminActivity(raw: unknown): ImportedActivity | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const type = typeKeyOf(r);
  if (!GARMIN_RUN_TYPES.includes(type)) return undefined;
  const id = num(r.activityId, r.id);
  const start = [r.startTimeLocal, r.startTimeGMT, r.startTime].find((v): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v));
  if (id === undefined || !start) return undefined;
  const distance = num(r.distance, r.distanceInMeters) ?? 0;
  const duration = num(r.movingDuration, r.duration, r.durationInSeconds) ?? 0;
  if (distance <= 0 && duration <= 0) return undefined;
  const hr = num(r.averageHR, r.averageHeartRate, r.avgHr);
  const gain = num(r.elevationGain, r.totalElevationGain);
  return {
    source: "garmin",
    id,
    name: typeof r.activityName === "string" && r.activityName.trim() ? r.activityName : "Corsa",
    sportType: type,
    date: start.slice(0, 10),
    km: Math.round(distance / 10) / 100,
    durationSec: Math.round(duration),
    ...(hr && hr > 0 ? { avgHr: Math.round(hr) } : {}),
    ...(gain && gain > 0 ? { elevationGainM: Math.round(gain) } : {}),
  };
}

export interface RawDescription {
  received: number;
  recognized: number;
  /** Nomi dei campi del primo elemento (solo i nomi, mai i valori). */
  sampleKeys: string[];
  /** Tipi di attività incontrati (es. running, cycling). */
  typeKeys: string[];
}

/** Cosa è arrivato da Garmin, senza dati personali: serve a capire perché non si riconosce nulla. */
export function describeRaw(items: readonly unknown[], recognized: number): RawDescription {
  const first = items.find((x) => typeof x === "object" && x !== null) as Record<string, unknown> | undefined;
  const types = new Set<string>();
  for (const it of items) if (typeof it === "object" && it !== null) types.add(typeKeyOf(it as Record<string, unknown>) || "?");
  return { received: items.length, recognized, sampleKeys: first ? Object.keys(first).slice(0, 60) : [], typeKeys: [...types].slice(0, 20) };
}

/** Messaggio per l'utente quando Garmin risponde ma non c'è nessuna corsa riconosciuta. */
export function unrecognizedMessage(d: RawDescription): string | undefined {
  if (d.received === 0 || d.recognized > 0) return undefined;
  const onlyOtherSports = d.typeKeys.length > 0 && d.typeKeys.every((t) => t !== "?" && !GARMIN_RUN_TYPES.includes(t));
  if (onlyOtherSports) return `Garmin ha risposto con ${d.received} attività, ma nessuna è una corsa (tipi: ${d.typeKeys.join(", ")}).`;
  return `Garmin ha risposto con ${d.received} attività ma non riconosco i campi. Campi ricevuti: ${d.sampleKeys.join(", ")}. Mandameli e li aggiungo.`;
}
