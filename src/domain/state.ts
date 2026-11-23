import { defaultGymPlan, draftToLog, validateGymLog, validateGymPlan, type GymDraft, type GymLog, type Workout } from "./gym";
import { applyRecalculation, recalcFromThresholdTest, type Recalculation, type ThresholdTestInput } from "./rules";
import { defaultProfile, type OnboardingInput } from "./profile";
import type { CheckIn, IsoDate, Profile, Run, Skip } from "./types";

export const STATE_VERSION = 1;

export interface ThresholdTestRecord extends ThresholdTestInput {
  date: IsoDate;
}

export interface HalfRecord {
  date: IsoDate;
  timeSec: number;
}

/** Tutto ciò che l'app salva. Il piano base NON è qui: vive nel seed. */
export interface AppState {
  version: number;
  profile: Profile;
  runs: Run[];
  checkIns: CheckIn[];
  /** Sedute segnate come non fatte. */
  skips: Skip[];
  /** Id degli elementi spuntati nella checklist. */
  checklistDone: string[];
  /** Km settimanali delle ultime 4 settimane (onboarding), base per R1 prima dei log. */
  baselineWeeklyKm?: number;
  onboarding?: OnboardingInput;
  onboardingDone: boolean;
  thresholdTests: ThresholdTestRecord[];
  halfResult?: HalfRecord;
  /** R3: data fino alla quale una valutazione professionale ha dato il via libera a riprendere. */
  runClearedOn?: IsoDate;
  /** Se true, la easy facoltativa del venerdì (R8) è disattivata. */
  extraEasyOff?: boolean;
  /** Scheda di palestra personalizzata; assente = quella di partenza. */
  gymPlan?: Workout[];
  gymLogs: GymLog[];
  /** Allenamenti di palestra in corso: salvati a ogni modifica. */
  gymDrafts: GymDraft[];
}

export function initialState(): AppState {
  return {
    version: STATE_VERSION,
    profile: defaultProfile(),
    runs: [],
    checkIns: [],
    skips: [],
    gymLogs: [],
    gymDrafts: [],
    checklistDone: [],
    onboardingDone: false,
    thresholdTests: [],
  };
}

const byDate = <T extends { date: IsoDate }>(a: T, b: T) => a.date.localeCompare(b.date);

export function addRun(s: AppState, run: Run): AppState {
  if (!(run.km > 0) || !(run.durationSec > 0)) throw new RangeError("Km e tempo devono essere positivi");
  if (run.pain < 0 || run.pain > 10) throw new RangeError("Il dolore va da 0 a 10");
  const runs = [...s.runs.filter((r) => r.id !== run.id), run].sort(byDate);
  // Una corsa registrata annulla un "non fatto" dello stesso giorno.
  return { ...s, runs, skips: s.skips.filter((k) => k.date !== run.date) };
}

export function removeRun(s: AppState, id: string): AppState {
  return { ...s, runs: s.runs.filter((r) => r.id !== id) };
}

/** Segna una seduta come non fatta. Non si può se quel giorno c'è già una corsa registrata. */
export function addSkip(s: AppState, skip: Skip): AppState {
  if (s.runs.some((r) => r.date === skip.date)) throw new RangeError("C'è già una corsa registrata in questa data");
  return { ...s, skips: [...s.skips.filter((k) => k.date !== skip.date), skip].sort(byDate) };
}

export function removeSkip(s: AppState, date: IsoDate): AppState {
  return { ...s, skips: s.skips.filter((k) => k.date !== date) };
}

/** Un check-in per giorno: l'ultimo sostituisce il precedente. */
export function addCheckIn(s: AppState, c: CheckIn): AppState {
  if (c.pain < 0 || c.pain > 10) throw new RangeError("Il dolore va da 0 a 10");
  return { ...s, checkIns: [...s.checkIns.filter((x) => x.date !== c.date), c].sort(byDate) };
}

export function toggleChecklist(s: AppState, id: string): AppState {
  const done = s.checklistDone.includes(id) ? s.checklistDone.filter((x) => x !== id) : [...s.checklistDone, id];
  return { ...s, checklistDone: done };
}

/** R5: registra il test di soglia e ricalcola LTHR e ritmi sul profilo. */
export function recordThresholdTest(
  s: AppState,
  t: ThresholdTestRecord,
): { state: AppState; recalculation: Recalculation } {
  const recalculation = recalcFromThresholdTest(t);
  return {
    recalculation,
    state: {
      ...s,
      profile: applyRecalculation(s.profile, recalculation),
      thresholdTests: [...s.thresholdTests.filter((x) => x.date !== t.date), t].sort(byDate),
    },
  };
}

export function recordHalf(s: AppState, h: HalfRecord): AppState {
  if (!(h.timeSec > 0)) throw new RangeError("Tempo non valido");
  return { ...s, halfResult: h };
}

/** R3: via libera dopo valutazione professionale. */
export function clearRunStop(s: AppState, today: IsoDate): AppState {
  return { ...s, runClearedOn: today };
}

