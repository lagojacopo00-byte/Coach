import { describe, expect, it } from "vitest";
import { groupByWeek, kmInRange, plannedKmToDate, runStats } from "./stats";
import type { Run } from "./types";

const run = (date: string, km: number, over: Partial<Run> = {}): Run => ({
  id: `${date}-${km}-${Math.random()}`,
  date,
  kind: "easy",
  km,
  durationSec: km * 420,
  pain: 0,
  ...over,
});

describe("runStats", () => {
  const runs = [
    run("2026-11-24", 7, { avgHr: 140, elevationGainM: 30 }), // sett. 0
    run("2026-11-26", 5), // sett. 0
    run("2026-11-29", 25, { kind: "trail", durationSec: 11400, elevationGainM: 400 }), // sett. 0
    run("2026-12-01", 8, { avgHr: 150 }), // sett. 1
    run("2026-12-03", 6, { kind: "threshold_test", durationSec: 1800 }), // sett. 1
  ];

  it("totali, corsa più lunga, dislivello", () => {
    const s = runStats(runs, "2026-12-04");
    expect(s.runs).toBe(5);
    expect(s.totalKm).toBe(51);
    expect(s.longest).toEqual({ km: 25, date: "2026-11-29", kind: "trail" });
    expect(s.totalElevationM).toBe(430);
  });
  it("settimana migliore del piano", () => {
    expect(runStats(runs, "2026-12-04").bestWeek).toEqual({ index: 0, km: 37 });
  });
  it("ultimi 7 giorni contro i 7 precedenti", () => {
    const s = runStats(runs, "2026-12-04"); // 28 nov–4 dic = 25+8+6 = 39; 21–27 nov = 12
    expect(s.last7Km).toBe(39);
    expect(s.prev7Km).toBe(12);
    expect(s.last7ChangePct).toBeCloseTo(225);
    expect(runStats([run("2026-12-03", 5)], "2026-12-04").last7ChangePct).toBeUndefined();
  });
  it("media delle ultime settimane complete (la corrente non conta)", () => {
    expect(runStats(runs, "2026-12-04").avg4WeeksKm).toBe(37); // solo la sett. 0 è completa
    expect(runStats(runs, "2026-11-27").avg4WeeksKm).toBeUndefined(); // ancora nella sett. 0
    expect(runStats(runs, "2026-12-15").avg4WeeksKm).toBeCloseTo((37 + 14 + 0) / 3);
  });
  it("passo medio e per tipo (tempo totale / km totali)", () => {
    const s = runStats(runs, "2026-12-04");
    expect(s.paceByKind[0].kind).toBe("trail");
    expect(s.paceByKind.find((k) => k.kind === "easy")).toMatchObject({ count: 3, km: 20 });
    expect(s.paceByKind.find((k) => k.kind === "easy")?.avgPaceSecPerKm).toBeCloseTo(420);
    expect(s.paceByKind.find((k) => k.kind === "trail")?.avgPaceSecPerKm).toBeCloseTo(456);
  });
  it("FC media sugli easy, solo con FC", () => {
    const s = runStats(runs, "2026-12-04");
    expect(s.easyAvgHr).toBe(145);
    expect(s.easyHrCount).toBe(2);
    expect(runStats([run("2026-12-01", 5)], "2026-12-04").easyAvgHr).toBeUndefined();
  });
  it("giorni dall'ultima corsa, km del mese", () => {
    const s = runStats(runs, "2026-12-04");
    expect(s.daysSinceLast).toBe(1);
    expect(s.monthKm).toBe(14); // dicembre: 8 + 6
  });
  it("corse future non contano", () => {
    expect(runStats([...runs, run("2026-12-20", 30)], "2026-12-04").totalKm).toBe(51);
  });
  it("km fatti rispetto al previsto fino a oggi", () => {
    const s = runStats(runs, "2026-11-29");
    expect(s.plannedToDateKm).toBeCloseTo(plannedKmToDate("2026-11-29"));
    expect(s.planDonePct).toBeCloseTo((37 / s.plannedToDateKm!) * 100);
    expect(runStats(runs, "2026-11-20").planDonePct).toBeUndefined(); // prima del piano
  });
  it("senza corse niente si rompe", () => {
    const s = runStats([], "2026-12-04");
    expect(s).toMatchObject({ runs: 0, totalKm: 0, last7Km: 0, monthKm: 0, paceByKind: [], easyHrCount: 0 });
    expect(s.longest).toBeUndefined();
    expect(s.avgPaceSecPerKm).toBeUndefined();
    expect(s.daysSinceLast).toBeUndefined();
  });
  it("una corsa senza tempo non sporca il passo", () => {
    const s = runStats([run("2026-12-01", 5, { durationSec: 0 }), run("2026-12-02", 5)], "2026-12-04");
    expect(s.avgPaceSecPerKm).toBeCloseTo(420);
    expect(s.totalKm).toBe(10);
  });
});

describe("piano e intervalli", () => {
  it("km previsti fino a una data: cresce e non conta le facoltative", () => {
    expect(plannedKmToDate("2026-11-22")).toBe(0);
    expect(plannedKmToDate("2026-11-29")).toBeGreaterThan(30);
    expect(plannedKmToDate("2027-03-14")).toBeGreaterThan(plannedKmToDate("2027-02-01"));
  });
  it("kmInRange è inclusivo", () => {
    expect(kmInRange([run("2026-12-01", 5), run("2026-12-02", 6), run("2026-12-03", 7)], "2026-12-01", "2026-12-02")).toBe(11);
  });
});

describe("groupByWeek", () => {
  it("raggruppa per settimana dalla più recente, con l'indice del piano", () => {
    const items = [{ date: "2026-12-03" }, { date: "2026-11-29" }, { date: "2026-11-24" }, { date: "2026-12-01" }];
    const g = groupByWeek(items);
    expect(g.map((x) => [x.monday, x.planIndex, x.items.length])).toEqual([["2026-11-30", 1, 2], ["2026-11-23", 0, 2]]);
  });
  it("fuori dal piano usa il lunedì di calendario", () => {
    const g = groupByWeek([{ date: "2026-11-16" }, { date: "2026-11-19" }]);
    expect(g).toHaveLength(1);
    expect(g[0].monday).toBe("2026-11-16");
    expect(g[0].planIndex).toBeUndefined();
  });
});

import { kmInsights } from "./stats";
describe("kmInsights", () => {
  it("racconta gli ultimi 7 giorni, la media e il piano", () => {
    const runs = [run("2026-11-24", 7), run("2026-11-29", 25), run("2026-12-01", 8)];
    const t = kmInsights(runStats(runs, "2026-12-08")).join(" ");
    expect(t).toMatch(/Ultimi 7 giorni:/);
    expect(t).toMatch(/Media delle ultime settimane complete:/);
    expect(t).toMatch(/dei km previsti dal piano fino a oggi/);
  });
  it("avvisa se si supera il +10% sui 7 giorni precedenti", () => {
    const t = kmInsights(runStats([run("2026-12-02", 10), run("2026-12-09", 20)], "2026-12-09")).join(" ");
    expect(t).toMatch(/\+100% sui 7 precedenti/);
    expect(t).toMatch(/oltre il \+10%/);
  });
  it("non avvisa se la salita è dentro il 10%", () => {
    const t = kmInsights(runStats([run("2026-12-02", 20), run("2026-12-09", 21)], "2026-12-09")).join(" ");
    expect(t).not.toMatch(/oltre il/);
  });
  it("senza corse non c'è nulla da dire (se non il piano)", () => {
    expect(kmInsights(runStats([], "2026-11-20"))).toEqual([]);
  });
});
