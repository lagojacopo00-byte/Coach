import { adviceForWeek, easyPaceOf, effectiveWeek, globalAdvice, type EffectiveWeek } from "./coach";
import { CHECKLIST_SEED, type ChecklistItem } from "./checklist.seed";
import { PLAN_WEEKS } from "./plan.seed";
import type { AppState } from "./state";
import { actualWeekKm, changePct, plannedWeekKm, weekSummary, type WeekSummary } from "./summary";
import type { Advice, IsoDate, Phase, Week } from "./types";
import { daysToRace, nextWeek, phaseForDate, planStatus, weekForDate, weekdayOf, type PlanStatus } from "./week";

/** Elementi della checklist ancora aperti e rilevanti per la settimana (per indice o per scadenza). */
export function checklistForWeek(
  done: readonly string[],
  week: Week,
  items: readonly ChecklistItem[] = CHECKLIST_SEED,
): ChecklistItem[] {
  return items
    .filter((i) => !done.includes(i.id))
    .filter((i) => (i.weekIndex !== undefined && i.weekIndex <= week.index) || (i.due !== undefined && i.due <= week.end))
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
}

export interface WeekView {
  effective: EffectiveWeek;
  summary: WeekSummary;
  plannedKm: number;
  actualKm: number;
  advices: Advice[];
}

export function weekView(state: AppState, week: Week, today: IsoDate): WeekView {
  const effective = effectiveWeek(week, state);
  const pace = easyPaceOf(state.profile);
  return {
    effective,
    summary: weekSummary(effective.week, state.runs, today, pace),
    plannedKm: plannedWeekKm(effective.week, pace),
    actualKm: actualWeekKm(state.runs, week),
    advices: adviceForWeek(week, state, today),
  };
}

export interface SundayView {
  status: PlanStatus;
  /** Settimana appena finita (o in corso). Assente prima dell'inizio del piano. */
  finished?: WeekView & { week: Week; changeVsPrevPct?: number; previousKm?: number };
  /** Settimana che arriva. Assente a piano finito. */
  next?: WeekView & { week: Week };
  checklist: ChecklistItem[];
  advices: Advice[];
}

export function sundayView(state: AppState, today: IsoDate): SundayView {
  const status = planStatus(today);
  const cur = weekForDate(today);
  const nxt = nextWeek(today);
  const finished = cur
    ? (() => {
        const v = weekView(state, cur, today);
        const prev = cur.index > 0 ? PLAN_WEEKS[cur.index - 1] : undefined;
        const previousKm = prev ? actualWeekKm(state.runs, prev) : undefined;
        return {
          ...v,
          week: cur,
          previousKm,
          changeVsPrevPct: previousKm !== undefined ? changePct(previousKm, v.actualKm) : undefined,
        };
      })()
    : undefined;
  const next = nxt ? { ...weekView(state, nxt, today), week: nxt } : undefined;
  return {
    status,
    finished,
    next,
    checklist: checklistForWeek(state.checklistDone, nxt ?? cur ?? PLAN_WEEKS[0]),
    advices: globalAdvice(state, today),
  };
}

export interface TodayView {
  status: PlanStatus;
  week?: Week;
  phase?: Phase;
  daysToRace: number;
  weekView?: WeekView;
  todaySession?: EffectiveWeek["week"]["sessions"][number];
  adjusted: boolean;
  advices: Advice[];
}

export function todayView(state: AppState, today: IsoDate): TodayView {
  const week = weekForDate(today);
  const wv = week ? weekView(state, week, today) : undefined;
  const wd = weekdayOf(today);
  const todaySession = wv?.effective.week.sessions.find((s) => s.weekday === wd);
  return {
    status: planStatus(today),
    week,
    phase: phaseForDate(today),
    daysToRace: daysToRace(today, state.profile.raceDate),
    weekView: wv,
    todaySession,
    adjusted: wv?.effective.adjustments.some((a) => a.weekday === wd) ?? false,
    advices: [...globalAdvice(state, today), ...(wv?.advices.filter((a) => a.rule === "R2" || a.rule === "R3") ?? [])],
  };
}