/** Check-in effettivi: quelli espliciti più i dati di dolore/gambe dei log di corsa. */
export function allCheckIns(s: AppState): CheckIn[] {
  const fromRuns: CheckIn[] = s.runs.map((r) => ({
    date: r.date,
    pain: r.pain,
    painLocation: r.painLocation,
    painType: r.painType,
    heavyLegs: r.heavyLegs,
  }));
  // Per lo stesso giorno vale il dato peggiore: non si nasconde un dolore.
  const merged = new Map<IsoDate, CheckIn>();
  for (const c of [...fromRuns, ...s.checkIns]) {
    const prev = merged.get(c.date);
    merged.set(c.date, prev ? worst(prev, c) : c);
  }
  return [...merged.values()].sort(byDate);
}

function worst(a: CheckIn, b: CheckIn): CheckIn {
  const hi = a.pain >= b.pain ? a : b;
  const point = [a, b].find((c) => c.painLocation === "tibia" && c.painType === "puntiforme" && c.pain >= 1);
  return {
    ...hi,
    ...(point ? { painLocation: point.painLocation, painType: point.painType, pain: Math.max(hi.pain, point.pain) } : {}),
    heavyLegs: a.heavyLegs === true || b.heavyLegs === true,
  };
}

/** Validazione di uno stato letto dallo storage o da un backup: scarta ciò che non è riconoscibile. */
export function parseState(raw: unknown): AppState | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const o = raw as Partial<AppState>;
  if (o.version !== STATE_VERSION) return undefined;
  if (!o.profile || !Array.isArray(o.runs) || !Array.isArray(o.checkIns) || !Array.isArray(o.checklistDone)) return undefined;
  const base = initialState();
  return {
    ...base,
    ...o,
    profile: { ...base.profile, ...o.profile },
    thresholdTests: Array.isArray(o.thresholdTests) ? o.thresholdTests : [],
    skips: Array.isArray(o.skips) ? o.skips : [],
    gymLogs: Array.isArray(o.gymLogs) ? o.gymLogs : [],
    gymDrafts: Array.isArray(o.gymDrafts) ? o.gymDrafts : [],
    onboardingDone: o.onboardingDone === true,
  } as AppState;
}

export function applyOnboardingToState(s: AppState, i: OnboardingInput, profile: Profile): AppState {
  return { ...s, profile, onboarding: i, baselineWeeklyKm: i.weeklyKmLast4, onboardingDone: true };
}

/** Scheda in uso: quella personalizzata o quella di partenza. */
export function gymPlanOf(s: AppState): Workout[] {
  return s.gymPlan ?? defaultGymPlan();
}

export function setGymPlan(s: AppState, plan: Workout[]): AppState {
  const errors = validateGymPlan(plan);
  if (errors.length > 0) throw new RangeError(errors[0]);
  return { ...s, gymPlan: plan };
}

export function resetGymPlan(s: AppState): AppState {
  const { gymPlan: _unused, ...rest } = s;
  void _unused;
  return rest;
}

/** Un solo log per allenamento e giorno: salvare di nuovo lo sostituisce. */
export function saveGymLog(s: AppState, log: GymLog): AppState {
  const error = validateGymLog(log);
  if (error) throw new RangeError(error);
  const others = s.gymLogs.filter((l) => l.id !== log.id && !(l.date === log.date && l.workoutId === log.workoutId));
  return { ...s, gymLogs: [...others, log].sort(byDate) };
}

export function removeGymLog(s: AppState, id: string): AppState {
  return { ...s, gymLogs: s.gymLogs.filter((l) => l.id !== id) };
}

const sameDraft = (a: GymDraft, b: GymDraft) => a.date === b.date && a.workoutId === b.workoutId;

/**
 * Salva a ogni modifica: la bozza (tutto ciò che hai scritto, anche i pesi senza ripetizioni) e l'allenamento
 * (le serie con ripetizioni), così storico e progressione sono sempre aggiornati. Se togli tutte le ripetizioni
 * l'allenamento sparisce dallo storico.
 */
export function autosaveGym(s: AppState, draft: GymDraft, workout: Workout): AppState {
  const log = draftToLog(draft, workout);
  const dropOld = (l: GymLog) => !(l.date === draft.date && l.workoutId === draft.workoutId);
  const keepDrafts = s.gymDrafts.filter((d) => !sameDraft(d, draft) && d.date >= prunedBefore(draft.date));
  return {
    ...s,
    gymDrafts: [...keepDrafts, draft],
    gymLogs: log ? [...s.gymLogs.filter(dropOld), log].sort(byDate) : s.gymLogs.filter(dropOld),
  };
}

/** Le bozze più vecchie di 14 giorni non servono più. */
function prunedBefore(date: IsoDate): IsoDate {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 14 * 86_400_000).toISOString().slice(0, 10);
}

/** Chiudi l'allenamento: la bozza non serve più (i dati restano nello storico). */
export function finishGymDraft(s: AppState, date: IsoDate, workoutId: string): AppState {
  return { ...s, gymDrafts: s.gymDrafts.filter((d) => !(d.date === date && d.workoutId === workoutId)) };
}
