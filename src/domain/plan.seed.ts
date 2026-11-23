import type { IsoDate, Phase, Session, Week, PhaseId } from "./types";

/**
 * Piano base (HANDOFF §4). IMMUTABILE: le modifiche del coach sono override
 * con motivo, mai riscritture di questo file.
 */

export const RACE_DATE: IsoDate = "2027-03-14";

export const PHASES: readonly Phase[] = [
  { id: 0, name: "Avvicinamento", focus: "Scarico + trail easy", start: "2026-11-23", end: "2026-11-29" },
  { id: 1, name: "Base", focus: "Z2, tibie/polpacci, salite corte", start: "2026-11-30", end: "2026-12-27" },
  { id: 2, name: "Sviluppo", focus: "Soglia + RM nel lungo, salite 60–90\"", start: "2026-12-28", end: "2027-02-07" },
  { id: 3, name: "Specifica", focus: "Blocchi a RM, salite 2' a settimane alterne", start: "2027-02-08", end: "2027-02-28" },
  { id: 4, name: "Scarico", focus: "Volume giù, intensità mantenuta", start: "2027-03-01", end: "2027-03-14" },
];

const FIRST_MONDAY = Date.UTC(2026, 10, 23);
const DAY_MS = 86_400_000;

const isoAddDays = (days: number): IsoDate =>
  new Date(FIRST_MONDAY + days * DAY_MS).toISOString().slice(0, 10);

const phaseOf = (index: number): PhaseId => {
  if (index === 0) return 0;
  if (index <= 4) return 1;
  if (index <= 10) return 2;
  if (index <= 13) return 3;
  return 4;
};

const DELOAD_WEEKS = [4, 9];

const GYM_LUN: Session = {
  weekday: "lun",
  kind: "gym",
  description: "Palestra full body A: squat, chin-up zavorrati, panca. Prevenzione: calf raise, tibialis raise",
};
const GYM_MER: Session = {
  weekday: "mer",
  kind: "gym",
  description: "Palestra full body B: military, stacco a gambe tese, bulgari, tirata. Prevenzione: calf raise (soleo), tibialis raise",
};
const REST_MER: Session = { weekday: "mer", kind: "rest", description: "Riposo o bici Z2" };
const REST_VEN: Session = { weekday: "ven", kind: "rest", description: "Riposo" };
const REST_SAB: Session = { weekday: "sab", kind: "rest", description: "Riposo" };

type Spec = Omit<Session, "weekday">;

/** Costruisce la settimana: palestra lun/mer (gambe spezzate), riposo ven/sab, corse mar/gio/dom. */
function week(index: number, mar: Spec, gio: Spec, dom: Spec, opts: { gym?: boolean } = {}): Week {
  const gym = opts.gym ?? true;
  const sessions: Session[] = [
    ...(gym ? [GYM_LUN] : []),
    { weekday: "mar", ...mar },
    gym ? GYM_MER : REST_MER,
    { weekday: "gio", ...gio },
    REST_VEN,
    REST_SAB,
    { weekday: "dom", ...dom },
  ];
  return {
    index,
    start: isoAddDays(index * 7),
    end: isoAddDays(index * 7 + 6),
    phase: phaseOf(index),
    deload: DELOAD_WEEKS.includes(index),
    sessions,
  };
}

const easy = (min: number, description?: string): Spec => ({
  kind: "easy",
  description: description ?? `${min}' easy`,
  durationMin: min,
});
const hills = (reps: string, description: string): Spec => ({
  kind: "hills",
  description: `Salite ${reps}. ${description}`,
});
const threshold = (description: string): Spec => ({ kind: "threshold", description });
const longEasy = (km: number): Spec => ({ kind: "long", description: `${km} km easy`, km });

const WARM = "15' easy di riscaldamento, 10' di defaticamento";

export const PLAN_WEEKS: readonly Week[] = [
  week(0, easy(45), easy(30), {
    kind: "trail",
    description: "Trail 25 km easy, salite camminate, prova gel ogni 40–45'",
    km: 25,
  }),
  week(1, easy(40, "40' easy (recupero trail)"), {
    kind: "threshold_test",
    description: "Test soglia 30': a riposo da 48h, in piano. 15' di riscaldamento, 30' al massimo sostenibile costante",
    durationMin: 30,
  }, longEasy(14)),
  week(2, hills("6×30\"", WARM), easy(45), longEasy(16)),
  week(3, hills("8×30\"", WARM), easy(45, "45' easy + 6 allunghi"), longEasy(18)),
  week(4, easy(40, "Scarico: 40' easy + 4 allunghi"), easy(35), longEasy(14)),
  week(5, hills("6×60\"", WARM), easy(50), longEasy(18)),
  week(6, threshold(`Soglia 3×8' (rec. 2'). ${WARM}`), easy(50), {
    kind: "long_rm",
    description: "20 km, ultimi 4 a RM (5:40/km)",
    km: 20,
    rmKm: 4,
  }),
  week(7, hills("8×60\"", WARM), easy(50), longEasy(22)),
  week(8, threshold(`Soglia 3×10' (rec. 2'). ${WARM}`), easy(55), {
    kind: "long_rm",
    description: "24 km con 8 a RM (5:40/km)",
    km: 24,
    rmKm: 8,
  }),
  week(9, hills("6×60\"", `Scarico. ${WARM}`), easy(40), longEasy(16)),
  week(10, threshold(`Soglia 2×15' (rec. 3'). ${WARM}`), easy(55), longEasy(26)),
  week(11, hills("6×90\"", WARM), easy(45), {
    kind: "half_test",
    description: "Mezza di prova: obiettivo ≤1:54 (5:24/km)",
    km: 21.1,
  }),
  week(12, easy(50), {
    kind: "rm_blocks",
    description: "10 km con 6 a RM (5:40/km)",
    km: 10,
    rmKm: 6,
  }, longEasy(28)),
  week(13, hills("6×2'", WARM), {
    kind: "rm_blocks",
    description: "60' con 8 km a RM (5:40/km)",
    durationMin: 60,
    rmKm: 8,
  }, {
    kind: "long_rm",
    description: "32 km, ultimi 12 a RM (5:40/km)",
    km: 32,
    rmKm: 12,
  }),
  week(14, {
    kind: "rm_blocks",
    description: `3×3 km a RM (rec. 3'). ${WARM}`,
    rmKm: 9,
  }, easy(45), {
    kind: "long_rm",
    description: "20 km con 10 a RM (5:40/km)",
    km: 20,
    rmKm: 10,
  }),
  // Settimana della gara: niente palestra.
  week(
    15,
    { kind: "rm_blocks", description: "40' con 3 km a RM (5:40/km)", durationMin: 40, rmKm: 3 },
    easy(25, "25' easy + 4 allunghi"),
    {
      kind: "race",
      description: "Run Rome The Marathon, ore 8:30. Obiettivo sub 4h (5:41/km)",
      km: 42.195,
    },
    { gym: false },
  ),
];
