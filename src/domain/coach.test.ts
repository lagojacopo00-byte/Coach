import { describe, expect, it } from "vitest";
import { adviceForWeek, baseWeeklyKm, easyPaceOf, effectiveWeek, globalAdvice, stopStatus } from "./coach";
import { weekView } from "./views";
import { PLAN_WEEKS } from "./plan.seed";
import { addCheckIn, addRun, clearRunStop, initialState, recordHalf, recordThresholdTest, type AppState } from "./state";
import type { Run } from "./types";

const W2 = PLAN_WEEKS[2]; // 7–13 dic: mar 8 salite, gio 10 easy, dom 13 lungo 16 km
const run = (over: Partial<Run> = {}): Run => ({
  id: "r" + Math.random(),
  date: "2026-12-01",
  kind: "easy",
  km: 8,
  durationSec: 3000,
  pain: 0,
  ...over,
});
const kindOn = (s: AppState, w: typeof W2, wd: string) => effectiveWeek(w, s).week.sessions.find((x) => x.weekday === wd)!.kind;

describe("coach: override", () => {
  it("senza segnalazioni il piano è quello del seed", () => {
    const e = effectiveWeek(W2, initialState());
    expect(e.adjustments).toEqual([]);
    expect(e.week.sessions).toEqual(W2.sessions);
  });

  it("R2: gambe pesanti il martedì → easy, con motivo; il seed non cambia", () => {
    const s = addCheckIn(initialState(), { date: "2026-12-08", pain: 0, heavyLegs: true });
    const e = effectiveWeek(W2, s);
    expect(kindOn(s, W2, "mar")).toBe("easy");
    expect(kindOn(s, W2, "gio")).toBe("easy");
    expect(e.adjustments).toHaveLength(1);
    expect(e.adjustments[0]).toMatchObject({ rule: "R2", weekday: "mar", original: { kind: "hills" } });
    expect(e.adjustments[0].reason).toMatch(/Gambe pesanti/);
    expect(W2.sessions.find((x) => x.weekday === "mar")!.kind).toBe("hills");
  });

  it("R2: tibia a 3/10 diffusa → easy; a 2/10 no", () => {
    const hi = addCheckIn(initialState(), { date: "2026-12-08", pain: 3, painLocation: "tibia", painType: "diffuso" });
    const lo = addCheckIn(initialState(), { date: "2026-12-08", pain: 2, painLocation: "tibia", painType: "diffuso" });
    expect(kindOn(hi, W2, "mar")).toBe("easy");
    expect(kindOn(lo, W2, "mar")).toBe("hills");
  });

  it("R2 vale per il giorno della segnalazione, non per gli altri", () => {
    const s = addCheckIn(initialState(), { date: "2026-12-07", pain: 0, heavyLegs: true });
    expect(kindOn(s, W2, "mar")).toBe("hills");
  });

  it("R2 non tocca una seduta già corsa", () => {
    let s = addRun(initialState(), run({ date: "2026-12-08", kind: "hills", heavyLegs: true }));
    s = addCheckIn(s, { date: "2026-12-08", pain: 0, heavyLegs: true });
    expect(effectiveWeek(W2, s).adjustments).toEqual([]);
  });

  it("R3: puntiforme sulla tibia → corse successive diventano bici, anche nelle settimane dopo", () => {
    const s = addCheckIn(initialState(), { date: "2026-12-08", pain: 2, painLocation: "tibia", painType: "puntiforme" });
    expect(stopStatus(s)).toEqual({ active: true, since: "2026-12-08" });
    expect(kindOn(s, W2, "mar")).toBe("bike");
    expect(kindOn(s, W2, "gio")).toBe("bike");
    expect(kindOn(s, W2, "dom")).toBe("bike");
    expect(kindOn(s, PLAN_WEEKS[3], "dom")).toBe("bike");
    expect(kindOn(s, PLAN_WEEKS[1], "dom")).toBe("long"); // prima della segnalazione
    expect(kindOn(s, W2, "lun")).toBe("gym");
  });

  it("R3 ha la precedenza su R2", () => {
    const s = addCheckIn(initialState(), { date: "2026-12-08", pain: 5, painLocation: "tibia", painType: "puntiforme", heavyLegs: true });
    const adj = effectiveWeek(W2, s).adjustments;
    expect(adj.every((a) => a.rule === "R3")).toBe(true);
  });

  it("R3: lo stop finisce solo con un via libera DOPO la segnalazione", () => {
    const base = addCheckIn(initialState(), { date: "2026-12-08", pain: 2, painLocation: "tibia", painType: "puntiforme" });
    expect(stopStatus(clearRunStop(base, "2026-12-08")).active).toBe(true); // stesso giorno: non basta
    const ok = clearRunStop(base, "2026-12-10");
    expect(stopStatus(ok).active).toBe(false);
    expect(kindOn(ok, W2, "dom")).toBe("long");
  });

  it("R3: una nuova segnalazione dopo il via libera riattiva lo stop", () => {
    let s = clearRunStop(
      addCheckIn(initialState(), { date: "2026-12-08", pain: 2, painLocation: "tibia", painType: "puntiforme" }),
      "2026-12-10",
    );
    s = addCheckIn(s, { date: "2026-12-12", pain: 2, painLocation: "tibia", painType: "puntiforme" });
    expect(stopStatus(s)).toEqual({ active: true, since: "2026-12-12" });
  });

  it("R3 dal log di una corsa (non solo dal check-in)", () => {
    const s = addRun(initialState(), run({ date: "2026-12-08", kind: "hills", pain: 4, painLocation: "tibia", painType: "puntiforme" }));
    expect(stopStatus(s).active).toBe(true);
  });
});

