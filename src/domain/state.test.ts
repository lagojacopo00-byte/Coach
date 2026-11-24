import { describe, expect, it } from "vitest";
import {
  addCheckIn,
  addRun,
  allCheckIns,
  clearRunStop,
  initialState,
  parseState,
  recordHalf,
  recordThresholdTest,
  removeRun,
  toggleChecklist,
} from "./state";
import type { Run } from "./types";

const run = (over: Partial<Run> = {}): Run => ({
  id: "r1",
  date: "2026-11-24",
  kind: "easy",
  km: 8,
  durationSec: 3000,
  pain: 0,
  ...over,
});

describe("state", () => {
  it("stato iniziale: profilo di default e niente dati", () => {
    const s = initialState();
    expect(s.profile.targetPaceSecPerKm).toBe(341);
    expect(s.runs).toEqual([]);
    expect(s.onboardingDone).toBe(false);
  });

  it("addRun ordina per data, sostituisce lo stesso id, valida", () => {
    let s = addRun(initialState(), run({ id: "b", date: "2026-11-26" }));
    s = addRun(s, run({ id: "a", date: "2026-11-24" }));
    expect(s.runs.map((r) => r.id)).toEqual(["a", "b"]);
    s = addRun(s, run({ id: "a", date: "2026-11-24", km: 9 }));
    expect(s.runs).toHaveLength(2);
    expect(s.runs[0].km).toBe(9);
    expect(() => addRun(s, run({ km: -1 }))).toThrow(RangeError);
    expect(() => addRun(s, run({ durationSec: -5 }))).toThrow(RangeError);
    expect(() => addRun(s, run({ pain: 11 }))).toThrow(RangeError);
    expect(removeRun(s, "a").runs.map((r) => r.id)).toEqual(["b"]);
  });

  it("non muta lo stato precedente", () => {
    const s = initialState();
    addRun(s, run());
    expect(s.runs).toHaveLength(0);
  });

  it("un check-in per giorno", () => {
    let s = addCheckIn(initialState(), { date: "2026-12-01", pain: 2 });
    s = addCheckIn(s, { date: "2026-12-01", pain: 4 });
    expect(s.checkIns).toHaveLength(1);
    expect(s.checkIns[0].pain).toBe(4);
    expect(() => addCheckIn(s, { date: "2026-12-01", pain: -1 })).toThrow(RangeError);
  });

  it("allCheckIns unisce log e check-in e tiene il dato peggiore", () => {
    let s = addRun(initialState(), run({ date: "2026-12-01", pain: 1, heavyLegs: false }));
    s = addCheckIn(s, { date: "2026-12-01", pain: 4, painLocation: "tibia", painType: "puntiforme", heavyLegs: true });
    const all = allCheckIns(s);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ pain: 4, painLocation: "tibia", painType: "puntiforme", heavyLegs: true });
  });

  it("il dolore puntiforme non si nasconde con un dato meno grave nello stesso giorno", () => {
    let s = addRun(initialState(), run({ date: "2026-12-01", pain: 6, painLocation: "altro", painType: "diffuso" }));
    s = addCheckIn(s, { date: "2026-12-01", pain: 1, painLocation: "tibia", painType: "puntiforme" });
    const c = allCheckIns(s)[0];
    expect(c.painLocation).toBe("tibia");
    expect(c.painType).toBe("puntiforme");
  });

  it("checklist: spunta e de-spunta", () => {
    let s = toggleChecklist(initialState(), "runcard");
    expect(s.checklistDone).toEqual(["runcard"]);
    s = toggleChecklist(s, "runcard");
    expect(s.checklistDone).toEqual([]);
  });

  it("test soglia: aggiorna il profilo e lo storico", () => {
    const { state, recalculation } = recordThresholdTest(initialState(), {
      date: "2026-12-03",
      last20AvgHr: 172,
      last20PaceSecPerKm: 330,
    });
    expect(recalculation.lthr).toBe(172);
    expect(state.profile.lthr).toBe(172);
    expect(state.profile.thresholdPaceSecPerKm).toBe(330);
    expect(state.thresholdTests).toHaveLength(1);
    expect(() => recordThresholdTest(initialState(), { date: "2026-12-03", last20AvgHr: 10, last20PaceSecPerKm: 330 })).toThrow();
  });

  it("mezza e via libera", () => {
    expect(recordHalf(initialState(), { date: "2027-02-14", timeSec: 6900 }).halfResult?.timeSec).toBe(6900);
    expect(() => recordHalf(initialState(), { date: "2027-02-14", timeSec: 0 })).toThrow(RangeError);
    expect(clearRunStop(initialState(), "2026-12-10").runClearedOn).toBe("2026-12-10");
  });

  it("parseState accetta un backup valido e scarta il resto", () => {
    const s = addRun(initialState(), run());
    expect(parseState(JSON.parse(JSON.stringify(s)))?.runs).toHaveLength(1);
    expect(parseState(null)).toBeUndefined();
    expect(parseState({ version: 99 })).toBeUndefined();
    expect(parseState({ version: 1, profile: {} })).toBeUndefined();
    expect(parseState("ciao")).toBeUndefined();
  });
});

import { addSkip, removeSkip } from "./state";
describe("non fatto", () => {
  it("si segna, si toglie, e una corsa nello stesso giorno lo annulla", () => {
    let s = addSkip(initialState(), { date: "2026-11-24", reason: "stanco" });
    expect(s.skips).toEqual([{ date: "2026-11-24", reason: "stanco" }]);
    s = addSkip(s, { date: "2026-11-24", reason: "dolore" });
    expect(s.skips).toHaveLength(1);
    expect(s.skips[0].reason).toBe("dolore");
    expect(removeSkip(s, "2026-11-24").skips).toEqual([]);
    s = addRun(s, { id: "a", date: "2026-11-24", kind: "easy", km: 5, durationSec: 1800, pain: 0 });
    expect(s.skips).toEqual([]);
  });
  it("non si può segnare non fatta una data con una corsa", () => {
    const s = addRun(initialState(), { id: "a", date: "2026-11-24", kind: "easy", km: 5, durationSec: 1800, pain: 0 });
    expect(() => addSkip(s, { date: "2026-11-24" })).toThrow(RangeError);
  });
  it("un vecchio salvataggio senza skips si legge lo stesso", () => {
    const old = { ...initialState() } as Record<string, unknown>;
    delete old.skips;
    expect(parseState(old)?.skips).toEqual([]);
  });
});

describe("corsa senza dati", () => {
  it("si può salvare solo \"fatto\", senza km né tempo", () => {
    const s = addRun(initialState(), run({ km: 0, durationSec: 0, feeling: "buone" }));
    expect(s.runs).toHaveLength(1);
    expect(s.runs[0].feeling).toBe("buone");
  });
  it("anche con solo i km o solo il tempo", () => {
    expect(addRun(initialState(), run({ km: 6, durationSec: 0 })).runs[0].km).toBe(6);
    expect(addRun(initialState(), run({ km: 0, durationSec: 1800 })).runs[0].durationSec).toBe(1800);
  });
});
