import type { IsoDate, Week, Weekday } from "./types";
import { addDays } from "./week";

/** Scheda di palestra: logica pura. La scheda è modificabile dall'utente; questa è quella di partenza. */

export type ExerciseGroup = "forza" | "gambe" | "postura" | "prevenzione";

export interface Exercise {
  /** Stabile: lo storico si aggancia all'id, non al nome. */
  id: string;
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  /** Quanto salire (kg) quando completi tutte le serie al massimo delle ripetizioni. */
  incrementKg: number;
  /** Non proporre aumenti (es. gambe leggere prima del lungo). */
  noIncrease?: boolean;
  group?: ExerciseGroup;
  note?: string;
  /**
   * Volume che cresce nel tempo, deciso dal coach: da ognuna di queste settimane del piano si aggiunge
   * una serie (se ti stai allenando con continuità). Le serie non si impostano a mano.
   */
  extraSetFromWeeks?: number[];
}

export interface Workout {
  id: string;
  name: string;
  /** Giorno fisso della settimana (lun/mer nel piano). */
  weekday: Weekday;
  focus: string;
  exercises: Exercise[];
}

export interface GymSet {
  /** 0 = peso corpo. */
  weightKg: number;
  reps: number;
}

export interface GymEntry {
  exerciseId: string;
  /** Nome al momento del log (resta leggibile anche se poi lo rinomini). */
  name: string;
  sets: GymSet[];
}

export interface GymLog {
  id: string;
  date: IsoDate;
  workoutId: string;
  entries: GymEntry[];
  notes?: string;
}

const ex = (e: Exercise): Exercise => e;

/**
 * Scheda concordata con Jacopo (23/11/2026): due full body con le gambe spezzate, così nessun giorno è un
 * "leg day". A il lunedì (squat leggero prima della qualità del martedì), B il mercoledì (stacchi e bulgari:
 * dopo la qualità, con solo un easy il giorno dopo e il lungo 4 giorni più avanti).
 * Prevenzione tibie/polpacci in fondo a entrambi. Nomi, serie e range si cambiano dall'app.
 */
export function defaultGymPlan(): Workout[] {
  return [
    {
      id: "A",
      name: "Full body A",
      weekday: "lun",
      focus: "Squat, trazione verticale (chin-up), panca",
      exercises: [
        ex({ id: "squat", name: "Squat", sets: 3, repMin: 5, repMax: 6, incrementKg: 5, group: "gambe", note: "Fermati con 2 ripetizioni di riserva." }),
        ex({ id: "chin-up", name: "Chin-up zavorrati", sets: 5, repMin: 5, repMax: 8, incrementKg: 2.5, group: "forza", note: "Il peso è la zavorra aggiunta." }),
        ex({ id: "panca", name: "Panca piana", sets: 3, repMin: 6, repMax: 8, incrementKg: 2.5, group: "forza", extraSetFromWeeks: [5] }),
        ex({ id: "alzate-a", name: "Alzate laterali", sets: 3, repMin: 12, repMax: 15, incrementKg: 1, group: "forza", extraSetFromWeeks: [5, 10] }),
        ex({ id: "calf-tesa", name: "Calf raise in piedi, discesa lenta", sets: 3, repMin: 12, repMax: 15, incrementKg: 2, group: "prevenzione", note: "Gamba tesa; scendi in 3 secondi." }),
        ex({ id: "tibialis-a", name: "Tibialis raise", sets: 3, repMin: 15, repMax: 20, incrementKg: 2.5, group: "prevenzione" }),
      ],
    },
    {
      id: "B",
      name: "Full body B",
      weekday: "mer",
      focus: "Military press, stacco a gambe tese, bulgari, tirata orizzontale",
      exercises: [
        ex({ id: "military", name: "Military press", sets: 4, repMin: 5, repMax: 8, incrementKg: 2.5, group: "forza" }),
        ex({ id: "rdl", name: "Stacco a gambe tese", sets: 3, repMin: 6, repMax: 8, incrementKg: 5, group: "gambe" }),
        ex({ id: "bulgari", name: "Affondi bulgari", sets: 3, repMin: 8, repMax: 10, incrementKg: 2, group: "gambe", note: "Per gamba; il peso è il carico totale." }),
        ex({ id: "tirata", name: "Tirata orizzontale", sets: 3, repMin: 8, repMax: 10, incrementKg: 2.5, group: "forza", extraSetFromWeeks: [5] }),
        ex({ id: "alzate-b", name: "Alzate laterali", sets: 3, repMin: 12, repMax: 15, incrementKg: 1, group: "forza", extraSetFromWeeks: [5, 10] }),
        ex({ id: "calf-piegata", name: "Calf raise a ginocchio piegato (soleo)", sets: 3, repMin: 12, repMax: 15, incrementKg: 2, group: "prevenzione", note: "Ginocchio piegato; scendi in 3 secondi." }),
        ex({ id: "tibialis-b", name: "Tibialis raise", sets: 3, repMin: 15, repMax: 20, incrementKg: 2.5, group: "prevenzione" }),
      ],
    },
  ];
}