describe("coach: messaggi", () => {
  it("R3 compare tra i messaggi globali e rimanda al professionista", () => {
    const s = addCheckIn(initialState(), { date: "2026-12-08", pain: 2, painLocation: "tibia", painType: "puntiforme" });
    const a = globalAdvice(s, "2026-12-08").find((x) => x.rule === "R3")!;
    expect(a.level).toBe("stop");
    expect(a.seeProfessional).toBe(true);
  });

  it("R4: seduta saltata → non recuperare", () => {
    const a = adviceForWeek(PLAN_WEEKS[2], initialState(), "2026-12-13");
    expect(a.some((x) => x.rule === "R4")).toBe(true);
  });

  it("R6: il lungo da 16 km è oltre i 90' → promemoria gel", () => {
    const a = adviceForWeek(PLAN_WEEKS[2], initialState(), "2026-12-07");
    expect(a.some((x) => x.rule === "R6")).toBe(true);
  });

  it("R1: base di onboarding bassa → avviso; base adeguata → nessun avviso", () => {
    const low = { ...initialState(), baselineWeeklyKm: 15 };
    expect(adviceForWeek(PLAN_WEEKS[2], low, "2026-12-07").some((x) => x.rule === "R1")).toBe(true);
    const ok = { ...initialState(), baselineWeeklyKm: 40 };
    expect(adviceForWeek(PLAN_WEEKS[2], ok, "2026-12-07").some((x) => x.rule === "R1")).toBe(false);
    expect(adviceForWeek(PLAN_WEEKS[2], initialState(), "2026-12-07").some((x) => x.rule === "R1")).toBe(false);
  });

  it("baseWeeklyKm salta le settimane di scarico", () => {
    const s = addRun(addRun(initialState(), run({ date: "2026-12-16", km: 30 })), run({ date: "2026-12-22", km: 10 }));
    // sett. 3 = 14–20 dic (30 km), sett. 4 = scarico (10 km) → per la sett. 5 la base è la 3
    expect(baseWeeklyKm(s, PLAN_WEEKS[5])).toBe(30);
  });

  it("R5: test soglia in arrivo, poi da registrare, poi sparisce", () => {
    expect(globalAdvice(initialState(), "2026-11-30").find((x) => x.rule === "R5")?.title).toMatch(/3 giorni/);
    expect(globalAdvice(initialState(), "2026-12-03").find((x) => x.rule === "R5")?.title).toMatch(/Oggi/);
    expect(globalAdvice(initialState(), "2026-12-05").find((x) => x.rule === "R5")?.level).toBe("warning");
    const { state } = recordThresholdTest(initialState(), { date: "2026-12-03", last20AvgHr: 172, last20PaceSecPerKm: 330 });
    expect(globalAdvice(state, "2026-12-05").some((x) => x.rule === "R5")).toBe(false);
  });

  it("R5: dopo il test il passo easy per le stime segue il profilo", () => {
    expect(easyPaceOf(initialState().profile)).toBe(420);
    const { state } = recordThresholdTest(initialState(), { date: "2026-12-03", last20AvgHr: 172, last20PaceSecPerKm: 330 });
    expect(easyPaceOf(state.profile)).toBe(405);
  });

  it("R7: mezza registrata oltre 1:54 → proposta; non registrata dopo il 14/02 → promemoria", () => {
    const s = recordHalf(initialState(), { date: "2027-02-14", timeSec: 118 * 60 });
    expect(globalAdvice(s, "2027-02-15").find((x) => x.rule === "R7")?.level).toBe("warning");
    expect(globalAdvice(initialState(), "2027-02-16").find((x) => x.rule === "R7")?.title).toMatch(/da registrare/);
    expect(globalAdvice(initialState(), "2027-02-10").some((x) => x.rule === "R7")).toBe(false);
  });

  it("test soglia a gambe pesanti: avviso invece di sostituzione", () => {
    const s = addCheckIn(initialState(), { date: "2026-12-03", pain: 0, heavyLegs: true });
    const a = adviceForWeek(PLAN_WEEKS[1], s, "2026-12-03");
    expect(a.some((x) => /spostarlo/.test(x.title))).toBe(true);
    expect(kindOn(s, PLAN_WEEKS[1], "gio")).toBe("threshold_test");
  });
});

