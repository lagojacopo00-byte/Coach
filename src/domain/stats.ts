import { PLAN_WEEKS } from "./plan.seed";
import { DEFAULT_EASY_PACE, estimateSessionKm, isRunSession } from "./summary";
import type { IsoDate, Run, SessionKind, Week } from "./types";
import { addDays, dateOfWeekday, diffDays, weekForDate } from "./week";

/** Statistiche sulle corse registrate. Logica pura. */

export interface KindPace {
  kind: SessionKind;
  count: number;
  km: number;
  /** Passo medio (tempo totale / km totali) sec/km; undefined se mancano i tempi. */
  avgPaceSecPerKm?: number;
}

export interface RunStats {
  runs: number;
  totalKm: number;
  totalElevationM: number;
  /** Passo medio di tutte le corse con km e tempo. */
  avgPaceSecPerKm?: number;
  longest?: { km: number; date: IsoDate; kind: SessionKind };
  /** Settimana del piano con più km. */
  bestWeek?: { index: number; km: number };
  /** Km negli ultimi 7 giorni (oggi compreso) e nei 7 precedenti. */
  last7Km: number;
  prev7Km: number;
  last7ChangePct?: number;
  /** Media dei km delle ultime 4 settimane complete del piano (se ce n'è almeno una). */
  avg4WeeksKm?: number;
  /** Km fatti rispetto a quelli previsti fino a oggi, in %. Undefined prima dell'inizio del piano. */
  planDonePct?: number;
  plannedToDateKm?: number;
  /** Km nel mese del calendario di `today`. */
  monthKm: number;
  daysSinceLast?: number;
  paceByKind: KindPace[];
  /** FC media sugli easy (solo quelli con FC). */
  easyAvgHr?: number;
  easyHrCount: number;
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/** Km previsti dal piano fino a `today` incluso (le sedute di corsa non facoltative con data già arrivata). */
export function plannedKmToDate(today: IsoDate, weeks: readonly Week[] = PLAN_WEEKS, easyPace = DEFAULT_EASY_PACE): number {
  let km = 0;
  for (const w of weeks)
    for (const s of w.sessions)
      if (isRunSession(s) && !s.optional && dateOfWeekday(w, s.weekday) <= today) km += estimateSessionKm(s, easyPace);
  return km;
}

export function kmInRange(runs: readonly Run[], from: IsoDate, to: IsoDate): number {
  return sum(runs.filter((r) => r.date >= from && r.date <= to).map((r) => r.km));
}

export function runStats(runs: readonly Run[], today: IsoDate, weeks: readonly Week[] = PLAN_WEEKS): RunStats {
  const past = runs.filter((r) => r.date <= today);
  const totalKm = sum(past.map((r) => r.km));
  const timed = past.filter((r) => r.km > 0 && r.durationSec > 0);

  const longestRun = past.reduce<Run | undefined>((m, r) => (r.km > (m?.km ?? 0) ? r : m), undefined);

  const byWeek = new Map<number, number>();
  for (const r of past) {
    const w = weekForDate(r.date, weeks);
    if (w) byWeek.set(w.index, (byWeek.get(w.index) ?? 0) + r.km);
  }
  const best = [...byWeek.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];

  const last7Km = kmInRange(past, addDays(today, -6), today);
  const prev7Km = kmInRange(past, addDays(today, -13), addDays(today, -7));

  const cur = weekForDate(today, weeks);
  const completed = weeks.filter((w) => w.end < today && (!cur || w.index < cur.index)).slice(-4);
  const avg4 = completed.length > 0 ? sum(completed.map((w) => byWeek.get(w.index) ?? 0)) / completed.length : undefined;

  const planned = today >= weeks[0].start ? plannedKmToDate(today, weeks) : undefined;
  const inPlan = past.filter((r) => weekForDate(r.date, weeks) !== undefined);

  const kinds = new Map<SessionKind, Run[]>();
  for (const r of timed) kinds.set(r.kind, [...(kinds.get(r.kind) ?? []), r]);
  const paceByKind: KindPace[] = [...kinds.entries()]
    .map(([kind, rs]) => ({ kind, count: rs.length, km: sum(rs.map((r) => r.km)), avgPaceSecPerKm: sum(rs.map((r) => r.durationSec)) / sum(rs.map((r) => r.km)) }))
    .sort((a, b) => b.km - a.km);

  const easyHr = past.filter((r) => r.kind === "easy" && r.avgHr !== undefined).map((r) => r.avgHr as number);
  const last = past.reduce<IsoDate | undefined>((m, r) => (m === undefined || r.date > m ? r.date : m), undefined);
  const monthStart = `${today.slice(0, 7)}-01`;

  return {
    runs: past.length,
    totalKm,
    totalElevationM: sum(past.map((r) => r.elevationGainM ?? 0)),
    avgPaceSecPerKm: timed.length > 0 ? sum(timed.map((r) => r.durationSec)) / sum(timed.map((r) => r.km)) : undefined,
    longest: longestRun && longestRun.km > 0 ? { km: longestRun.km, date: longestRun.date, kind: longestRun.kind } : undefined,
    bestWeek: best ? { index: best[0], km: best[1] } : undefined,
    last7Km,
    prev7Km,
    last7ChangePct: prev7Km > 0 ? ((last7Km - prev7Km) / prev7Km) * 100 : undefined,
    avg4WeeksKm: avg4,
    planDonePct: planned && planned > 0 ? (sum(inPlan.map((r) => r.km)) / planned) * 100 : undefined,
    plannedToDateKm: planned,
    monthKm: kmInRange(past, monthStart, today),
    daysSinceLast: last ? diffDays(last, today) : undefined,
    paceByKind,
    easyAvgHr: easyHr.length > 0 ? Math.round(sum(easyHr) / easyHr.length) : undefined,
    easyHrCount: easyHr.length,
  };
}

export interface WeekGroup<T> {
  /** Lunedì della settimana. */
  monday: IsoDate;
  /** Indice nel piano, se la settimana è nel piano. */
  planIndex?: number;
  items: T[];
}

/** Raggruppa per settimana (lunedì–domenica), dalla più recente. Le voci restano nell'ordine ricevuto. */
export function groupByWeek<T extends { date: IsoDate }>(items: readonly T[], weeks: readonly Week[] = PLAN_WEEKS): WeekGroup<T>[] {
  const mondayOf = (d: IsoDate) => {
    const w = weekForDate(d, weeks);
    if (w) return w.start;
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay(); // 0 = domenica
    return addDays(d, -((dow + 6) % 7));
  };
  const groups = new Map<IsoDate, WeekGroup<T>>();
  for (const it of items) {
    const monday = mondayOf(it.date);
    const g = groups.get(monday) ?? { monday, planIndex: weekForDate(monday, weeks)?.index, items: [] };
    g.items.push(it);
    groups.set(monday, g);
  }
  return [...groups.values()].sort((a, b) => b.monday.localeCompare(a.monday));
}

const km1 = (n: number) => `${n.toFixed(1).replace(".", ",")} km`;

/** Frasi di analisi sui chilometri, dai dati che ci sono. */
export function kmInsights(s: RunStats): string[] {
  const out: string[] = [];
  if (s.last7Km > 0 || s.prev7Km > 0) {
    const ch = s.last7ChangePct;
    out.push(`Ultimi 7 giorni: ${km1(s.last7Km)}${ch !== undefined ? ` (${ch >= 0 ? "+" : ""}${ch.toFixed(0)}% sui 7 precedenti)` : ""}.`);
    if (ch !== undefined && ch > 10) out.push("Sei oltre il +10% a settimana: meglio non salire ancora.");
  }
  if (s.avg4WeeksKm !== undefined) out.push(`Media delle ultime settimane complete: ${km1(s.avg4WeeksKm)}.`);
  if (s.planDonePct !== undefined && s.plannedToDateKm) out.push(`Hai fatto il ${s.planDonePct.toFixed(0)}% dei km previsti dal piano fino a oggi (${km1(s.plannedToDateKm)}).`);
  return out;
}
