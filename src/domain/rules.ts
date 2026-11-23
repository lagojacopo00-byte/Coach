import { hrZones, easyPaceRange, thresholdPaceRange, type HrZone, type PaceRange } from "./zones";
import { DEFAULT_EASY_PACE, estimateSessionKm, isRunSession, plannedWeekKm, QUALITY_KINDS } from "./summary";
import type { Advice, CheckIn, IsoDate, Profile, Session, Week } from "./types";

/* ------------------------------------------------------------------ R1 */

/** Aumento massimo di km settimanali (HANDOFF §6.1). */
export const MAX_WEEKLY_INCREASE = 0.1;

export interface WeeklyCapResult {
  ok: boolean;
  /** Km massimi consentiti (base +10%). */
  maxKm: number;
  /** Variazione % rispetto alla base. */
  increasePct: number;
}

/**
 * R1: tetto +10% sui km settimanali rispetto alla base. Le settimane di scarico
 * sono escluse (non si confrontano né fanno da base: la base è l'ultima settimana normale).
 */
export function checkWeeklyIncrease(plannedKm: number, baseKm: number, deload: boolean): WeeklyCapResult {
  const maxKm = baseKm * (1 + MAX_WEEKLY_INCREASE);
  const increasePct = baseKm > 0 ? ((plannedKm - baseKm) / baseKm) * 100 : 0;
  if (deload || !(baseKm > 0)) return { ok: true, maxKm, increasePct };
  // Tolleranza di 0,05 km per gli arrotondamenti.
  return { ok: plannedKm <= maxKm + 0.05, maxKm, increasePct };
}

/**
 * Valuta il piano settimana per settimana: per ogni settimana non di scarico
 * confronta i km pianificati con l'ultima settimana normale precedente.
 */
export function weeklyIncreaseReport(
  weeks: readonly Week[],
  easyPace = DEFAULT_EASY_PACE,
): { weekIndex: number; plannedKm: number; baseKm: number; result: WeeklyCapResult }[] {
  const out: { weekIndex: number; plannedKm: number; baseKm: number; result: WeeklyCapResult }[] = [];
  let base: number | undefined;
  for (const w of weeks) {
    const km = plannedWeekKm(w, easyPace);
    if (base !== undefined) out.push({ weekIndex: w.index, plannedKm: km, baseKm: base, result: checkWeeklyIncrease(km, base, w.deload) });
    if (!w.deload) base = km;
  }
  return out;
}

/** Advice R1 se i km previsti superano il +10% rispetto ai km realmente fatti nella base. */
export function weeklyCapAdvice(week: Week, plannedKm: number, actualBaseKm: number): Advice | undefined {
  const r = checkWeeklyIncrease(plannedKm, actualBaseKm, week.deload);
  if (r.ok) return undefined;
  return {
    rule: "R1",
    level: "warning",
    title: "Settimana sopra il +10%",
    message: `Il piano prevede ~${plannedKm.toFixed(0)} km, +${r.increasePct.toFixed(0)}% rispetto ai ${actualBaseKm.toFixed(0)} km fatti. Il tetto è ~${r.maxKm.toFixed(0)} km: accorcia il lungo o l'easy, non spingere oltre.`,
  };
}

/* ------------------------------------------------------------------ R2 / R3 */

/** Dolore (0–10) da cui le tibie "dolenti" fanno scattare R2. */
export const TIBIA_PAIN_THRESHOLD = 3;

export const tibiaPointPain = (c: CheckIn): boolean =>
  c.painLocation === "tibia" && c.painType === "puntiforme" && c.pain >= 1;

export const tibiaSore = (c: CheckIn): boolean =>
  c.painLocation === "tibia" && c.pain >= TIBIA_PAIN_THRESHOLD;

/** R2: gambe pesanti o tibie doloranti nel giorno di una qualità → diventa easy. */
export function shouldDowngradeQuality(session: Session, checkIn: CheckIn | undefined): boolean {
  if (!checkIn || !QUALITY_KINDS.includes(session.kind)) return false;
  return checkIn.heavyLegs === true || tibiaSore(checkIn);
}

export function easyReplacement(session: Session): Session {
  const km = estimateSessionKm(session);
  const durationMin = Math.max(30, Math.min(45, Math.round((km * DEFAULT_EASY_PACE) / 60 / 5) * 5));
  return {
    weekday: session.weekday,
    kind: "easy",
    durationMin,
    description: `${durationMin}' easy (al posto di: ${session.description.split(".")[0]})`,
  };
}

/** R3: sostituzione con bici Z2 quando la corsa è sospesa. */
export function bikeReplacement(session: Session): Session {
  const durationMin = session.durationMin ?? 45;
  return {
    weekday: session.weekday,
    kind: "bike",
    durationMin,
    description: `Bici Z2 ${durationMin}' (corsa sospesa)`,
  };
}

