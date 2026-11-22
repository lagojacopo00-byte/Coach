import { describe, expect, it } from "vitest";
import {
  easyPaceRange,
  formatPace,
  hrZones,
  lthrFromTest,
  parsePace,
  thresholdPaceFromTest,
  thresholdPaceRange,
} from "./zones";

describe("zones", () => {
  it("zone da LTHR 170: contigue, senza buchi", () => {
    const z = hrZones(170);
    expect(z.map((x) => x.id)).toEqual(["Z1", "Z2", "Z3", "Z4", "Z5"]);
    expect(z[0]).toMatchObject({ min: 0, max: 145 });
    expect(z[1]).toMatchObject({ min: 146, max: 151 });
    expect(z[2]).toMatchObject({ min: 152, max: 160 });
    expect(z[3]).toMatchObject({ min: 161, max: 168 });
    expect(z[4]).toMatchObject({ min: 169 });
    expect(z[4].max).toBeUndefined();
    for (let i = 1; i < z.length; i++) expect(z[i].min).toBeLessThanOrEqual((z[i - 1].max ?? 0) + 2);
  });

  it("rifiuta LTHR non valido", () => {
    expect(() => hrZones(0)).toThrow(RangeError);
    expect(() => hrZones(-5)).toThrow(RangeError);
  });

  it("LTHR e ritmo soglia dal test arrotondano", () => {
    expect(lthrFromTest(171.6)).toBe(172);
    expect(thresholdPaceFromTest(321.4)).toBe(321);
  });

  it("easy è più lento della soglia di 60–90 s", () => {
    expect(easyPaceRange(320)).toEqual({ fast: 380, slow: 410 });
    const t = thresholdPaceRange(320);
    expect(t.fast).toBeLessThan(t.slow);
  });

  it("formatPace e parsePace sono inversi", () => {
    expect(formatPace(341)).toBe("5:41");
    expect(formatPace(305)).toBe("5:05");
    expect(parsePace("5:41")).toBe(341);
    expect(parsePace("5:61")).toBeUndefined();
    expect(parsePace("abc")).toBeUndefined();
  });
});
