import { PHASES, PLAN_WEEKS, RACE_DATE } from "./plan.seed";
import type { IsoDate, Phase, Week } from "./types";

const DAY_MS = 86_400_000;

const toMs = (iso: IsoDate): number => Date.parse(`${iso}T00:00:00Z`);

/** Giorni di calendario da `from` a `to` (positivo se `to` è dopo `from`). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toMs(to) - toMs(from)) / DAY_MS);
}

/** Settimana del piano che contiene la data, o undefined se fuori dal piano. */
export function weekForDate(date: IsoDate, weeks: readonly Week[] = PLAN_WEEKS): Week | undefined {
  return weeks.find((w) => date >= w.start && date <= w.end);
}

/** Settimana successiva a quella che contiene la data (per la vista della domenica sera). */
export function nextWeek(date: IsoDate, weeks: readonly Week[] = PLAN_WEEKS): Week | undefined {
  const current = weekForDate(date, weeks);
  if (current) return weeks.find((w) => w.index === current.index + 1);
  // Prima dell'inizio del piano la "prossima" è la settimana 0.
  return date < weeks[0].start ? weeks[0] : undefined;
}

/** Fase che contiene la data, o undefined se fuori dal piano. */
export function phaseForDate(date: IsoDate, phases: readonly Phase[] = PHASES): Phase | undefined {
  return phases.find((p) => date >= p.start && date <= p.end);
}

/** Giorni mancanti alla gara (0 il giorno della gara, negativo dopo). */
export function daysToRace(date: IsoDate, raceDate: IsoDate = RACE_DATE): number {
  return diffDays(date, raceDate);
}

/** Settimane intere (arrotondate per eccesso) mancanti alla gara; 0 se la gara è passata o è oggi. */
export function weeksToRace(date: IsoDate, raceDate: IsoDate = RACE_DATE): number {
  return Math.max(0, Math.ceil(daysToRace(date, raceDate) / 7));
}

export type PlanStatus = "before" | "during" | "after";

export function planStatus(date: IsoDate, weeks: readonly Week[] = PLAN_WEEKS): PlanStatus {
  if (date < weeks[0].start) return "before";
  if (date > weeks[weeks.length - 1].end) return "after";
  return "during";
}

/** Avanzamento di una fase alla data: 0 prima dell'inizio, 1 dopo la fine. */
export function phaseProgress(phase: Phase, date: IsoDate): number {
  const total = diffDays(phase.start, phase.end) + 1;
  const done = diffDays(phase.start, date) + 1;
  return Math.min(1, Math.max(0, done / total));
}
