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

import { sessionBrief, KIND_SHORT, WEEKDAY_SHORT } from "./guidance";
import { PLAN_WEEKS } from "./plan.seed";

describe("sessionBrief: cosa devo fare, al volo", () => {
  const on = (w: number, wd: string) => sessionBrief(PLAN_WEEKS[w].sessions.find((x) => x.weekday === wd)!);
  it("easy a tempo e con allunghi", () => {
    expect(on(0, "gio")).toEqual({ main: "30'", sub: undefined });
    expect(on(3, "gio")).toEqual({ main: "45'", sub: "+6 allunghi" });
    expect(on(4, "mar")).toEqual({ main: "40'", sub: "+4 allunghi" });
  });
  it("salite e soglia: le ripetute", () => {
    expect(on(2, "mar").main).toBe('6×30"');
    expect(on(11, "mar").main).toBe('6×90"');
    expect(on(13, "mar").main).toBe("6×2'");
    expect(on(6, "mar").main).toBe("3×8'");
    expect(on(10, "mar").main).toBe("2×15'");
  });
  it("lunghi, con i km a RM", () => {
    expect(on(1, "dom")).toEqual({ main: "14 km" });
    expect(on(6, "dom")).toEqual({ main: "20 km", sub: "4 a RM" });
    expect(on(13, "dom")).toEqual({ main: "32 km", sub: "12 a RM" });
  });
  it("trail, mezza, maratona, test", () => {
    expect(on(0, "dom").main).toBe("25 km");
    expect(on(11, "dom").main).toBe("21,1 km");
    expect(on(15, "dom").main).toBe("42,2 km");
    expect(on(1, "gio").main).toBe("30'");
  });
  it("blocchi a RM nei tre formati del piano", () => {
    expect(on(12, "gio")).toEqual({ main: "10 km", sub: "6 a RM" });
    expect(on(13, "gio")).toEqual({ main: "60'", sub: "8 km RM" });
    expect(on(14, "mar")).toEqual({ main: "3×3 km", sub: "a RM" });
  });
  it("palestra e riposo non hanno dati", () => {
    expect(on(2, "lun").main).toBe("");
    expect(on(2, "ven").main).toBe("");
  });
  it("ogni seduta di ogni settimana ha un'etichetta breve e i corse hanno un dato", () => {
    for (const w of PLAN_WEEKS)
      for (const s of w.sessions) {
        expect(KIND_SHORT[s.kind]).toBeTruthy();
        if (!["gym", "rest"].includes(s.kind)) expect(sessionBrief(s).main, `${w.index} ${s.weekday}`).not.toBe("");
      }
    expect(WEEKDAY_SHORT.lun).toBe("Lun");
  });
});

import { detailText } from "./guidance";
describe("detailText", () => {
  it("toglie la ripetizione nelle salite, lascia il resto", () => {
    const hills = PLAN_WEEKS[2].sessions.find((x) => x.kind === "hills")!;
    expect(detailText(hills)).toBe("15' easy di riscaldamento, 10' di defaticamento");
    const thr = PLAN_WEEKS[6].sessions.find((x) => x.kind === "threshold")!;
    expect(detailText(thr)).toBe(thr.description);
    const easy = PLAN_WEEKS[0].sessions.find((x) => x.kind === "easy")!;
    expect(detailText(easy)).toBe(easy.description);
  });
});
