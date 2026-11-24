import type { IsoDate, Run, SessionKind } from "./types";

/** Import da Strava: logica pura. Le chiamate di rete stanno in `src/server/strava.ts`. */

export const STRAVA_RUN_TYPES: readonly string[] = ["Run", "TrailRun", "VirtualRun"];

/** Una corsa di Strava ridotta ai dati che usa l'app. */
export interface StravaActivity {
  id: number;
  name: string;
  sportType: string;
  /** Data locale (YYYY-MM-DD) di inizio. */
  date: IsoDate;
  km: number;
  durationSec: number;
  avgHr?: number;
  elevationGainM?: number;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Da JSON di Strava ad attività: solo corse, con dati sensati. Undefined per tutto il resto (bici, nuoto, dati rotti). */
export function mapStravaActivity(raw: unknown): StravaActivity | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const sport = typeof r.sport_type === "string" ? r.sport_type : typeof r.type === "string" ? r.type : "";
  if (!STRAVA_RUN_TYPES.includes(sport)) return undefined;
  if (!isNum(r.id) || typeof r.start_date_local !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(r.start_date_local)) return undefined;
  const distance = isNum(r.distance) ? r.distance : 0;
  const moving = isNum(r.moving_time) ? r.moving_time : 0;
  if (distance <= 0 && moving <= 0) return undefined;
  return {
    id: r.id,
    name: typeof r.name === "string" ? r.name : "Corsa",
    sportType: sport,
    date: r.start_date_local.slice(0, 10),
    km: Math.round(distance / 10) / 100,
    durationSec: Math.round(moving),
    ...(isNum(r.average_heartrate) && r.average_heartrate > 0 ? { avgHr: Math.round(r.average_heartrate) } : {}),
    ...(isNum(r.total_elevation_gain) && r.total_elevation_gain > 0 ? { elevationGainM: Math.round(r.total_elevation_gain) } : {}),
  };
}

/** Le corse di Strava di un giorno. */
export function activitiesOn(activities: readonly StravaActivity[], date: IsoDate): StravaActivity[] {
  return activities.filter((a) => a.date === date);
}

/** Corsa dell'app da un'attività Strava. Sensazioni e dolore li aggiungi tu. */
export function toRun(a: StravaActivity, kind: SessionKind): Run {
  return {
    id: `strava-${a.id}`,
    date: a.date,
    kind,
    km: a.km,
    durationSec: a.durationSec,
    ...(a.km > 0 && a.durationSec > 0 ? { avgPaceSecPerKm: Math.round(a.durationSec / a.km) } : {}),
    ...(a.avgHr ? { avgHr: a.avgHr } : {}),
    ...(a.elevationGainM ? { elevationGainM: a.elevationGainM } : {}),
    pain: 0,
    stravaId: a.id,
  };
}

export interface ImportPlan {
  toAdd: Run[];
  /** Già importate in precedenza. */
  alreadyImported: number;
  /** Attività in giorni dove hai già registrato una corsa a mano: non si toccano. */
  skippedSameDay: number;
}

/**
 * Cosa importare: salta le attività già importate e i giorni in cui c'è già una corsa registrata
 * (non sovrascrive quello che hai scritto tu).
 */
export function planImport(
  runs: readonly Run[],
  activities: readonly StravaActivity[],
  kindFor: (a: StravaActivity) => SessionKind,
): ImportPlan {
  const imported = new Set(runs.map((r) => r.stravaId).filter((x): x is number => x !== undefined));
  const manualDays = new Set(runs.filter((r) => r.stravaId === undefined).map((r) => r.date));
  const plan: ImportPlan = { toAdd: [], alreadyImported: 0, skippedSameDay: 0 };
  for (const a of [...activities].sort((x, y) => x.date.localeCompare(y.date) || x.id - y.id)) {
    if (imported.has(a.id)) plan.alreadyImported++;
    else if (manualDays.has(a.date)) plan.skippedSameDay++;
    else plan.toAdd.push(toRun(a, kindFor(a)));
  }
  return plan;
}

export function importSummary(p: ImportPlan): string {
  const parts = [`Importate ${p.toAdd.length} ${p.toAdd.length === 1 ? "corsa" : "corse"}`];
  if (p.alreadyImported > 0) parts.push(`${p.alreadyImported} già presenti`);
  if (p.skippedSameDay > 0) parts.push(`${p.skippedSameDay} saltate perché quel giorno c'è già una corsa registrata a mano`);
  return parts.join(", ") + ".";
}
