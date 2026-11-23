import { PLAN_WEEKS } from "./plan.seed";
import {
  bikeReplacement,
  easyReplacement,
  EXTRA_EASY_FROM_WEEK,
  EXTRA_EASY_MIN,
  extraEasySession,
  extraEasyStatus,
  gelAdvice,
  halfAdvice,
  HALF_DATE,
  missedSessionAdvice,
  shouldDowngradeQuality,
  tibiaPointPain,
  tibiaStopAdvice,
  weeklyCapAdvice,
} from "./rules";
import { allCheckIns, type AppState } from "./state";
import { actualWeekKm, DEFAULT_EASY_PACE, isRunSession, plannedWeekKm, weekSummary } from "./summary";
import { easyPaceRange } from "./zones";
import type { Adjustment, Advice, CheckIn, IsoDate, Profile, Week } from "./types";
import { dateOfWeekday, diffDays, weekForDate } from "./week";

/** Passo easy per le stime: punto medio del range easy se c'è il test di soglia, altrimenti il default. */
export function easyPaceOf(profile: Profile): number {
  if (!profile.thresholdPaceSecPerKm) return DEFAULT_EASY_PACE;
  const r = easyPaceRange(profile.thresholdPaceSecPerKm);
  return (r.fast + r.slow) / 2;
}

export interface StopStatus {
  active: boolean;
  /** Data della segnalazione di dolore puntiforme che ha fatto scattare R3. */
  since?: IsoDate;
}

/** R3: lo stop resta attivo finché non c'è un via libera registrato DOPO la segnalazione. */
export function stopStatus(state: AppState): StopStatus {
  const points = allCheckIns(state).filter(tibiaPointPain);
  if (points.length === 0) return { active: false };
  const since = points[points.length - 1].date;
  const cleared = state.runClearedOn !== undefined && state.runClearedOn > since;
  return cleared ? { active: false, since } : { active: true, since };
}

export interface EffectiveWeek {
  /** Settimana con gli override applicati (il seed resta intatto). */
  week: Week;
  adjustments: Adjustment[];
}

/** Applica gli override deterministici R3 (stop) e R2 (qualità → easy) a una settimana. */
/** Valuta R8 (easy facoltativa del mercoledì) per una settimana, alla data `today`. */
export function extraEasyReport(base: Week, state: AppState, today: IsoDate): ReturnType<typeof extraEasyStatus> {
  const pace = easyPaceOf(state.profile);
  return extraEasyStatus({
    weekIndex: base.index,
    today,
    checkIns: allCheckIns(state),
    stopActive: stopStatus(state).active,
    plannedKm: plannedWeekKm(base, pace),
    baseKm: baseWeeklyKm(state, base),
    extraKm: (EXTRA_EASY_MIN * 60) / pace,
  });
}

/**
 * Applica gli override deterministici: R3 (stop), R2 (qualità → easy) e, se è data `today`,
 * R8 (easy facoltativa del mercoledì). Senza `today` R8 non si applica.
 */
export function effectiveWeek(base: Week, state: AppState, today?: IsoDate): EffectiveWeek {
  const checkIns = allCheckIns(state);
  const checkInOn = (d: IsoDate): CheckIn | undefined => checkIns.find((c) => c.date === d);
  const stop = stopStatus(state);
  const adjustments: Adjustment[] = [];

  const extra =
    today !== undefined && base.index >= EXTRA_EASY_FROM_WEEK && state.extraEasyOff !== true
      ? extraEasyReport(base, state, today)
      : undefined;

  const sessions = base.sessions.map((session) => {
    const date = dateOfWeekday(base, session.weekday);
    const alreadyRun = state.runs.some((r) => r.date === date);
    if (extra?.eligible && session.kind === "rest" && session.weekday === "mer") {
      const replacement = extraEasySession(session.weekday);
      adjustments.push({
        rule: "R8",
        weekIndex: base.index,
        weekday: session.weekday,
        date,
        original: session,
        replacement,
        reason: "Easy facoltativa: nessun dolore a tibie/polpacci, gambe ok e carico entro il +10%.",
      });
      return replacement;
    }
    if (alreadyRun || !isRunSession(session)) return session;

    if (stop.active && stop.since !== undefined && date >= stop.since) {
      const replacement = bikeReplacement(session);
      adjustments.push({
        rule: "R3",
        weekIndex: base.index,
        weekday: session.weekday,
        date,
        original: session,
        replacement,
        reason: "Dolore puntiforme sulla tibia: corsa sospesa fino a valutazione professionale.",
      });
      return replacement;
    }

    if (shouldDowngradeQuality(session, checkInOn(date))) {
      const replacement = easyReplacement(session);
      adjustments.push({
        rule: "R2",
        weekIndex: base.index,
        weekday: session.weekday,
        date,
        original: session,
        replacement,
        reason: "Gambe pesanti o tibie doloranti: la qualità diventa un easy.",
      });
      return replacement;
    }
    return session;
  });

  return { week: { ...base, sessions }, adjustments };
}

