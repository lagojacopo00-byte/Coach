import { describe, expect, it } from "vitest";
import { PHASES, PLAN_WEEKS, RACE_DATE } from "./plan.seed";
import { WEEKDAYS } from "./types";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const diffDays = (a: string, b: string) => (day(b).getTime() - day(a).getTime()) / 86_400_000;

describe("plan.seed", () => {
  it("ha 16 settimane indicizzate 0–15", () => {
    expect(PLAN_WEEKS).toHaveLength(16);
    expect(PLAN_WEEKS.map((w) => w.index)).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it("ogni settimana va da lunedì a domenica ed è contigua alla precedente", () => {
    PLAN_WEEKS.forEach((w, i) => {
      expect(day(w.start).getUTCDay()).toBe(1);
      expect(day(w.end).getUTCDay()).toBe(0);
      expect(diffDays(w.start, w.end)).toBe(6);
      if (i > 0) expect(diffDays(PLAN_WEEKS[i - 1].end, w.start)).toBe(1);
    });
  });

  it("date di riferimento dal HANDOFF", () => {
    expect(PLAN_WEEKS[0].start).toBe("2026-11-23");
    expect(PLAN_WEEKS[1].start).toBe("2026-11-30");
    expect(PLAN_WEEKS[11].end).toBe("2027-02-14");
    expect(PLAN_WEEKS[15].end).toBe(RACE_DATE);
  });

  it("la settimana 15 finisce con la maratona la domenica 14/03/2027", () => {
    const last = PLAN_WEEKS[15];
    const dom = last.sessions.find((s) => s.weekday === "dom");
    expect(dom?.kind).toBe("race");
    expect(dom?.km).toBeCloseTo(42.195);
    expect(PLAN_WEEKS.filter((w) => w.sessions.some((s) => s.kind === "race"))).toHaveLength(1);
  });

  it("la mezza di prova è la domenica 14/02 (sett. 11) e il test soglia il giovedì 3/12 (sett. 1)", () => {
    const half = PLAN_WEEKS[11].sessions.find((s) => s.kind === "half_test");
    expect(half?.weekday).toBe("dom");
    expect(PLAN_WEEKS[11].end).toBe("2027-02-14");
    const test = PLAN_WEEKS[1].sessions.find((s) => s.kind === "threshold_test");
    expect(test?.weekday).toBe("gio");
  });

  it("le fasi coprono le settimane senza buchi e coincidono con le date delle settimane", () => {
    expect(PHASES.map((p) => p.id)).toEqual([0, 1, 2, 3, 4]);
    PHASES.forEach((p, i) => {
      if (i > 0) expect(diffDays(PHASES[i - 1].end, p.start)).toBe(1);
      const weeks = PLAN_WEEKS.filter((w) => w.phase === p.id);
      expect(weeks.length).toBeGreaterThan(0);
      expect(weeks[0].start).toBe(p.start);
      expect(weeks[weeks.length - 1].end).toBe(p.end);
    });
  });

  it("le fasi hanno le settimane attese (0 | 1–4 | 5–10 | 11–13 | 14–15)", () => {
    const idx = (id: number) => PLAN_WEEKS.filter((w) => w.phase === id).map((w) => w.index);
    expect(idx(0)).toEqual([0]);
    expect(idx(1)).toEqual([1, 2, 3, 4]);
    expect(idx(2)).toEqual([5, 6, 7, 8, 9, 10]);
    expect(idx(3)).toEqual([11, 12, 13]);
    expect(idx(4)).toEqual([14, 15]);
  });

  it("solo le settimane 4 e 9 sono di scarico", () => {
    expect(PLAN_WEEKS.filter((w) => w.deload).map((w) => w.index)).toEqual([4, 9]);
  });

  it("le sedute sono in ordine di giorno, senza duplicati, e le corse sono mar/gio/dom", () => {
    for (const w of PLAN_WEEKS) {
      const order = w.sessions.map((s) => WEEKDAYS.indexOf(s.weekday));
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(new Set(order).size).toBe(order.length);
      const runs = w.sessions.filter((s) => !["gym", "rest", "bike"].includes(s.kind));
      expect(runs.map((s) => s.weekday)).toEqual(["mar", "gio", "dom"]);
    }
  });

  it("palestra lun/mer in tutte le settimane tranne quella della gara", () => {
    for (const w of PLAN_WEEKS) {
      const gym = w.sessions.filter((s) => s.kind === "gym").map((s) => s.weekday);
      expect(gym).toEqual(w.index === 15 ? [] : ["lun", "mer"]);
    }
  });

  it("i lunghi seguono il piano (HANDOFF §4)", () => {
    const longKm = PLAN_WEEKS.map((w) => w.sessions.find((s) => s.weekday === "dom")?.km);
    expect(longKm).toEqual([25, 14, 16, 18, 14, 18, 20, 22, 24, 16, 26, 21.1, 28, 32, 20, 42.195]);
  });

  it("i km a ritmo maratona non superano la distanza della seduta", () => {
    for (const w of PLAN_WEEKS)
      for (const s of w.sessions)
        if (s.rmKm !== undefined && s.km !== undefined) expect(s.rmKm).toBeLessThanOrEqual(s.km);
  });
});