export interface GymWeekContext {
  /** Indice della settimana del piano (0 se fuori dal piano). */
  weekIndex: number;
  /** Settimana di scarico: una serie in meno per esercizio. */
  deload: boolean;
  /** Ultime due settimane prima della gara: gambe dimezzate, parte alta invariata. */
  taper: boolean;
  /** Qualità dura il martedì (soglia 2×15', salite 6×2'): lo squat scende a 2 serie. */
  hardQuality: boolean;
  /** Ti stai allenando con continuità: solo allora il volume può salire. */
  consistent: boolean;
}

const TAPER_FROM_WEEK = 14;
/** Per far salire il volume servono almeno 3 allenamenti registrati nelle ultime 3 settimane. */
export const CONSISTENCY_MIN_LOGS = 3;
export const CONSISTENCY_WINDOW_DAYS = 21;

export function isConsistent(logs: readonly GymLog[], date: IsoDate): boolean {
  const from = addDays(date, -CONSISTENCY_WINDOW_DAYS);
  return logs.filter((l) => l.date >= from && l.date < date).length >= CONSISTENCY_MIN_LOGS;
}

/** Contesto della settimana di corsa (e dei tuoi log) per dosare il lavoro in palestra. */
export function gymContext(week: Week | undefined, opts?: { logs: readonly GymLog[]; date: IsoDate }): GymWeekContext {
  const consistent = opts ? isConsistent(opts.logs, opts.date) : false;
  if (!week) return { weekIndex: 0, deload: false, taper: false, hardQuality: false, consistent };
  const tue = week.sessions.find((x) => x.weekday === "mar");
  return {
    weekIndex: week.index,
    deload: week.deload,
    taper: week.index >= TAPER_FROM_WEEK,
    hardQuality: tue !== undefined && (tue.description.includes("2×15") || tue.description.includes("6×2'")),
    consistent,
  };
}

/** Serie aggiunte dal coach per far crescere il volume (0 se non è il momento). */
export function volumeBonus(e: Exercise, c: GymWeekContext): number {
  if (!c.consistent || !e.extraSetFromWeeks) return 0;
  return e.extraSetFromWeeks.filter((w) => w <= c.weekIndex).length;
}

/**
 * Serie previste per un esercizio in quella settimana: decide il coach, non l'utente.
 * Volume che sale (se ti alleni con continuità), poi squat leggero con qualità dura, gambe dimezzate
 * nel tapering e una serie in meno in scarico.
 */
export function effectiveSets(e: Exercise, c: GymWeekContext): number {
  let n = e.sets + volumeBonus(e, c);
  if (c.hardQuality && e.id === "squat") n = Math.min(n, 2);
  if (c.taper && e.group === "gambe") n = Math.ceil(n / 2);
  if (c.deload) n = Math.max(1, n - 1);
  return n;
}

/** Perché le serie di oggi sono diverse da quelle di base (vuoto se uguali). */
export function setsChangeNote(e: Exercise, c: GymWeekContext): string | undefined {
  const eff = effectiveSets(e, c);
  if (eff === e.sets) return undefined;
  if (eff > e.sets) return `+${eff - e.sets} serie: volume in crescita`;
  if (c.deload) return `${eff - e.sets} serie: scarico`;
  if (c.taper) return `${eff - e.sets} serie: gambe dimezzate prima della gara`;
  return `${eff - e.sets} serie: qualità dura il martedì`;
}

