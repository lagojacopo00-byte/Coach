import { describe, expect, it } from "vitest";
import { KIND_LABEL, paceHint, shortDate } from "./guidance";
import { defaultProfile } from "./profile";
import { recalcFromThresholdTest, applyRecalculation } from "./rules";
import { SESSION_KINDS, type Session } from "./types";

const s = (kind: Session["kind"]): Session => ({ weekday: "mar", kind, description: "" });

describe("guidance", () => {
  it("prima del test l'easy è a sensazione, senza numeri inventati", () => {
    expect(paceHint(s("easy"), defaultProfile())).toMatch(/talk test/);
  });
  it("dopo il test i ritmi e la FC Z2 vengono dal profilo", () => {
    const p = applyRecalculation(defaultProfile(), recalcFromThresholdTest({ last20AvgHr: 170, last20PaceSecPerKm: 330 }));
    const h = paceHint(s("easy"), p)!;
    expect(h).toContain("6:30–7:00/km");
    expect(h).toContain("146–151 bpm");
    expect(paceHint(s("threshold"), p)).toContain("FC Z4");
  });
  it("RM al ritmo del piano 5:40", () => {
    expect(paceHint(s("long_rm"), defaultProfile())).toContain("5:40/km");
  });
  it("ogni tipo di seduta ha un'etichetta", () => {
    for (const k of SESSION_KINDS) expect(KIND_LABEL[k]).toBeTruthy();
  });
  it("shortDate", () => {
    expect(shortDate("2026-11-23")).toBe("23 nov");
    expect(shortDate("2027-03-14")).toBe("14 mar");
  });
});

import { formatDuration, parseDuration } from "./guidance";
describe("durate", () => {
  it("parseDuration", () => {
    expect(parseDuration("48:30")).toBe(2910);
    expect(parseDuration("1:54:00")).toBe(6840);
    expect(parseDuration("1:60:00")).toBeUndefined();
    expect(parseDuration("45")).toBeUndefined();
    expect(parseDuration("a:bc")).toBeUndefined();
    expect(parseDuration("0:00")).toBeUndefined();
  });
  it("formatDuration", () => {
    expect(formatDuration(2910)).toBe("48:30");
    expect(formatDuration(6840)).toBe("1:54:00");
  });
});
