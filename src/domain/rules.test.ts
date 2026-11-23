import { describe, expect, it } from "vitest";
import { PLAN_WEEKS } from "./plan.seed";
import {
  applyRecalculation,
  bikeReplacement,
  checkWeeklyIncrease,
  easyReplacement,
  evaluateHalf,
  formatHms,
  gelAdvice,
  gelSchedule,
  halfAdvice,
  missedSessionAdvice,
  recalcFromThresholdTest,
  shouldDowngradeQuality,
  tibiaPointPain,
  tibiaSore,
  tibiaStopAdvice,
  validateThresholdTest,
  weeklyCapAdvice,
  weeklyIncreaseReport,
} from "./rules";
import type { CheckIn, Profile, Session } from "./types";

const hills = PLAN_WEEKS[2].sessions.find((s) => s.weekday === "mar")!;
const easy: Session = { weekday: "gio", kind: "easy", description: "45' easy", durationMin: 45 };
const ci = (over: Partial<CheckIn>): CheckIn => ({ date: "2026-12-08", pain: 0, ...over });

describe("R1 tetto +10%", () => {
  it("accetta fino al +10%, rifiuta oltre", () => {
    expect(checkWeeklyIncrease(33, 30, false).ok).toBe(true);
    expect(checkWeeklyIncrease(34, 30, false).ok).toBe(false);
    expect(checkWeeklyIncrease(34, 30, false).maxKm).toBeCloseTo(33);
  });
  it("le settimane di scarico sono escluse", () => {
    expect(checkWeeklyIncrease(10, 30, true).ok).toBe(true);
    expect(checkWeeklyIncrease(50, 30, true).ok).toBe(true);
  });
  it("senza base non si può violare", () => {
    expect(checkWeeklyIncrease(30, 0, false).ok).toBe(true);
  });
  it("il report sul piano usa come base l'ultima settimana normale (salta lo scarico)", () => {
    const report = weeklyIncreaseReport(PLAN_WEEKS);
    expect(report).toHaveLength(15);
    const w5 = report.find((r) => r.weekIndex === 5)!;
    expect(w5.baseKm).toBeCloseTo(report.find((r) => r.weekIndex === 3)!.plannedKm);
    expect(report.find((r) => r.weekIndex === 4)!.result.ok).toBe(true);
  });
  it("advice solo se oltre il tetto", () => {
    expect(weeklyCapAdvice(PLAN_WEEKS[2], 30, 28)).toBeUndefined();
    const a = weeklyCapAdvice(PLAN_WEEKS[2], 40, 25)!;
    expect(a.rule).toBe("R1");
    expect(a.level).toBe("warning");
    expect(weeklyCapAdvice(PLAN_WEEKS[4], 40, 25)).toBeUndefined(); // scarico
  });
});

describe("R2 gambe pesanti / tibie doloranti", () => {
  it("la qualità diventa easy con gambe pesanti", () => {
    expect(shouldDowngradeQuality(hills, ci({ heavyLegs: true }))).toBe(true);
  });
  it("tibia con dolore ≥3 → easy; 2 no; altra zona no", () => {
    expect(shouldDowngradeQuality(hills, ci({ painLocation: "tibia", pain: 3, painType: "diffuso" }))).toBe(true);
    expect(shouldDowngradeQuality(hills, ci({ painLocation: "tibia", pain: 2 }))).toBe(false);
    expect(shouldDowngradeQuality(hills, ci({ painLocation: "altro", pain: 6 }))).toBe(false);
    expect(tibiaSore(ci({ painLocation: "tibia", pain: 3 }))).toBe(true);
  });
  it("easy e check-in assente non cambiano", () => {
    expect(shouldDowngradeQuality(easy, ci({ heavyLegs: true }))).toBe(false);
    expect(shouldDowngradeQuality(hills, undefined)).toBe(false);
    expect(shouldDowngradeQuality(hills, ci({}))).toBe(false);
  });
  it("test e gara non vengono sostituiti in automatico", () => {
    const test = PLAN_WEEKS[1].sessions.find((s) => s.kind === "threshold_test")!;
    expect(shouldDowngradeQuality(test, ci({ heavyLegs: true }))).toBe(false);
  });
  it("la sostituzione è un easy breve nello stesso giorno", () => {
    const r = easyReplacement(hills);
    expect(r.kind).toBe("easy");
    expect(r.weekday).toBe("mar");
    expect(r.durationMin).toBeGreaterThanOrEqual(30);
    expect(r.durationMin).toBeLessThanOrEqual(45);
  });
});