export const R3_MESSAGE =
  "Dolore puntiforme sull'osso della tibia: stop alla corsa, vai in bici e fatti vedere da un medico o da un fisioterapista dello sport prima di riprendere. Il coach non è un medico e non può valutare se è sicuro correre.";

export function tibiaStopAdvice(): Advice {
  return { rule: "R3", level: "stop", title: "Stop corsa", message: R3_MESSAGE, seeProfessional: true };
}

/* ------------------------------------------------------------------ R4 */

export function missedSessionAdvice(missed: Session[]): Advice | undefined {
  const runs = missed.filter(isRunSession);
  if (runs.length === 0) return undefined;
  return {
    rule: "R4",
    level: "info",
    title: runs.length === 1 ? "Una seduta saltata" : `${runs.length} sedute saltate`,
    message: "Non si recupera: niente corse aggiunte o allungate. Si riparte dal prossimo appuntamento del piano.",
  };
}

/* ------------------------------------------------------------------ R5 */

export interface ThresholdTestInput {
  /** FC media degli ultimi 20' del test 30'. */
  last20AvgHr: number;
  /** Passo medio degli ultimi 20' (sec/km). */
  last20PaceSecPerKm: number;
}

export interface Recalculation {
  lthr: number;
  thresholdPaceSecPerKm: number;
  zones: HrZone[];
  easy: PaceRange;
  threshold: PaceRange;
}

export function validateThresholdTest(t: ThresholdTestInput): string | undefined {
  if (!(t.last20AvgHr >= 100 && t.last20AvgHr <= 230)) return "FC media non plausibile (100–230 bpm).";
  if (!(t.last20PaceSecPerKm >= 180 && t.last20PaceSecPerKm <= 600)) return "Passo non plausibile (3:00–10:00 /km).";
  return undefined;
}

/** R5: dopo il test di soglia si ricalcolano LTHR, zone e ritmi easy/soglia. */
export function recalcFromThresholdTest(t: ThresholdTestInput): Recalculation {
  const error = validateThresholdTest(t);
  if (error) throw new RangeError(error);
  const lthr = Math.round(t.last20AvgHr);
  const pace = Math.round(t.last20PaceSecPerKm);
  return {
    lthr,
    thresholdPaceSecPerKm: pace,
    zones: hrZones(lthr),
    easy: easyPaceRange(pace),
    threshold: thresholdPaceRange(pace),
  };
}

export function applyRecalculation(profile: Profile, r: Recalculation): Profile {
  return { ...profile, lthr: r.lthr, thresholdPaceSecPerKm: r.thresholdPaceSecPerKm };
}

/* ------------------------------------------------------------------ R6 */

export const GEL_MIN_DURATION = 90;
const GEL_FIRST_MIN = 40;
const GEL_EVERY_MIN = 45;

/** Durata stimata della seduta in minuti (dalla durata o dai km al passo dato). */
export function estimateDurationMin(s: Session, paceSecPerKm = DEFAULT_EASY_PACE): number {
  if (s.durationMin !== undefined) return s.durationMin;
  if (s.km !== undefined) return (s.km * paceSecPerKm) / 60;
  return 0;
}

/** Minuti a cui prendere un gel (1 ogni 40–45'), vuoto se la seduta non supera 90'. */
export function gelSchedule(durationMin: number): number[] {
  if (durationMin <= GEL_MIN_DURATION) return [];
  const times: number[] = [];
  for (let t = GEL_FIRST_MIN; t < durationMin; t += GEL_EVERY_MIN) times.push(t);
  return times;
}

export function gelAdvice(s: Session, paceSecPerKm = DEFAULT_EASY_PACE): Advice | undefined {
  const dur = estimateDurationMin(s, paceSecPerKm);
  const times = gelSchedule(dur);
  if (times.length === 0 || !isRunSession(s)) return undefined;
  return {
    rule: "R6",
    level: "info",
    title: `Gel: ${times.length} da portare`,
    message: `Seduta da ~${Math.round(dur)}': un gel al minuto ${times.join(", ")} (con acqua). Provali in allenamento, mai novità il giorno della gara.`,
  };
}

/* ------------------------------------------------------------------ R7 */

/** Mezza di prova: ≤ 1:54:00 = sub 4 realistico. */
export const HALF_CHECKPOINT_SEC = 114 * 60;
export const HALF_DATE: IsoDate = "2027-02-14";
const HALF_KM = 21.0975;
const MARATHON_KM = 42.195;

export interface HalfEvaluation {
  onTrack: boolean;
  /** Proiezione maratona (Riegel, esp. 1,06), in secondi. */
  projectedMarathonSec: number;
  /** Se non in linea: intervallo di target proposto (secondi), arrotondato a 5'. */
  proposedTarget?: { fastSec: number; slowSec: number };
}

