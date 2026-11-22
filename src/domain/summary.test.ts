import { describe, expect, it } from "vitest";
import { PLAN_WEEKS } from "./plan.seed";
import {
  actualWeekKm,
  changePct,
  estimateSessionKm,
  isRunSession,
  paceOf,
  plannedWeekKm,
  runsInWeek,
  weekSummary,
} from "./summary";
import type { Run } from "./types";

const run = (over: Partial<Run>): Run => ({
  id: over.id ?? "r1",
  date: "2026-11-23",
  kind: "easy",
  km: 8,
  durationSec: 3000,
  pain: 0,
  ...over,
});

describe("summary", () => {
  it("riconosce le sedute di corsa", () => {
    expect(isRunSession(PLAN_WEEKS[0].sessions[0])).toBe(false); // palestra
    expect(isRunSession(PLAN_WEEKS[0].sessions[1])).toBe(true);
  });

  it("stima i km: km dichiarati, durata, qualità", () => {
    expect(estimateSessionKm({ weekday: "dom", kind: "long", description: "", km: 14 })).toBe(14);
    expect(estimateSessionKm({ weekday: "gio", kind: "easy", description: "", durationMin: 42 })).toBeCloseTo(6);
    expect(estimateSessionKm({ weekday: "mar", kind: "hills", description: "" })).toBeGreaterThan(5);
    expect(estimateSessionKm({ weekday: "lun", kind: "gym", description: "" })).toBe(0);
    expect(estimateSessionKm({ weekday: "mar", kind: "rm_blocks", description: "", rmKm: 9 })).toBeGreaterThan(9);
  });

  it("ogni settimana ha km pianificati > 0 e il piano sale verso il picco", () => {
    for (const w of PLAN_WEEKS) expect(plannedWeekKm(w)).toBeGreaterThan(0);
    expect(plannedWeekKm(PLAN_WEEKS[13])).toBeGreaterThan(plannedWeekKm(PLAN_WEEKS[2]));
  });

  it("km settimanali fatti e variazione %", () => {
    const w = PLAN_WEEKS[0];
    const runs = [run({ id: "a", date: "2026-11-24", km: 8 }), run({ id: "b", date: "2026-12-01", km: 9 })];
    expect(runsInWeek(runs, w)).toHaveLength(1);
    expect(actualWeekKm(runs, w)).toBe(8);
    expect(changePct(20, 22)).toBeCloseTo(10);
    expect(changePct(0, 10)).toBeUndefined();
  });

  it("pianificato vs fatto: fatto, saltato, oggi, prossimo", () => {
    const w = PLAN_WEEKS[0]; // mar 24, gio 26, dom 29
    const runs = [run({ id: "a", date: "2026-11-24", km: 7, pain: 2 }), run({ id: "x", date: "2026-11-25", km: 3 })];
    const s = weekSummary(w, runs, "2026-11-27");
    const by = (wd: string) => s.statuses.find((x) => x.session.weekday === wd)!;
    expect(by("mar").state).toBe("done");
    expect(by("gio").state).toBe("missed");
    expect(by("dom").state).toBe("upcoming");
    expect(s.plannedRuns).toBe(3);
    expect(s.doneRuns).toBe(1);
    expect(s.actualKm).toBe(10);
    expect(s.extraRuns.map((r) => r.id)).toEqual(["x"]);
    expect(s.maxPain).toBe(2);
    expect(weekSummary(w, runs, "2026-11-26").statuses.find((x) => x.session.weekday === "gio")!.state).toBe("today");
  });

  it("passo dalla corsa", () => {
    expect(paceOf({ km: 10, durationSec: 3500 })).toBe(350);
    expect(paceOf({ km: 10, durationSec: 3500, avgPaceSecPerKm: 340 })).toBe(340);
    expect(paceOf({ km: 0, durationSec: 100 })).toBeUndefined();
  });
});