describe("R3 dolore puntiforme sulla tibia", () => {
  it("scatta solo per tibia + puntiforme + dolore ≥1", () => {
    expect(tibiaPointPain(ci({ painLocation: "tibia", painType: "puntiforme", pain: 1 }))).toBe(true);
    expect(tibiaPointPain(ci({ painLocation: "tibia", painType: "puntiforme", pain: 0 }))).toBe(false);
    expect(tibiaPointPain(ci({ painLocation: "tibia", painType: "diffuso", pain: 7 }))).toBe(false);
    expect(tibiaPointPain(ci({ painLocation: "polpaccio", painType: "puntiforme", pain: 5 }))).toBe(false);
  });
  it("rimanda sempre a un professionista", () => {
    const a = tibiaStopAdvice();
    expect(a.level).toBe("stop");
    expect(a.seeProfessional).toBe(true);
    expect(a.message).toMatch(/medico|fisioterapista/);
    expect(a.message).toMatch(/bici/);
  });
  it("sostituisce con bici", () => {
    expect(bikeReplacement(easy)).toMatchObject({ kind: "bike", weekday: "gio", durationMin: 45 });
  });
});

describe("R4 seduta saltata", () => {
  it("avvisa di non recuperare", () => {
    const a = missedSessionAdvice([easy])!;
    expect(a.rule).toBe("R4");
    expect(a.message).toMatch(/Non si recupera/);
  });
  it("palestra o niente saltato: nessun avviso", () => {
    expect(missedSessionAdvice([])).toBeUndefined();
    expect(missedSessionAdvice([{ weekday: "lun", kind: "gym", description: "" }])).toBeUndefined();
  });
});

describe("R5 ricalcolo dopo il test di soglia", () => {
  it("ricava LTHR, zone e ritmi", () => {
    const r = recalcFromThresholdTest({ last20AvgHr: 171.4, last20PaceSecPerKm: 330 });
    expect(r.lthr).toBe(171);
    expect(r.zones).toHaveLength(5);
    expect(r.easy).toEqual({ fast: 390, slow: 420 });
    const p: Profile = {
      name: "Jacopo",
      targetPaceSecPerKm: 341,
      raceDate: "2027-03-14",
      runDays: ["mar", "gio", "dom"],
      gymDays: ["lun", "ven"],
    };
    expect(applyRecalculation(p, r)).toMatchObject({ lthr: 171, thresholdPaceSecPerKm: 330, name: "Jacopo" });
  });
  it("rifiuta valori assurdi", () => {
    expect(validateThresholdTest({ last20AvgHr: 20, last20PaceSecPerKm: 330 })).toBeDefined();
    expect(validateThresholdTest({ last20AvgHr: 170, last20PaceSecPerKm: 30 })).toBeDefined();
    expect(() => recalcFromThresholdTest({ last20AvgHr: 20, last20PaceSecPerKm: 330 })).toThrow(RangeError);
  });
});

describe("R6 gel", () => {
  it("nessun gel fino a 90'", () => {
    expect(gelSchedule(90)).toEqual([]);
    expect(gelSchedule(60)).toEqual([]);
  });
  it("un gel ogni 40–45'", () => {
    expect(gelSchedule(100)).toEqual([40, 85]);
    expect(gelSchedule(240)).toEqual([40, 85, 130, 175, 220]);
  });
  it("advice per i lunghi oltre 90', non per gli easy corti", () => {
    const long = PLAN_WEEKS[2].sessions.find((s) => s.weekday === "dom")!; // 16 km
    expect(gelAdvice(long)?.rule).toBe("R6");
    expect(gelAdvice(easy)).toBeUndefined();
    expect(gelAdvice({ weekday: "lun", kind: "gym", description: "", durationMin: 120 })).toBeUndefined();
  });
});

