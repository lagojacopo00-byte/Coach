import { describe, expect, it } from "vitest";
import { PLAN_WEEKS } from "./plan.seed";
import {
  daysToRace,
  diffDays,
  nextWeek,
  phaseForDate,
  phaseProgress,
  planStatus,
  weekForDate,
  weeksToRace,
} from "./week";

describe("week", () => {
  it("diffDays conta i giorni di calendario", () => {
    expect(diffDays("2026-11-23", "2026-11-30")).toBe(7);
    expect(diffDays("2026-11-30", "2026-11-23")).toBe(-7);
    expect(diffDays("2027-02-28", "2027-03-01")).toBe(1);
  });

  it("weekForDate trova la settimana, estremi inclusi", () => {
    expect(weekForDate("2026-11-23")?.index).toBe(0);
    expect(weekForDate("2026-11-29")?.index).toBe(0);
    expect(weekForDate("2026-11-30")?.index).toBe(1);
    expect(weekForDate("2027-02-14")?.index).toBe(11);
    expect(weekForDate("2027-03-14")?.index).toBe(15);
  });

  it("weekForDate è undefined fuori dal piano", () => {
    expect(weekForDate("2026-11-22")).toBeUndefined();
    expect(weekForDate("2027-03-15")).toBeUndefined();
  });

  it("ogni giorno del piano cade in esattamente una settimana", () => {
    for (const w of PLAN_WEEKS) {
      for (let i = 0; i < 7; i++) {
        const d = new Date(Date.parse(`${w.start}T00:00:00Z`) + i * 86_400_000)
          .toISOString()
          .slice(0, 10);
        expect(weekForDate(d)?.index).toBe(w.index);
      }
    }
  });

  it("nextWeek: la domenica sera mostra la settimana dopo", () => {
    expect(nextWeek("2026-11-29")?.index).toBe(1);
    expect(nextWeek("2026-12-02")?.index).toBe(2);
  });

  it("nextWeek: prima del piano è la 0, dopo l'ultima non c'è", () => {
    expect(nextWeek("2026-11-22")?.index).toBe(0);
    expect(nextWeek("2027-03-10")).toBeUndefined();
    expect(nextWeek("2027-04-01")).toBeUndefined();
  });

  it("phaseForDate segue le fasi del HANDOFF", () => {
    expect(phaseForDate("2026-11-25")?.id).toBe(0);
    expect(phaseForDate("2026-11-30")?.id).toBe(1);
    expect(phaseForDate("2026-12-27")?.id).toBe(1);
    expect(phaseForDate("2026-12-28")?.id).toBe(2);
    expect(phaseForDate("2027-02-08")?.id).toBe(3);
    expect(phaseForDate("2027-03-01")?.id).toBe(4);
    expect(phaseForDate("2026-11-22")).toBeUndefined();
  });

  it("daysToRace: countdown alla maratona del 14/03/2027", () => {
    expect(daysToRace("2027-03-14")).toBe(0);
    expect(daysToRace("2027-03-13")).toBe(1);
    expect(daysToRace("2026-11-22")).toBe(112);
    expect(daysToRace("2027-03-15")).toBe(-1);
  });

  it("weeksToRace arrotonda per eccesso e non va sotto zero", () => {
    expect(weeksToRace("2026-11-22")).toBe(16);
    expect(weeksToRace("2027-03-07")).toBe(1);
    expect(weeksToRace("2027-03-14")).toBe(0);
    expect(weeksToRace("2027-04-01")).toBe(0);
  });

  it("planStatus", () => {
    expect(planStatus("2026-11-22")).toBe("before");
    expect(planStatus("2026-11-23")).toBe("during");
    expect(planStatus("2027-03-14")).toBe("during");
    expect(planStatus("2027-03-15")).toBe("after");
  });

  it("phaseProgress è tra 0 e 1", () => {
    const base = phaseForDate("2026-12-01")!;
    expect(phaseProgress(base, "2026-11-01")).toBe(0);
    expect(phaseProgress(base, "2026-12-27")).toBe(1);
    expect(phaseProgress(base, "2027-01-30")).toBe(1);
    expect(phaseProgress(base, "2026-12-14")).toBeCloseTo(15 / 28);
  });
});

import { addDays, dateOfWeekday, localTodayIso, weekdayOf } from "./week";

describe("week: giorni", () => {
  it("weekdayOf", () => {
    expect(weekdayOf("2026-11-23")).toBe("lun");
    expect(weekdayOf("2026-11-29")).toBe("dom");
    expect(weekdayOf("2027-03-14")).toBe("dom");
    expect(weekdayOf("2026-12-03")).toBe("gio");
  });
  it("dateOfWeekday e addDays", () => {
    const w = PLAN_WEEKS[1];
    expect(dateOfWeekday(w, "lun")).toBe("2026-11-30");
    expect(dateOfWeekday(w, "gio")).toBe("2026-12-03");
    expect(dateOfWeekday(w, "dom")).toBe("2026-12-06");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("localTodayIso usa la data locale", () => {
    expect(localTodayIso(new Date(2026, 10, 22, 23, 59))).toBe("2026-11-22");
    expect(localTodayIso(new Date(2027, 0, 5, 0, 1))).toBe("2027-01-05");
  });
});
