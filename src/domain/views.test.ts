import { describe, expect, it } from "vitest";
import { addCheckIn, addRun, initialState } from "./state";
import { checklistForWeek, sundayView, todayView, weekView } from "./views";
import { PLAN_WEEKS } from "./plan.seed";
import type { Run } from "./types";

const run = (over: Partial<Run>): Run => ({ id: "r" + Math.random(), date: "2026-11-24", kind: "easy", km: 8, durationSec: 3000, pain: 0, ...over });

describe("views", () => {
  it("Domenica sera 22/11 (oggi): prima del piano, la prossima settimana è la 0", () => {
    const v = sundayView(initialState(), "2026-11-22");
    expect(v.status).toBe("before");
    expect(v.finished).toBeUndefined();
    expect(v.next?.week.index).toBe(0);
    expect(v.next?.effective.week.sessions.some((s) => s.kind === "trail")).toBe(true);
  });

  it("checklist della sett. 0: visita medica, Runcard e gel; non l'iscrizione né ENDU", () => {
    const ids = checklistForWeek([], PLAN_WEEKS[0]).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(["visita-medica", "runcard", "gel-trail"]));
    expect(ids).not.toContain("endu-certificato");
    expect(ids).not.toContain("garmin");
    expect(checklistForWeek(["runcard"], PLAN_WEEKS[0]).map((i) => i.id)).not.toContain("runcard");
  });

  it("le voci non completate si riportano alle settimane successive", () => {
    expect(checklistForWeek([], PLAN_WEEKS[2]).map((i) => i.id)).toContain("visita-medica");
  });

  it("Domenica 29/11: riepilogo sett. 0 con km e variazione, prossima = sett. 1", () => {
    let s = addRun(initialState(), run({ date: "2026-11-24", km: 7 }));
    s = addRun(s, run({ date: "2026-11-26", km: 5 }));
    s = addRun(s, run({ date: "2026-11-29", km: 25, kind: "trail", pain: 3 }));
    const v = sundayView(s, "2026-11-29");
    expect(v.status).toBe("during");
    expect(v.finished?.actualKm).toBe(37);
    expect(v.finished?.summary.doneRuns).toBe(3);
    expect(v.finished?.summary.maxPain).toBe(3);
    expect(v.next?.week.index).toBe(1);
  });

  it("variazione % rispetto alla settimana precedente", () => {
    let s = addRun(initialState(), run({ date: "2026-11-24", km: 30 }));
    s = addRun(s, run({ date: "2026-12-01", km: 33 }));
    const v = sundayView(s, "2026-12-06");
    expect(v.finished?.previousKm).toBe(30);
    expect(v.finished?.changeVsPrevPct).toBeCloseTo(10);
  });

  it("oggi: seduta del giorno, countdown, fase", () => {
    const v = todayView(initialState(), "2026-11-24"); // martedì sett. 0
    expect(v.todaySession?.kind).toBe("easy");
    expect(v.phase?.id).toBe(0);
    expect(v.daysToRace).toBe(110);
    expect(v.adjusted).toBe(false);
  });

  it("oggi con gambe pesanti il martedì delle salite: seduta cambiata e segnalata", () => {
    const s = addCheckIn(initialState(), { date: "2026-12-08", pain: 0, heavyLegs: true });
    const v = todayView(s, "2026-12-08");
    expect(v.todaySession?.kind).toBe("easy");
    expect(v.adjusted).toBe(true);
    expect(v.advices.some((a) => a.rule === "R2")).toBe(true);
  });

  it("weekView: km pianificati > 0", () => {
    expect(weekView(initialState(), PLAN_WEEKS[3], "2026-12-14").plannedKm).toBeGreaterThan(20);
  });

  it("a piano finito non c'è settimana prossima", () => {
    const v = sundayView(initialState(), "2027-03-20");
    expect(v.status).toBe("after");
    expect(v.next).toBeUndefined();
  });
});

import { trendSeries } from "./views";
describe("trendSeries", () => {
  it("una riga per settimana con carico e lungo", () => {
    const t = trendSeries(addRun(initialState(), run({ date: "2026-11-29", km: 25, kind: "trail" })));
    expect(t).toHaveLength(16);
    expect(t[0].longPlannedKm).toBe(25);
    expect(t[0].longActualKm).toBe(25);
    expect(t[0].actualKm).toBe(25);
    expect(t[1].actualKm).toBe(0);
    expect(t[13].longPlannedKm).toBe(32);
    expect(t[4].deload).toBe(true);
  });
  it("con lo stop R3 il pianificato scende (bici al posto delle corse)", () => {
    const s = addCheckIn(initialState(), { date: "2026-12-07", pain: 2, painLocation: "tibia", painType: "puntiforme" });
    expect(trendSeries(s)[3].plannedKm).toBeLessThan(trendSeries(initialState())[3].plannedKm);
  });
});

import { nextRunSession } from "./views";
describe("nextRunSession", () => {
  it("prima del piano è la prima corsa della sett. 0", () => {
    const n = nextRunSession(initialState(), "2026-11-22");
    expect(n?.date).toBe("2026-11-24");
    expect(n?.session.kind).toBe("easy");
  });
  it("da un giorno di riposo dà la corsa successiva, anche nella settimana dopo", () => {
    expect(nextRunSession(initialState(), "2026-11-25")?.date).toBe("2026-11-26");
    expect(nextRunSession(initialState(), "2026-11-29")?.date).toBe("2026-12-01");
  });
  it("dopo la gara non c'è", () => {
    expect(nextRunSession(initialState(), "2027-03-14")).toBeUndefined();
  });
  it("con lo stop R3 la prossima corsa è una bici? No: bici non è una corsa, quindi salta alla ripresa o non c'è", () => {
    const s = addCheckIn(initialState(), { date: "2026-12-07", pain: 2, painLocation: "tibia", painType: "puntiforme" });
    expect(nextRunSession(s, "2026-12-07")).toBeUndefined();
  });
});
