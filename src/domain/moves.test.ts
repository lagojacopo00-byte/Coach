import { describe, expect, it } from "vitest";
import { effectiveWeek } from "./coach";
import { applySwaps, swapTargets, whyNotSwap, type SwapContext } from "./moves";
import { PLAN_WEEKS } from "./plan.seed";
import { addCheckIn, addRun, initialState, moveDay, parseState, resetWeekMoves, saveGymLog } from "./state";
import { WEEKDAYS } from "./types";
import { nextRunSession, weekView } from "./views";

const W0 = PLAN_WEEKS[0]; // 23–29 nov: lun palestra, mar easy, mer palestra, gio easy, ven riposo, sab riposo, dom trail
const kinds = (w: typeof W0) => w.sessions.map((s) => `${s.weekday}:${s.kind}`).join(" ");
const ctx = (over: Partial<SwapContext> = {}): SwapContext => ({ week: W0, today: "2026-11-24", runs: [], gymLogs: [], skips: [], ...over });

describe("applySwaps", () => {
  it("scambia due giorni: la palestra di mercoledì va a venerdì, il venerdì (riposo) passa a mercoledì", () => {
    const w = applySwaps(W0, [{ weekIndex: 0, a: "mer", b: "ven" }]);
    expect(kinds(w)).toBe("lun:gym mar:easy mer:rest gio:easy ven:gym sab:rest dom:trail");
    expect(w.sessions.find((s) => s.weekday === "ven")?.from).toBe("mer");
    expect(w.sessions.find((s) => s.weekday === "ven")?.description).toMatch(/full body B/);
  });
  it("le sedute restano in ordine di giorno, senza duplicati", () => {
    const w = applySwaps(W0, [{ weekIndex: 0, a: "mar", b: "sab" }, { weekIndex: 0, a: "gio", b: "ven" }]);
    const idx = w.sessions.map((s) => WEEKDAYS.indexOf(s.weekday));
    expect(idx).toEqual([...idx].sort((x, y) => x - y));
    expect(new Set(idx).size).toBe(idx.length);
    expect(w.sessions).toHaveLength(7);
  });
  it("scambiare di nuovo gli stessi giorni riporta il piano com'era", () => {
    const w = applySwaps(W0, [{ weekIndex: 0, a: "mer", b: "ven" }, { weekIndex: 0, a: "mer", b: "ven" }]);
    expect(w.sessions).toEqual(W0.sessions);
  });
  it("non tocca il piano base né le altre settimane", () => {
    const before = JSON.stringify(PLAN_WEEKS);
    applySwaps(W0, [{ weekIndex: 0, a: "mer", b: "ven" }]);
    expect(JSON.stringify(PLAN_WEEKS)).toBe(before);
    expect(applySwaps(W0, [{ weekIndex: 3, a: "mer", b: "ven" }]).sessions).toEqual(W0.sessions);
  });
  it("sposta anche una corsa: l'easy di giovedì va a venerdì", () => {
    expect(kinds(applySwaps(W0, [{ weekIndex: 0, a: "gio", b: "ven" }]))).toBe("lun:gym mar:easy mer:gym gio:rest ven:easy sab:rest dom:trail");
  });
  it("settimana della gara (senza palestra): un giorno senza seduta riceve un riposo e torna com'era scambiando di nuovo", () => {
    const W15 = PLAN_WEEKS[15];
    expect(W15.sessions.some((s) => s.weekday === "lun")).toBe(false);
    const w = applySwaps(W15, [{ weekIndex: 15, a: "gio", b: "lun" }]);
    expect(w.sessions.find((s) => s.weekday === "lun")?.kind).toBe("easy");
    expect(w.sessions.find((s) => s.weekday === "gio")?.kind).toBe("rest");
    expect(applySwaps(W15, [{ weekIndex: 15, a: "gio", b: "lun" }, { weekIndex: 15, a: "gio", b: "lun" }]).sessions).toEqual(W15.sessions);
  });
});

