import type { IsoDate, Weekday } from "./types";

/** Scheda di palestra: logica pura. La scheda è modificabile dall'utente; questa è quella di partenza. */

export type ExerciseGroup = "forza" | "postura" | "prevenzione";

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
 * Scheda di partenza (HANDOFF §2/§4): full body 2×/settimana, forza, postura, gambe/glutei, spalle/schiena,
 * con la prevenzione tibie/polpacci. Venerdì gambe leggere: niente gambe pesanti nei 2 giorni prima del lungo.
 * È una proposta: nomi, serie e range si cambiano dall'app.
 */
export function defaultGymPlan(): Workout[] {
  return [
    {
      id: "A",
      name: "Full body A",
      weekday: "lun",
      focus: "Forza gambe e glutei, spinta e trazione",
      exercises: [
        ex({ id: "squat", name: "Squat", sets: 3, repMin: 5, repMax: 8, incrementKg: 5, group: "forza" }),
        ex({ id: "panca", name: "Panca piana", sets: 3, repMin: 6, repMax: 10, incrementKg: 2.5, group: "forza" }),
        ex({ id: "rematore", name: "Rematore con bilanciere", sets: 3, repMin: 8, repMax: 10, incrementKg: 2.5, group: "forza" }),
        ex({ id: "hip-thrust", name: "Hip thrust", sets: 3, repMin: 8, repMax: 12, incrementKg: 5, group: "forza" }),
        ex({ id: "lento", name: "Lento avanti con manubri", sets: 3, repMin: 8, repMax: 10, incrementKg: 2, group: "forza" }),
        ex({ id: "calf-tesa", name: "Calf raise eccentrico su gradino (gamba tesa)", sets: 3, repMin: 12, repMax: 15, incrementKg: 2, group: "prevenzione", note: "Scendi lentamente (3 secondi)." }),
        ex({ id: "tibialis-a", name: "Tibialis raise", sets: 3, repMin: 15, repMax: 20, incrementKg: 2.5, group: "prevenzione" }),
      ],
    },
    {
      id: "B",
      name: "Full body B",
      weekday: "ven",
      focus: "Gambe leggere (domenica c'è il lungo), schiena e spalle, prevenzione",
      exercises: [
        ex({ id: "slrdl", name: "Stacco a una gamba (single-leg RDL)", sets: 3, repMin: 8, repMax: 10, incrementKg: 2, noIncrease: true, group: "prevenzione", note: "Gambe leggere: carico basso, controllo." }),
        ex({ id: "lat", name: "Lat machine / trazioni", sets: 3, repMin: 6, repMax: 10, incrementKg: 2.5, group: "forza" }),
        ex({ id: "inclinata", name: "Panca inclinata con manubri", sets: 3, repMin: 8, repMax: 10, incrementKg: 2, group: "forza" }),
        ex({ id: "pulley", name: "Rematore al cavo", sets: 3, repMin: 10, repMax: 12, incrementKg: 2.5, group: "forza" }),
        ex({ id: "alzate", name: "Alzate laterali", sets: 3, repMin: 12, repMax: 15, incrementKg: 1, group: "forza" }),
        ex({ id: "face-pull", name: "Face pull", sets: 3, repMin: 12, repMax: 15, incrementKg: 2.5, group: "postura" }),
        ex({ id: "calf-piegata", name: "Calf raise eccentrico su gradino (gamba piegata)", sets: 3, repMin: 12, repMax: 15, incrementKg: 2, group: "prevenzione", note: "Scendi lentamente (3 secondi)." }),
        ex({ id: "tibialis-b", name: "Tibialis raise", sets: 3, repMin: 15, repMax: 20, incrementKg: 2.5, group: "prevenzione" }),
        ex({ id: "dead-bug", name: "Dead bug", sets: 3, repMin: 8, repMax: 12, incrementKg: 0, group: "postura", note: "Per lato." }),
      ],
    },
  ];
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