describe("coach: un solo avviso R3 per settimana", () => {
  it("niente banner duplicati", () => {
    const s = addCheckIn(initialState(), { date: "2026-12-08", pain: 2, painLocation: "tibia", painType: "puntiforme" });
    const r3 = adviceForWeek(W2, s, "2026-12-08").filter((a) => a.rule === "R3");
    expect(r3).toHaveLength(1);
    expect(r3[0].title).toMatch(/MAR|GIO|DOM/);
    const today = globalAdvice(s, "2026-12-08").filter((a) => a.rule === "R3");
    expect(today).toHaveLength(1);
  });
});

import { extraEasyReport } from "./coach";
describe("coach: easy facoltativa R8", () => {
  const W5 = PLAN_WEEKS[5]; // 28 dic – 3 gen
  const wed = (s: AppState, w: typeof W5, today?: string) => effectiveWeek(w, s, today).week.sessions.find((x) => x.weekday === "mer")!;

  it("dalla settimana 5, senza segnalazioni, il mercoledì diventa easy facoltativa, con motivo", () => {
    const e = effectiveWeek(W5, initialState(), "2026-12-28");
    expect(wed(initialState(), W5, "2026-12-28")).toMatchObject({ kind: "easy", optional: true });
    expect(e.adjustments.map((a) => a.rule)).toEqual(["R8"]);
    expect(e.adjustments[0].original.kind).toBe("rest");
  });
  it("prima della settimana 5 resta riposo", () => {
    expect(wed(initialState(), PLAN_WEEKS[4], "2026-12-21").kind).toBe("rest");
  });
  it("senza data (today) non si applica", () => {
    expect(wed(initialState(), W5).kind).toBe("rest");
  });
  it("si spegne con dolore a 3/10 alla tibia o con lo stop", () => {
    const s = addCheckIn(initialState(), { date: "2026-12-20", pain: 3, painLocation: "tibia", painType: "diffuso" });
    expect(wed(s, W5, "2026-12-28").kind).toBe("rest");
    expect(extraEasyReport(W5, s, "2026-12-28").reasons.join(" ")).toMatch(/Dolore/);
    const stop = addCheckIn(initialState(), { date: "2026-12-27", pain: 2, painLocation: "tibia", painType: "puntiforme" });
    expect(wed(stop, W5, "2026-12-28").kind).toBe("rest");
    expect(extraEasyReport(W5, stop, "2026-12-28").eligible).toBe(false);
  });
  it("si può disattivare dal profilo", () => {
    expect(wed({ ...initialState(), extraEasyOff: true }, W5, "2026-12-28").kind).toBe("rest");
  });
  it("non conta come saltata né nei km pianificati", () => {
    const wv = weekView(initialState(), W5, "2027-01-03");
    const mer = wv.summary.statuses.find((x) => x.session.weekday === "mer")!;
    expect(mer.state).toBe("optional");
    expect(wv.summary.plannedRuns).toBe(3);
    expect(adviceForWeek(W5, initialState(), "2027-01-03").some((a) => a.rule === "R8")).toBe(false);
  });
  it("se la corri, conta come fatta e nei km fatti", () => {
    const s = addRun(initialState(), run({ date: "2026-12-30", km: 5 }));
    const wv = weekView(s, W5, "2027-01-03");
    expect(wv.summary.statuses.find((x) => x.session.weekday === "mer")!.state).toBe("done");
    expect(wv.actualKm).toBe(5);
  });
});
