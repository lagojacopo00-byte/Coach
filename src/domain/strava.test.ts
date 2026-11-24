import { describe, expect, it } from "vitest";
import { activitiesOn, importSummary, mapStravaActivity, planImport, toRun } from "./strava";
import type { Run } from "./types";

const raw = (over: Record<string, unknown> = {}) => ({
  id: 111,
  name: "Corsa mattutina",
  sport_type: "Run",
  start_date_local: "2026-11-24T07:15:00Z",
  distance: 5910.4,
  moving_time: 2499,
  average_heartrate: 137.4,
  total_elevation_gain: 30.2,
  ...over,
});

describe("mapStravaActivity", () => {
  it("una corsa: km, tempo, FC, dislivello, data locale", () => {
    expect(mapStravaActivity(raw())).toEqual({
      source: "strava", id: 111, name: "Corsa mattutina", sportType: "Run", date: "2026-11-24", km: 5.91, durationSec: 2499, avgHr: 137, elevationGainM: 30,
    });
  });
  it("trail e corsa virtuale contano; bici, nuoto e camminata no", () => {
    expect(mapStravaActivity(raw({ sport_type: "TrailRun" }))?.sportType).toBe("TrailRun");
    expect(mapStravaActivity(raw({ sport_type: "VirtualRun" }))).toBeDefined();
    for (const t of ["Ride", "Swim", "Walk", "WeightTraining"]) expect(mapStravaActivity(raw({ sport_type: t })), t).toBeUndefined();
  });
  it("usa `type` se manca `sport_type`", () => {
    expect(mapStravaActivity(raw({ sport_type: undefined, type: "Run" }))).toBeDefined();
    expect(mapStravaActivity(raw({ sport_type: undefined, type: "Ride" }))).toBeUndefined();
  });
  it("senza FC o dislivello i campi non ci sono", () => {
    const a = mapStravaActivity(raw({ average_heartrate: undefined, total_elevation_gain: 0 }))!;
    expect("avgHr" in a).toBe(false);
    expect("elevationGainM" in a).toBe(false);
  });
  it("dati rotti → undefined, senza crash", () => {
    for (const bad of [null, undefined, "x", 5, {}, raw({ id: "a" }), raw({ start_date_local: "ieri" }), raw({ distance: 0, moving_time: 0 })])
      expect(mapStravaActivity(bad)).toBeUndefined();
  });
  it("la data è quella locale, non quella UTC", () => {
    expect(mapStravaActivity(raw({ start_date_local: "2026-11-24T23:50:00Z" }))?.date).toBe("2026-11-24");
  });
});

describe("importazione", () => {
  const a = (id: number, date: string) => mapStravaActivity(raw({ id, start_date_local: `${date}T08:00:00Z` }))!;
  const run = (over: Partial<Run>): Run => ({ id: "m", date: "2026-11-24", kind: "easy", km: 5, durationSec: 1800, pain: 0, ...over });

  it("toRun: id stabile, passo, nessun dolore", () => {
    const r = toRun(a(111, "2026-11-24"), "easy");
    expect(r).toMatchObject({ id: "strava-111", stravaId: 111, kind: "easy", km: 5.91, durationSec: 2499, avgPaceSecPerKm: 423, avgHr: 137, elevationGainM: 30, pain: 0 });
  });
  it("importa le nuove in ordine di data", () => {
    const p = planImport([], [a(3, "2026-11-26"), a(1, "2026-11-24")], () => "easy");
    expect(p.toAdd.map((r) => r.stravaId)).toEqual([1, 3]);
  });
  it("salta le già importate e i giorni con una corsa registrata a mano", () => {
    const runs = [run({ id: "strava-1", stravaId: 1, date: "2026-11-24" }), run({ id: "m2", date: "2026-11-26" })];
    const p = planImport(runs, [a(1, "2026-11-24"), a(2, "2026-11-26"), a(3, "2026-11-28")], () => "easy");
    expect(p.toAdd.map((r) => r.stravaId)).toEqual([3]);
    expect(p.alreadyImported).toBe(1);
    expect(p.skippedSameDay).toBe(1);
  });
  it("due corse importate nello stesso giorno entrano entrambe (riscaldamento + corsa)", () => {
    expect(planImport([], [a(1, "2026-11-24"), a(2, "2026-11-24")], () => "easy").toAdd).toHaveLength(2);
  });
  it("il tipo viene dal piano di quel giorno", () => {
    const p = planImport([], [a(1, "2026-12-08")], (x) => (x.date === "2026-12-08" ? "hills" : "easy"));
    expect(p.toAdd[0].kind).toBe("hills");
  });
  it("activitiesOn filtra per giorno; il riepilogo racconta cosa è successo", () => {
    expect(activitiesOn([a(1, "2026-11-24"), a(2, "2026-11-25")], "2026-11-25").map((x) => x.id)).toEqual([2]);
    expect(importSummary({ toAdd: [], alreadyImported: 0, skippedSameDay: 0 })).toBe("Importate 0 corse.");
    expect(importSummary({ toAdd: [toRun(a(1, "2026-11-24"), "easy")], alreadyImported: 2, skippedSameDay: 1 })).toMatch(/Importate 1 corsa, 2 già presenti, 1 saltate/);
  });
});
