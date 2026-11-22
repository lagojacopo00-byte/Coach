import { describe, expect, it } from "vitest";
import { PHASE_IDS, RUN_FEELINGS, SESSION_KINDS, WEEKDAYS } from "./types";

const unique = (xs: readonly unknown[]) => new Set(xs).size === xs.length;

describe("costanti di dominio", () => {
  it("non hanno duplicati", () => {
    for (const list of [WEEKDAYS, PHASE_IDS, SESSION_KINDS, RUN_FEELINGS]) {
      expect(unique(list)).toBe(true);
    }
  });

  it("la settimana va da lunedì a domenica", () => {
    expect(WEEKDAYS[0]).toBe("lun");
    expect(WEEKDAYS[6]).toBe("dom");
    expect(WEEKDAYS).toHaveLength(7);
  });

  it("le fasi sono 0–4", () => {
    expect([...PHASE_IDS]).toEqual([0, 1, 2, 3, 4]);
  });
});
