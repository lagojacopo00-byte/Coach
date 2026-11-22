import type { IsoDate, Run, Session, SessionKind, Week } from "./types";
import { dateOfWeekday } from "./week";

/** Tipi di seduta che sono corse (le altre: palestra, bici, riposo). */
export const RUN_KINDS: readonly SessionKind[] = [
  "easy",
  "hills",
  "threshold",
  "long",
  "long_rm",
  "rm_blocks",
  "threshold_test",
  "trail",
  "half_test",
  "race",
];

/** Sedute di qualità (R2): salite, soglia, blocchi a RM. Test e gara sono trattati a parte. */
export const QUALITY_KINDS: readonly SessionKind[] = ["hills", "threshold", "rm_blocks"];

export const isRunSession = (s: Session): boolean => RUN_KINDS.includes(s.kind);

/** Passo easy di default usato per stimare i km delle sedute a tempo (sec/km). */
export const DEFAULT_EASY_PACE = 420;

/** Minuti equivalenti per sedute di qualità senza durata esplicita (riscaldamento + lavoro + defaticamento). */
const QUALITY_MINUTES: Partial<Record<SessionKind, number>> = {
  hills: 45,
  threshold: 55,
  threshold_test: 45,
};
const WARM_COOL_MIN = 25;

/**
 * Km stimati di una seduta. Se il piano dà i km, quelli; altrimenti si stima
 * dalla durata al passo easy. È una stima: serve a confrontare le settimane (R1).
 */
export function estimateSessionKm(s: Session, easyPace = DEFAULT_EASY_PACE): number {
  if (!isRunSession(s)) return 0;
  if (s.km !== undefined) return s.km;
  if (s.durationMin !== undefined) return (s.durationMin * 60) / easyPace;
  if (s.kind === "rm_blocks" && s.rmKm !== undefined) return s.rmKm + (WARM_COOL_MIN * 60) / easyPace;
  const minutes = QUALITY_MINUTES[s.kind];
  return minutes !== undefined ? (minutes * 60) / easyPace : 0;
}

export function plannedWeekKm(week: Week, easyPace = DEFAULT_EASY_PACE): number {
  return week.sessions.reduce((sum, s) => sum + estimateSessionKm(s, easyPace), 0);
}

export function runsInWeek(runs: readonly Run[], week: Week): Run[] {
  return runs.filter((r) => r.date >= week.start && r.date <= week.end);
}

export function actualWeekKm(runs: readonly Run[], week: Week): number {
  return runsInWeek(runs, week).reduce((sum, r) => sum + r.km, 0);
}

/** Variazione % rispetto alla settimana precedente; undefined se non c'è base. */
export function changePct(previousKm: number, currentKm: number): number | undefined {
  if (!(previousKm > 0)) return undefined;
  return ((currentKm - previousKm) / previousKm) * 100;
}

export type SessionState = "done" | "missed" | "today" | "upcoming";

export interface SessionStatus {
  session: Session;
  date: IsoDate;
  state: SessionState;
  run?: Run;
}

export interface WeekSummary {
  plannedKm: number;
  actualKm: number;
  plannedRuns: number;
  doneRuns: number;
  statuses: SessionStatus[];
  /** Corse fatte in giorni senza una corsa pianificata. */
  extraRuns: Run[];
  maxPain: number;
  painRuns: Run[];
}

/** Pianificato vs fatto: una corsa pianificata è "fatta" se c'è una corsa registrata quel giorno. */
export function weekSummary(
  week: Week,
  runs: readonly Run[],
  today: IsoDate,
  easyPace = DEFAULT_EASY_PACE,
): WeekSummary {
  const weekRuns = runsInWeek(runs, week);
  const used = new Set<string>();
  const statuses: SessionStatus[] = week.sessions.map((session) => {
    const date = dateOfWeekday(week, session.weekday);
    const run = isRunSession(session) ? weekRuns.find((r) => r.date === date) : undefined;
    if (run) used.add(run.id);
    let state: SessionState;
    if (!isRunSession(session)) state = date < today ? "done" : date === today ? "today" : "upcoming";
    else if (run) state = "done";
    else if (date < today) state = "missed";
    else if (date === today) state = "today";
    else state = "upcoming";
    return { session, date, state, run };
  });
  const runSessions = statuses.filter((s) => isRunSession(s.session));
  const painRuns = weekRuns.filter((r) => r.pain > 0);
  return {
    plannedKm: plannedWeekKm(week, easyPace),
    actualKm: weekRuns.reduce((sum, r) => sum + r.km, 0),
    plannedRuns: runSessions.length,
    doneRuns: runSessions.filter((s) => s.state === "done").length,
    statuses,
    extraRuns: weekRuns.filter((r) => !used.has(r.id)),
    maxPain: weekRuns.reduce((m, r) => Math.max(m, r.pain), 0),
    painRuns,
  };
}

export function paceOf(run: Pick<Run, "km" | "durationSec" | "avgPaceSecPerKm">): number | undefined {
  if (run.avgPaceSecPerKm) return run.avgPaceSecPerKm;
  return run.km > 0 ? run.durationSec / run.km : undefined;
}
