import type { IsoDate, Week, Weekday } from "./types";

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
}

export interface Workout {
  id: string;
  name: string;
  /** Giorno fisso della settimana (lun/ven nel piano). */
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
        ex({ id: "panca", name: "Panca piana", sets: 3, repMin: 6, repMax: 8, incrementKg: 2.5, group: "forza" }),
        ex({ id: "alzate-a", name: "Alzate laterali", sets: 3, repMin: 12, repMax: 15, incrementKg: 1, group: "forza" }),
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
        ex({ id: "tirata", name: "Tirata orizzontale", sets: 3, repMin: 8, repMax: 10, incrementKg: 2.5, group: "forza" }),
        ex({ id: "alzate-b", name: "Alzate laterali", sets: 3, repMin: 12, repMax: 15, incrementKg: 1, group: "forza" }),
        ex({ id: "calf-piegata", name: "Calf raise a ginocchio piegato (soleo)", sets: 3, repMin: 12, repMax: 15, incrementKg: 2, group: "prevenzione", note: "Ginocchio piegato; scendi in 3 secondi." }),
        ex({ id: "tibialis-b", name: "Tibialis raise", sets: 3, repMin: 15, repMax: 20, incrementKg: 2.5, group: "prevenzione" }),
      ],
    },
  ];
}

export interface GymWeekContext {
  /** Settimana di scarico: una serie in meno per esercizio. */
  deload: boolean;
  /** Ultime due settimane prima della gara: gambe dimezzate, parte alta invariata. */
  taper: boolean;
  /** Qualità dura il martedì (soglia 2×15', salite 6×2'): lo squat scende a 2 serie. */
  hardQuality: boolean;
}

const TAPER_FROM_WEEK = 14;

/** Contesto della settimana di corsa per dosare il lavoro in palestra. */
export function gymContext(week: Week | undefined): GymWeekContext {
  if (!week) return { deload: false, taper: false, hardQuality: false };
  const tue = week.sessions.find((x) => x.weekday === "mar");
  return {
    deload: week.deload,
    taper: week.index >= TAPER_FROM_WEEK,
    hardQuality: tue !== undefined && (tue.description.includes("2×15") || tue.description.includes("6×2'")),
  };
}

/** Serie previste per un esercizio in quella settimana. */
export function effectiveSets(e: Exercise, c: GymWeekContext): number {
  let n = e.sets;
  if (c.hardQuality && e.id === "squat") n = Math.min(n, 2);
  if (c.taper && e.group === "gambe") n = Math.ceil(n / 2);
  if (c.deload) n = Math.max(1, n - 1);
  return n;
}

export function gymWeekNotes(c: GymWeekContext): string[] {
  const out: string[] = [];
  if (c.deload) out.push("Settimana di scarico: una serie in meno per esercizio.");
  if (c.taper) out.push("Ultime settimane prima della gara: gambe dimezzate, parte alta invariata.");
  if (c.hardQuality) out.push("Qualità dura martedì: squat a 2 serie.");
  return out;
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