/** Km realmente fatti nell'ultima settimana normale (non di scarico) prima di `week`, con ripiego sulla base dell'onboarding. */
export function baseWeeklyKm(state: AppState, week: Week, weeks: readonly Week[] = PLAN_WEEKS): number | undefined {
  for (let i = week.index - 1; i >= 0; i--) {
    const w = weeks[i];
    if (w.deload) continue;
    const km = actualWeekKm(state.runs, w);
    if (km > 0) return km;
  }
  return state.baselineWeeklyKm && state.baselineWeeklyKm > 0 ? state.baselineWeeklyKm : undefined;
}

/** Messaggi del coach per una settimana (R1, R4, R6 e avvisi sui test). */
export function adviceForWeek(base: Week, state: AppState, today: IsoDate): Advice[] {
  const { week, adjustments: all } = effectiveWeek(base, state, today);
  const adjustments = all.filter((a) => a.rule !== "R8");
  const pace = easyPaceOf(state.profile);
  const out: Advice[] = [];

  // R3: un solo avviso per settimana (il banner globale spiega già il perché).
  const stopped = adjustments.filter((a) => a.rule === "R3");
  if (stopped.length > 0) {
    out.push({
      rule: "R3",
      level: "stop",
      title: `Corsa sospesa: ${stopped.map((a) => a.weekday.toUpperCase()).join(", ")} in bici`,
      message: "Le corse di questa settimana diventano bici Z2 finché non c'è una valutazione professionale.",
      seeProfessional: true,
    });
  }
  for (const a of adjustments.filter((x) => x.rule === "R2")) {
    out.push({
      rule: "R2",
      level: "warning",
      title: `${a.weekday.toUpperCase()}: qualità cambiata in easy`,
      message: `${a.reason} Nuova seduta: ${a.replacement.description}.`,
    });
  }

  const sum = weekSummary(week, state.runs, today, pace, state.skips);
  const missed = missedSessionAdvice(sum.statuses.filter((s) => s.state === "missed" || s.state === "skipped").map((s) => s.session));
  if (missed) out.push(missed);

  const base_ = baseWeeklyKm(state, week);
  if (base_ !== undefined) {
    const cap = weeklyCapAdvice(week, plannedWeekKm(week, pace), base_);
    if (cap) out.push(cap);
  }

  for (const s of week.sessions) {
    const gel = gelAdvice(s, pace);
    if (gel) out.push({ ...gel, title: `${s.weekday.toUpperCase()} · ${gel.title}` });
  }

  // Test/gara a gambe stanche: non si sostituiscono, si consiglia di spostarli.
  for (const s of week.sessions) {
    if (s.kind !== "threshold_test") continue;
    const c = allCheckIns(state).find((x) => x.date === dateOfWeekday(week, s.weekday));
    if (c && (c.heavyLegs || (c.painLocation === "tibia" && c.pain >= 3))) {
      out.push({
        rule: "R2",
        level: "warning",
        title: "Test soglia: valuta di spostarlo",
        message: "Con gambe pesanti o tibie doloranti il test non è affidabile (serve riposo da 48h). Spostalo di 1–2 giorni.",
      });
    }
  }
  return out;
}

/** Messaggi non legati a una settimana: R3 attivo, R5 (test da fare/fatto), R7 (mezza). */
export function globalAdvice(state: AppState, today: IsoDate): Advice[] {
  const out: Advice[] = [];
  const stop = stopStatus(state);
  if (stop.active) out.push(tibiaStopAdvice());

  const testDay = "2026-12-03";
  if (state.thresholdTests.length === 0) {
    const d = diffDays(today, testDay);
    if (d >= 0 && d <= 7) {
      out.push({
        rule: "R5",
        level: "info",
        title: d === 0 ? "Oggi: test soglia 30'" : `Test soglia tra ${d} giorni`,
        message: "Dopo il test inserisci FC media e passo degli ultimi 20': l'app ricalcola zone e ritmi.",
      });
    } else if (d < 0) {
      out.push({
        rule: "R5",
        level: "warning",
        title: "Test soglia da registrare",
        message: "Inserisci il risultato del test (Profilo → Test soglia) per ricalcolare zone e ritmi.",
      });
    }
  }

  if (state.halfResult) out.push(halfAdvice(state.halfResult.timeSec));
  else if (today > HALF_DATE && weekForDate(today)) {
    out.push({
      rule: "R7",
      level: "info",
      title: "Mezza di prova da registrare",
      message: "Inserisci il tempo della mezza del 14/02 (Profilo): se è oltre 1:54 rivediamo il target.",
    });
  }
  return out;
}
