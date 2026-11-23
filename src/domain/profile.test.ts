import { describe, expect, it } from "vitest";
import { applyOnboarding, defaultProfile, validateOnboarding } from "./profile";
import { CHECKLIST_SEED, dueSoon } from "./checklist.seed";
import { diffDays } from "./week";

describe("profile / onboarding", () => {
  it("default: sub 4h a 5:41/km, mar/gio/dom + lun/mer", () => {
    const p = defaultProfile();
    expect(p.targetPaceSecPerKm).toBe(341);
    expect(p.runDays).toEqual(["mar", "gio", "dom"]);
    expect(p.gymDays).toEqual(["lun", "mer"]);
    expect(p.raceDate).toBe("2027-03-14");
  });
  it("validazione", () => {
    expect(validateOnboarding({})).toEqual([]);
    expect(validateOnboarding({ age: 30, restingHr: 52, maxHr: 195, tibiaPain: 2 })).toEqual([]);
    expect(validateOnboarding({ age: 5 })).toHaveLength(1);
    expect(validateOnboarding({ restingHr: 200, maxHr: 190 }).length).toBeGreaterThan(0);
    expect(validateOnboarding({ tibiaPain: 11 })).toHaveLength(1);
  });
  it("applyOnboarding aggiorna solo i campi dati", () => {
    const p = applyOnboarding(defaultProfile(), { age: 29, maxHr: 196 });
    expect(p).toMatchObject({ age: 29, maxHr: 196, name: "Jacopo" });
    expect(p.restingHr).toBeUndefined();
  });
});

describe("checklist seed", () => {
  it("id unici e contenuto del HANDOFF §7", () => {
    const ids = CHECKLIST_SEED.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["visita-medica", "runcard", "iscrizione-maratona", "endu-certificato", "gel-trail", "scarpe", "fascia-cardio", "garmin"]));
    expect(CHECKLIST_SEED.find((i) => i.id === "endu-certificato")?.due).toBe("2027-03-04");
    expect(CHECKLIST_SEED.find((i) => i.id === "visita-medica")?.detail).toMatch(/ATLETICA LEGGERA/);
  });
  it("dueSoon: scadenze vicine o scadute non completate", () => {
    const soon = dueSoon(CHECKLIST_SEED, [], "2026-11-25", 5, diffDays).map((i) => i.id);
    expect(soon).toContain("visita-medica");
    expect(soon).not.toContain("endu-certificato");
    expect(dueSoon(CHECKLIST_SEED, ["visita-medica"], "2026-11-25", 5, diffDays).map((i) => i.id)).not.toContain("visita-medica");
    expect(dueSoon(CHECKLIST_SEED, [], "2026-12-10", 0, diffDays).map((i) => i.id)).toContain("visita-medica"); // scaduta
  });
});

import { onboardingCheckIn } from "./profile";
describe("onboardingCheckIn", () => {
  it("dolore tibie > 0 → check-in; puntiforme resta puntiforme", () => {
    expect(onboardingCheckIn({ tibiaPain: 0 }, "2026-11-22")).toBeUndefined();
    expect(onboardingCheckIn({}, "2026-11-22")).toBeUndefined();
    expect(onboardingCheckIn({ tibiaPain: 2 }, "2026-11-22")).toEqual({ date: "2026-11-22", pain: 2, painLocation: "tibia", painType: "diffuso" });
    expect(onboardingCheckIn({ tibiaPain: 4, tibiaPainType: "puntiforme" }, "2026-11-22")?.painType).toBe("puntiforme");
  });
});
