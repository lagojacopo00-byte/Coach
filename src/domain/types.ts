/** Tipi del dominio. Nessun I/O: solo forme dei dati. Date come stringhe ISO "YYYY-MM-DD". */

export type IsoDate = string;

export const WEEKDAYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const PHASE_IDS = [0, 1, 2, 3, 4] as const;
export type PhaseId = (typeof PHASE_IDS)[number];

export interface Phase {
  id: PhaseId;
  name: string;
  focus: string;
  start: IsoDate;
  end: IsoDate;
}

export const SESSION_KINDS = [
  "easy", // corsa facile, talk test
  "hills", // ripetute in salita
  "threshold", // soglia
  "long", // lungo domenicale
  "long_rm", // lungo con tratti a ritmo maratona
  "rm_blocks", // blocchi a ritmo maratona fuori dal lungo
  "threshold_test", // test soglia 30'
  "trail", // trail di gara/prova
  "half_test", // mezza di prova
  "race", // maratona
  "gym", // palestra full body
  "bike", // bici Z2 (sostituzione o riposo attivo)
  "rest",
] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

/** Una seduta pianificata. Il seed è immutabile: le modifiche sono Adjustment. */
export interface Session {
  weekday: Weekday;
  kind: SessionKind;
  description: string;
  /** Durata prevista in minuti, se il piano la indica a tempo. */
  durationMin?: number;
  /** Distanza prevista in km, se il piano la indica a distanza. */
  km?: number;
  /** Km previsti a ritmo maratona dentro la seduta. */
  rmKm?: number;
}

export interface Week {
  /** 0 = avvicinamento, 15 = settimana della maratona. */
  index: number;
  start: IsoDate; // lunedì
  end: IsoDate; // domenica
  phase: PhaseId;
  /** Settimana di scarico (nel piano: 4 e 9). */
  deload: boolean;
  sessions: Session[];
}

export const RUN_FEELINGS = ["ottime", "buone", "normali", "pesanti", "pessime"] as const;
export type RunFeeling = (typeof RUN_FEELINGS)[number];

export type PainLocation = "tibia" | "polpaccio" | "altro";
export type PainType = "diffuso" | "puntiforme";

/** Una corsa registrata. Il passo si deriva da km e tempo, ma può essere salvato. */
export interface Run {
  id: string;
  date: IsoDate;
  kind: SessionKind;
  km: number;
  durationSec: number;
  avgPaceSecPerKm?: number;
  avgHr?: number;
  elevationGainM?: number;
  feeling?: RunFeeling;
  /** Dolore 0–10. */
  pain: number;
  painLocation?: PainLocation;
  painType?: PainType;
  /** Gambe pesanti riportate. */
  heavyLegs?: boolean;
  notes?: string;
}

export interface Profile {
  name: string;
  age?: number;
  restingHr?: number;
  maxHr?: number;
  /** FC di soglia dal test 30' (media degli ultimi 20'). */
  lthr?: number;
  /** Ritmo soglia/10 km in sec/km, dal test. */
  thresholdPaceSecPerKm?: number;
  /** Target maratona in sec/km (default 5:41 = 341). */
  targetPaceSecPerKm: number;
  raceDate: IsoDate;
  /** Giorni fissi di default: corsa mar/gio/dom, palestra lun/ven. */
  runDays: Weekday[];
  gymDays: Weekday[];
}

/** Come stanno le gambe in un giorno (da check-in o dal log di una corsa). */
export interface CheckIn {
  date: IsoDate;
  /** Dolore 0–10. */
  pain: number;
  painLocation?: PainLocation;
  painType?: PainType;
  heavyLegs?: boolean;
}

export const RULE_IDS = ["R1", "R2", "R3", "R4", "R5", "R6", "R7"] as const;
export type RuleId = (typeof RULE_IDS)[number];

export type AdviceLevel = "info" | "warning" | "stop";

/** Messaggio del coach, sempre con la regola che l'ha prodotto. */
export interface Advice {
  rule: RuleId;
  level: AdviceLevel;
  title: string;
  message: string;
  /** Rimanda a un professionista (medico/fisioterapista). */
  seeProfessional?: boolean;
}

/**
 * Override del piano: sostituisce una seduta del seed con un'altra, con motivo.
 * Il seed non viene mai riscritto.
 */
export interface Adjustment {
  rule: RuleId;
  weekIndex: number;
  weekday: Weekday;
  date: IsoDate;
  original: Session;
  replacement: Session;
  reason: string;
}

export const SKIP_REASONS = ["stanco", "dolore", "impegni", "malattia", "altro"] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

/** Seduta di corsa saltata, segnata a mano (R4: non si recupera). */
export interface Skip {
  date: IsoDate;
  reason?: SkipReason;
}