describe("whyNotSwap: cosa non si può spostare", () => {
  it("due giorni normali sì", () => {
    expect(whyNotSwap(ctx(), "mer", "ven")).toBeUndefined();
    expect(whyNotSwap(ctx(), "mar", "gio")).toBeUndefined(); // oggi è martedì: oggi si può
  });
  it("lo stesso giorno, o due riposi, no", () => {
    expect(whyNotSwap(ctx(), "mer", "mer")).toMatch(/due giorni diversi/);
    expect(whyNotSwap(ctx(), "ven", "sab")).toMatch(/niente da spostare/);
  });
  it("i giorni passati no", () => {
    expect(whyNotSwap(ctx(), "lun", "ven")).toMatch(/Lunedì è già passato/);
    expect(whyNotSwap(ctx(), "ven", "lun")).toMatch(/Lunedì è già passato/);
  });
  it("i giorni già fatti no (corsa o palestra registrata)", () => {
    const run = { id: "r", date: "2026-11-24", kind: "easy" as const, km: 5, durationSec: 1500, pain: 0 };
    expect(whyNotSwap(ctx({ runs: [run], today: "2026-11-24" }), "mar", "ven")).toMatch(/Martedì è già fatto/);
    const gym = { id: "g", date: "2026-11-25", workoutId: "B", entries: [] };
    expect(whyNotSwap(ctx({ gymLogs: [gym] }), "mer", "ven")).toMatch(/Mercoledì è già fatto/);
  });
  it("un giorno segnato non fatto no", () => {
    expect(whyNotSwap(ctx({ skips: [{ date: "2026-11-26" }] }), "gio", "ven")).toMatch(/Giovedì è segnato come non fatto/);
  });
  it("swapTargets elenca solo i giorni validi", () => {
    expect(swapTargets(ctx(), "mer")).toEqual(["mar", "gio", "ven", "sab", "dom"]);
    expect(swapTargets(ctx({ today: "2026-11-27" }), "ven")).toEqual(["dom"]); // sabato è un altro riposo
  });
});

describe("moveDay nello stato", () => {
  it("registra lo scambio e il piano effettivo cambia subito (Oggi e Settimane leggono lo stesso)", () => {
    const s = moveDay(initialState(), 0, "mer", "ven", "2026-11-24");
    expect(s.swaps).toEqual([{ weekIndex: 0, a: "mer", b: "ven" }]);
    expect(kinds(effectiveWeek(W0, s, "2026-11-24").week)).toBe("lun:gym mar:easy mer:rest gio:easy ven:gym sab:rest dom:trail");
    const wv = weekView(s, W0, "2026-11-24");
    expect(wv.summary.statuses.find((x) => x.session.weekday === "ven")?.session.kind).toBe("gym");
    expect(wv.summary.statuses.find((x) => x.session.weekday === "ven")?.date).toBe("2026-11-27");
  });
  it("non muta lo stato precedente; i motivi arrivano come errore", () => {
    const s0 = initialState();
    moveDay(s0, 0, "mer", "ven", "2026-11-24");
    expect(s0.swaps).toEqual([]);
    expect(() => moveDay(s0, 0, "lun", "ven", "2026-11-24")).toThrow(/già passato/);
    expect(() => moveDay(s0, 99, "mer", "ven", "2026-11-24")).toThrow(RangeError);
  });
  it("scambi in sequenza: ogni scambio vale sul piano già spostato", () => {
    let s = moveDay(initialState(), 0, "mer", "ven", "2026-11-24"); // palestra → ven
    s = moveDay(s, 0, "ven", "sab", "2026-11-24"); // la palestra (ora di venerdì) → sab
    expect(kinds(effectiveWeek(W0, s, "2026-11-24").week)).toBe("lun:gym mar:easy mer:rest gio:easy ven:rest sab:gym dom:trail");
    expect(effectiveWeek(W0, s, "2026-11-24").week.sessions.find((x) => x.weekday === "sab")?.from).toBe("mer");
  });
  it("la regola dei giorni fatti vale sul piano spostato", () => {
    const s = moveDay(initialState(), 0, "mer", "ven", "2026-11-24");
    const withGym = saveGymLog(s, { id: "g", date: "2026-11-27", workoutId: "B", entries: [{ exerciseId: "rdl", name: "x", sets: [{ weightKg: 1, reps: 5 }] }] });
    expect(() => moveDay(withGym, 0, "ven", "sab", "2026-11-27")).toThrow(/già fatto/);
  });
  it("resetWeekMoves toglie solo quella settimana", () => {
    let s = moveDay(initialState(), 0, "mer", "ven", "2026-11-24");
    s = moveDay(s, 2, "mer", "ven", "2026-12-08");
    s = resetWeekMoves(s, 0);
    expect(s.swaps).toEqual([{ weekIndex: 2, a: "mer", b: "ven" }]);
    expect(kinds(effectiveWeek(W0, s, "2026-11-24").week)).toBe(kinds(W0));
  });
  it("un vecchio salvataggio senza spostamenti si legge lo stesso", () => {
    const old = { ...initialState() } as Record<string, unknown>;
    delete old.swaps;
    expect(parseState(old)?.swaps).toEqual([]);
  });
});