export function gymWeekNotes(c: GymWeekContext): string[] {
  const out: string[] = [];
  if (c.deload) out.push("Settimana di scarico: una serie in meno per esercizio.");
  if (c.taper) out.push("Ultime settimane prima della gara: gambe dimezzate, parte alta invariata.");
  if (c.hardQuality) out.push("Qualità dura martedì: squat a 2 serie.");
  return out;
}

/** Bozza dell'allenamento: quello che hai scritto finora, salvato a ogni modifica. */
export interface GymDraftRow {
  w: string;
  r: string;
  /** Peso scritto a mano su questa serie: non viene sovrascritto dal carico copiato dalle altre. */
  manual?: boolean;
}

export interface GymDraft {
  date: IsoDate;
  workoutId: string;
  rows: Record<string, GymDraftRow[]>;
  notes: string;
}

const numOf = (v: string): number => (v.trim() === "" ? NaN : Number(v.trim().replace(",", ".")));

/** Dalla bozza all'allenamento: conta solo le serie con ripetizioni valide. Undefined se non c'è nessuna serie fatta. */
export function draftToLog(draft: GymDraft, workout: Workout): GymLog | undefined {
  const entries: GymEntry[] = [];
  for (const ex of workout.exercises) {
    const sets: GymSet[] = [];
    for (const row of draft.rows[ex.id] ?? []) {
      const reps = numOf(row.r);
      if (!Number.isInteger(reps) || reps < 1) continue;
      const weightKg = row.w.trim() === "" ? 0 : numOf(row.w);
      if (!Number.isFinite(weightKg) || weightKg < 0) continue;
      sets.push({ weightKg, reps });
    }
    if (sets.length > 0) entries.push({ exerciseId: ex.id, name: ex.name, sets });
  }
  if (entries.length === 0) return undefined;
  return { id: `gym-${draft.date}-${draft.workoutId}`, date: draft.date, workoutId: draft.workoutId, entries, ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}) };
}

/** Scrivi il carico su una serie: si copia sulle altre che non hai scritto a mano. Le ripetizioni restano tue. */
export function setWeight(rows: readonly GymDraftRow[], index: number, value: string): GymDraftRow[] {
  return rows.map((row, j) => (j === index ? { ...row, w: value, manual: true } : row.manual ? row : { ...row, w: value }));
}