export function evaluateHalf(timeSec: number): HalfEvaluation {
  if (!(timeSec > 0)) throw new RangeError("Tempo non valido");
  const projected = timeSec * Math.pow(MARATHON_KM / HALF_KM, 1.06);
  if (timeSec <= HALF_CHECKPOINT_SEC) return { onTrack: true, projectedMarathonSec: projected };
  const fast = Math.floor(projected / 300) * 300;
  return { onTrack: false, projectedMarathonSec: projected, proposedTarget: { fastSec: fast, slowSec: fast + 300 } };
}

export function formatHms(sec: number): string {
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function halfAdvice(timeSec: number): Advice {
  const e = evaluateHalf(timeSec);
  if (e.onTrack) {
    return {
      rule: "R7",
      level: "info",
      title: "Mezza ≤ 1:54: sub 4 realistico",
      message: `${formatHms(timeSec)} in mezza: proiezione ~${formatHms(e.projectedMarathonSec)}. Target 5:41/km confermato.`,
    };
  }
  const t = e.proposedTarget!;
  return {
    rule: "R7",
    level: "warning",
    title: "Mezza oltre 1:54: rivedi il target",
    message: `${formatHms(timeSec)} in mezza: proiezione ~${formatHms(e.projectedMarathonSec)}. Invece di forzare, valuta un target di ${formatHms(t.fastSec)}–${formatHms(t.slowSec)}.`,
  };
}

/* ------------------------------------------------------------------ R8 */

/** Easy facoltativa del venerdì: dalla settimana 5 (fine dicembre), solo se le gambe stanno bene. */
export const EXTRA_EASY_FROM_WEEK = 5;
/** Mai nelle settimane di scarico (9), della mezza di prova (11) e di tapering/gara (14, 15). */
export const EXTRA_EASY_EXCLUDED_WEEKS: readonly number[] = [9, 11, 14, 15];
export const EXTRA_EASY_MIN = 35;
const EXTRA_PAIN_LIMIT = 3;
const EXTRA_PAIN_WINDOW_DAYS = 21;
const EXTRA_HEAVY_WINDOW_DAYS = 14;

export interface ExtraEasyInput {
  weekIndex: number;
  today: IsoDate;
  checkIns: readonly CheckIn[];
  stopActive: boolean;
  /** Km pianificati della settimana (senza la facoltativa). */
  plannedKm: number;
  /** Km reali dell'ultima settimana normale, se noti. */
  baseKm?: number;
  /** Km stimati della facoltativa. */
  extraKm: number;
}

export interface ExtraEasyStatus {
  eligible: boolean;
  /** Perché non è attiva (vuoto se eligible). */
  reasons: string[];
}

const daysBetween = (from: IsoDate, to: IsoDate): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** R8: la quarta corsa si accende solo se non ci sono segnali di allarme su tibie/polpacci e il carico regge. */
export function extraEasyStatus(i: ExtraEasyInput): ExtraEasyStatus {
  const reasons: string[] = [];
  if (i.weekIndex < EXTRA_EASY_FROM_WEEK) reasons.push("Parte dalla settimana 5 (fine dicembre).");
  else if (EXTRA_EASY_EXCLUDED_WEEKS.includes(i.weekIndex)) reasons.push("Settimana di scarico, della mezza o di tapering: niente corsa in più.");
  if (i.stopActive) reasons.push("La corsa è sospesa per dolore alla tibia (R3).");
  const recent = (days: number) => i.checkIns.filter((c) => c.date <= i.today && daysBetween(c.date, i.today) < days);
  if (recent(EXTRA_PAIN_WINDOW_DAYS).some((c) => (c.painLocation === "tibia" || c.painLocation === "polpaccio") && c.pain >= EXTRA_PAIN_LIMIT))
    reasons.push("Dolore a tibie o polpacci a 3/10 o più nelle ultime 3 settimane.");
  if (recent(EXTRA_HEAVY_WINDOW_DAYS).some((c) => c.heavyLegs === true)) reasons.push("Gambe pesanti nelle ultime 2 settimane.");
  if (i.baseKm !== undefined && i.baseKm > 0 && i.plannedKm + i.extraKm > i.baseKm * (1 + MAX_WEEKLY_INCREASE) + 0.05)
    reasons.push("Con la facoltativa supereresti il +10% di km (R1).");
  return { eligible: reasons.length === 0, reasons };
}

export function extraEasySession(weekday: Session["weekday"]): Session {
  return {
    weekday,
    kind: "easy",
    durationMin: EXTRA_EASY_MIN,
    optional: true,
    description: `Easy facoltativa ${EXTRA_EASY_MIN}' in Z2, solo se le gambe stanno bene. Nel dubbio: bici Z2 o riposo.`,
  };
}