describe("spostamenti e regole del coach", () => {
  it("R2 guarda il giorno in cui la qualità è finita: gambe pesanti il nuovo giorno → easy", () => {
    const W2 = PLAN_WEEKS[2]; // mar salite, gio easy
    let s = moveDay(initialState(), 2, "mar", "gio", "2026-12-07"); // le salite passano a giovedì 10
    s = addCheckIn(s, { date: "2026-12-08", pain: 0, heavyLegs: true }); // martedì: nessuna qualità lì adesso
    expect(effectiveWeek(W2, s, "2026-12-07").week.sessions.find((x) => x.weekday === "gio")?.kind).toBe("hills");
    s = addCheckIn(s, { date: "2026-12-10", pain: 0, heavyLegs: true });
    expect(effectiveWeek(W2, s, "2026-12-07").week.sessions.find((x) => x.weekday === "gio")?.kind).toBe("easy");
  });
  it("lo stop R3 si applica alle corse nei giorni nuovi", () => {
    let s = moveDay(initialState(), 0, "gio", "ven", "2026-11-24");
    s = addCheckIn(s, { date: "2026-11-25", pain: 2, painLocation: "tibia", painType: "puntiforme" });
    expect(effectiveWeek(W0, s, "2026-11-25").week.sessions.find((x) => x.weekday === "ven")?.kind).toBe("bike");
  });
  it("la easy facoltativa (venerdì) non compare se il venerdì non è più un riposo", () => {
    const W5 = PLAN_WEEKS[5];
    const s = moveDay(initialState(), 5, "mer", "ven", "2026-12-28"); // palestra a venerdì
    expect(effectiveWeek(W5, s, "2026-12-28").week.sessions.find((x) => x.weekday === "ven")?.kind).toBe("gym");
    expect(effectiveWeek(W5, s, "2026-12-28").adjustments.some((a) => a.rule === "R8")).toBe(false);
  });
  it("la prossima corsa segue lo spostamento", () => {
    const s = moveDay(initialState(), 0, "gio", "ven", "2026-11-24");
    expect(nextRunSession(s, "2026-11-25")?.date).toBe("2026-11-27");
    expect(nextRunSession(initialState(), "2026-11-25")?.date).toBe("2026-11-26");
  });
  it("una corsa registrata il giorno vecchio non si perde (resta fatta in quel giorno)", () => {
    const s = addRun(initialState(), { id: "r", date: "2026-11-24", kind: "easy", km: 5, durationSec: 1500, pain: 0 });
    expect(() => moveDay(s, 0, "mar", "ven", "2026-11-24")).toThrow(/già fatto/);
  });
});

import { undoLastMove } from "./state";
describe("undoLastMove", () => {
  it("toglie solo l'ultimo spostamento di quella settimana", () => {
    let s = moveDay(initialState(), 0, "mer", "ven", "2026-11-24");
    s = moveDay(s, 0, "ven", "sab", "2026-11-24");
    s = undoLastMove(s, 0);
    expect(s.swaps).toEqual([{ weekIndex: 0, a: "mer", b: "ven" }]);
    expect(undoLastMove(initialState(), 0).swaps).toEqual([]);
    const other = moveDay(moveDay(initialState(), 0, "mer", "ven", "2026-11-24"), 2, "mer", "ven", "2026-12-08");
    expect(undoLastMove(other, 0).swaps).toEqual([{ weekIndex: 2, a: "mer", b: "ven" }]);
  });
});