/** Controlla la scheda: id unici, nomi, serie e range sensati. Ritorna gli errori (vuoto = ok). */
export function validateGymPlan(plan: readonly Workout[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const workoutIds = new Set<string>();
  for (const w of plan) {
    if (!w.name.trim()) errors.push("Un allenamento non ha nome.");
    if (workoutIds.has(w.id)) errors.push(`Allenamento duplicato: ${w.id}`);
    workoutIds.add(w.id);
    for (const e of w.exercises) {
      if (!e.name.trim()) errors.push(`In ${w.name} c'è un esercizio senza nome.`);
      if (ids.has(e.id)) errors.push(`Esercizio duplicato: ${e.id}`);
      ids.add(e.id);
      if (!(Number.isInteger(e.sets) && e.sets >= 1 && e.sets <= 10)) errors.push(`${e.name}: le serie vanno da 1 a 10.`);
      if (!(Number.isInteger(e.repMin) && Number.isInteger(e.repMax) && e.repMin >= 1 && e.repMin <= e.repMax && e.repMax <= 100))
        errors.push(`${e.name}: range di ripetizioni non valido.`);
      if (!(e.incrementKg >= 0 && e.incrementKg <= 20)) errors.push(`${e.name}: incremento non valido (0–20 kg).`);
    }
  }
  return errors;
}

export function validateGymLog(log: GymLog): string | undefined {
  if (log.entries.length === 0) return "Inserisci almeno un esercizio.";
  for (const e of log.entries)
    for (const s of e.sets) {
      if (!(s.weightKg >= 0 && s.weightKg <= 500)) return `${e.name}: peso non valido.`;
      if (!(Number.isInteger(s.reps) && s.reps >= 1 && s.reps <= 100)) return `${e.name}: ripetizioni non valide.`;
    }
  return undefined;
}

const byDateAsc = (a: GymLog, b: GymLog) => a.date.localeCompare(b.date);

/** Le serie dell'ultima volta (prima di `before`, se dato) in cui hai fatto l'esercizio. */
export function lastSets(logs: readonly GymLog[], exerciseId: string, before?: IsoDate): { date: IsoDate; sets: GymSet[] } | undefined {
  const sorted = [...logs].sort(byDateAsc).filter((l) => before === undefined || l.date < before);
  for (let i = sorted.length - 1; i >= 0; i--) {
    const entry = sorted[i].entries.find((e) => e.exerciseId === exerciseId && e.sets.length > 0);
    if (entry) return { date: sorted[i].date, sets: entry.sets };
  }
  return undefined;
}

export type SuggestionKind = "increase" | "repeat" | "hold";

export interface Suggestion {
  kind: SuggestionKind;
  weightKg: number;
  /** Ripetizioni da cercare per serie. */
  targetReps: number;
  text: string;
}

const fmtKg = (n: number): string => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")} kg`;

/**
 * Doppia progressione: finché non chiudi tutte le serie al massimo delle ripetizioni resti sullo stesso peso
 * e cerchi di salire di ripetizioni; quando le chiudi tutte, sali di peso e riparti dal minimo.
 * Non scala mai il carico da sola: una giornata storta non cancella i progressi.
 */
export function suggestNext(exercise: Exercise, last: GymSet[] | undefined): Suggestion | undefined {
  if (!last || last.length === 0) return undefined;
  const work = Math.max(...last.map((s) => s.weightKg));
  const atWork = last.filter((s) => s.weightKg === work);
  const allTop = last.length >= exercise.sets && atWork.length >= exercise.sets && atWork.every((s) => s.reps >= exercise.repMax);
  if (allTop && exercise.noIncrease) {
    return { kind: "hold", weightKg: work, targetReps: exercise.repMax, text: `Resta su ${fmtKg(work)}: ${exercise.note ?? "non si aumenta questo carico"}.` };
  }
  if (allTop && exercise.incrementKg > 0) {
    const w = Math.round((work + exercise.incrementKg) * 100) / 100;
    return { kind: "increase", weightKg: w, targetReps: exercise.repMin, text: `Sali a ${fmtKg(w)} e riparti da ${exercise.repMin} ripetizioni.` };
  }
  if (allTop) {
    return { kind: "hold", weightKg: work, targetReps: exercise.repMax, text: "Hai chiuso tutto al massimo: aggiungi un po' di carico o rallenta la discesa." };
  }
  return {
    kind: "repeat",
    weightKg: work,
    targetReps: exercise.repMax,
    text: `Stesso peso (${fmtKg(work)}): punta a ${exercise.repMax} ripetizioni su tutte le serie.`,
  };
}

/** Tonnellaggio (peso × ripetizioni) di una seduta o di un esercizio. */
export function volumeOf(sets: readonly GymSet[]): number {
  return sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
}

export function logVolume(log: GymLog): number {
  return log.entries.reduce((sum, e) => sum + volumeOf(e.sets), 0);
}

export interface HistoryPoint {
  date: IsoDate;
  topWeightKg: number;
  /** Ripetizioni fatte al peso massimo (la serie migliore). */
  repsAtTop: number;
  volume: number;
}

/** Andamento di un esercizio nel tempo, dal più vecchio al più recente. */
export function exerciseHistory(logs: readonly GymLog[], exerciseId: string): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  for (const l of [...logs].sort(byDateAsc)) {
    const e = l.entries.find((x) => x.exerciseId === exerciseId && x.sets.length > 0);
    if (!e) continue;
    const top = Math.max(...e.sets.map((s) => s.weightKg));
    out.push({
      date: l.date,
      topWeightKg: top,
      repsAtTop: Math.max(...e.sets.filter((s) => s.weightKg === top).map((s) => s.reps)),
      volume: volumeOf(e.sets),
    });
  }
  return out;
}

/** Allenamento previsto per un giorno della settimana, se c'è. */
export function workoutOn(plan: readonly Workout[], weekday: Weekday): Workout | undefined {
  return plan.find((w) => w.weekday === weekday);
}