describe("R7 mezza del 14/02", () => {
  it("≤ 1:54:00 → in linea", () => {
    expect(evaluateHalf(114 * 60).onTrack).toBe(true);
    expect(halfAdvice(113 * 60).level).toBe("info");
  });
  it("oltre 1:54 → propone di rivedere il target", () => {
    const e = evaluateHalf(114 * 60 + 1);
    expect(e.onTrack).toBe(false);
    expect(e.proposedTarget).toBeDefined();
    expect(halfAdvice(118 * 60).message).toMatch(/4:05:00–4:10:00/);
  });
  it("coerente con la lettura del HANDOFF: 2:03 → 4h15–4h20", () => {
    expect(evaluateHalf(123 * 60).proposedTarget).toEqual({ fastSec: 15300, slowSec: 15600 });
  });
  it("rifiuta tempi non validi e formatta h:mm:ss", () => {
    expect(() => evaluateHalf(0)).toThrow(RangeError);
    expect(formatHms(3661)).toBe("1:01:01");
  });
});

import { extraEasySession, extraEasyStatus, type ExtraEasyInput } from "./rules";
describe("R8 easy facoltativa del mercoledì", () => {
  const ok: ExtraEasyInput = { weekIndex: 5, today: "2026-12-28", checkIns: [], stopActive: false, plannedKm: 30, baseKm: 36, extraKm: 5 };
  it("attiva quando tutto è a posto", () => {
    expect(extraEasyStatus(ok)).toEqual({ eligible: true, reasons: [] });
  });
  it("non prima della settimana 5", () => {
    expect(extraEasyStatus({ ...ok, weekIndex: 4 }).eligible).toBe(false);
  });
  it("non con la corsa sospesa (R3)", () => {
    expect(extraEasyStatus({ ...ok, stopActive: true }).reasons.join(" ")).toMatch(/R3/);
  });
  it("non con dolore ≥3 a tibie/polpacci nelle ultime 3 settimane, sì se è più vecchio o altrove", () => {
    const pain = (date: string, loc: "tibia" | "polpaccio" | "altro", p: number) => ({ date, pain: p, painLocation: loc });
    expect(extraEasyStatus({ ...ok, checkIns: [pain("2026-12-10", "tibia", 3)] }).eligible).toBe(false);
    expect(extraEasyStatus({ ...ok, checkIns: [pain("2026-12-10", "polpaccio", 4)] }).eligible).toBe(false);
    expect(extraEasyStatus({ ...ok, checkIns: [pain("2026-12-10", "tibia", 2)] }).eligible).toBe(true);
    expect(extraEasyStatus({ ...ok, checkIns: [pain("2026-12-10", "altro", 8)] }).eligible).toBe(true);
    expect(extraEasyStatus({ ...ok, checkIns: [pain("2026-11-30", "tibia", 5)] }).eligible).toBe(true); // 28 giorni fa
  });
  it("non con gambe pesanti nelle ultime 2 settimane", () => {
    expect(extraEasyStatus({ ...ok, checkIns: [{ date: "2026-12-20", pain: 0, heavyLegs: true }] }).eligible).toBe(false);
    expect(extraEasyStatus({ ...ok, checkIns: [{ date: "2026-12-05", pain: 0, heavyLegs: true }] }).eligible).toBe(true);
  });
  it("non se supera il +10% di km", () => {
    expect(extraEasyStatus({ ...ok, plannedKm: 30, baseKm: 30, extraKm: 5 }).reasons.join(" ")).toMatch(/\+10%/);
    expect(extraEasyStatus({ ...ok, plannedKm: 28, baseKm: 33, extraKm: 5 }).eligible).toBe(true);
    expect(extraEasyStatus({ ...ok, baseKm: undefined }).eligible).toBe(true);
  });
  it("elenca tutti i motivi insieme", () => {
    expect(extraEasyStatus({ ...ok, weekIndex: 3, stopActive: true }).reasons).toHaveLength(2);
  });
  it("la seduta è facoltativa, easy, nello stesso giorno", () => {
    expect(extraEasySession("mer")).toMatchObject({ kind: "easy", optional: true, weekday: "mer", durationMin: 35 });
  });
});
