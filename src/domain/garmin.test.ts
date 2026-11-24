import { describe, expect, it } from "vitest";
import { describeRaw, mapGarminActivity, unrecognizedMessage } from "./garmin";

const raw = (over: Record<string, unknown> = {}) => ({
  activityId: 22334455,
  activityName: "Roma Corsa mattutina",
  startTimeLocal: "2026-11-24 07:15:00",
  startTimeGMT: "2026-11-24 06:15:00",
  activityType: { typeId: 1, typeKey: "running" },
  distance: 5910.4,
  duration: 2510.7,
  movingDuration: 2499.2,
  averageHR: 137.4,
  elevationGain: 30.2,
  ...over,
});

describe("mapGarminActivity", () => {
  it("una corsa: data locale, km, tempo in movimento, FC, dislivello", () => {
    expect(mapGarminActivity(raw())).toEqual({
      source: "garmin", id: 22334455, name: "Roma Corsa mattutina", sportType: "running", date: "2026-11-24", km: 5.91, durationSec: 2499, avgHr: 137, elevationGainM: 30,
    });
  });
  it("la data è quella locale, non GMT", () => {
    expect(mapGarminActivity(raw({ startTimeLocal: "2026-11-24 23:50:00", startTimeGMT: "2026-11-25 00:50:00" }))?.date).toBe("2026-11-24");
  });
  it("trail, tapis roulant e pista contano; bici, nuoto e camminata no", () => {
    for (const t of ["trail_running", "treadmill_running", "track_running"]) expect(mapGarminActivity(raw({ activityType: { typeKey: t } })), t).toBeDefined();
    for (const t of ["cycling", "lap_swimming", "walking", "strength_training"]) expect(mapGarminActivity(raw({ activityType: { typeKey: t } })), t).toBeUndefined();
  });
  it("tollera varianti: tipo come stringa, senza movingDuration, ISO con T", () => {
    expect(mapGarminActivity(raw({ activityType: "running" }))).toBeDefined();
    expect(mapGarminActivity(raw({ movingDuration: undefined }))?.durationSec).toBe(2511);
    expect(mapGarminActivity(raw({ startTimeLocal: "2026-11-24T07:15:00.0" }))?.date).toBe("2026-11-24");
  });
  it("senza FC o dislivello i campi non ci sono", () => {
    const a = mapGarminActivity(raw({ averageHR: undefined, elevationGain: 0 }))!;
    expect("avgHr" in a).toBe(false);
    expect("elevationGainM" in a).toBe(false);
  });
  it("dati rotti → undefined, senza crash", () => {
    for (const bad of [null, undefined, "x", 5, {}, raw({ activityId: "a" }), raw({ startTimeLocal: "ieri", startTimeGMT: undefined }), raw({ distance: 0, duration: 0, movingDuration: 0 })])
      expect(mapGarminActivity(bad)).toBeUndefined();
  });
});

describe("diagnostica", () => {
  it("descrive cosa è arrivato senza i valori", () => {
    const items = [raw(), raw({ activityType: { typeKey: "cycling" } })];
    const d = describeRaw(items, 1);
    expect(d.received).toBe(2);
    expect(d.recognized).toBe(1);
    expect(d.sampleKeys).toContain("activityId");
    expect(d.typeKeys.sort()).toEqual(["cycling", "running"]);
    expect(JSON.stringify(d)).not.toContain("137");
    expect(JSON.stringify(d)).not.toContain("Roma");
  });
  it("nessun messaggio se va tutto bene o se non c'è nulla", () => {
    expect(unrecognizedMessage(describeRaw([raw()], 1))).toBeUndefined();
    expect(unrecognizedMessage(describeRaw([], 0))).toBeUndefined();
  });
  it("solo altri sport → lo dice; forma sconosciuta → elenca i campi per poterli aggiungere", () => {
    expect(unrecognizedMessage(describeRaw([raw({ activityType: { typeKey: "cycling" } })], 0))).toMatch(/nessuna è una corsa \(tipi: cycling\)/);
    const weird = { id_attivita: 1, tipo: "corsa", km: 5 };
    expect(unrecognizedMessage(describeRaw([weird], 0))).toMatch(/non riconosco i campi.*id_attivita, tipo, km/);
  });
});
