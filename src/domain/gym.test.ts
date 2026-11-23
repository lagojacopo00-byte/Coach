import { describe, expect, it } from "vitest";
import {
  defaultGymPlan,
  exerciseHistory,
  lastSets,
  logVolume,
  suggestNext,
  validateGymLog,
  validateGymPlan,
  volumeOf,
  workoutOn,
  type Exercise,
  type GymLog,
} from "./gym";
import { gymPlanOf, initialState, parseState, removeGymLog, resetGymPlan, saveGymLog, setGymPlan } from "./state";

const squat: Exercise = { id: "squat", name: "Squat", sets: 3, repMin: 5, repMax: 8, incrementKg: 5 };
const log = (over: Partial<GymLog> & { sets?: [number, number][] }): GymLog => ({
  id: over.id ?? "l" + Math.random(),
  date: over.date ?? "2026-12-07",
  workoutId: over.workoutId ?? "A",
  entries: [{ exerciseId: "squat", name: "Squat", sets: (over.sets ?? [[60, 8], [60, 8], [60, 8]]).map(([w, r]) => ({ weightKg: w, reps: r })) }],
});

describe("scheda di partenza", () => {
  const plan = defaultGymPlan();
  it("due allenamenti: A il lunedì, B il venerdì", () => {
    expect(plan.map((w) => [w.id, w.weekday])).toEqual([["A", "lun"], ["B", "ven"]]);
    expect(workoutOn(plan, "ven")?.id).toBe("B");
    expect(workoutOn(plan, "mar")).toBeUndefined();
  });
  it("è valida e contiene la prevenzione tibie/polpacci del HANDOFF", () => {
    expect(validateGymPlan(plan)).toEqual([]);
    const names = plan.flatMap((w) => w.exercises.map((e) => e.name)).join("|");
    expect(names).toMatch(/Calf raise eccentrico/);
    expect(names).toMatch(/Tibialis raise/);
    expect(names).toMatch(/single-leg RDL/);
  });
  it("venerdì (gambe leggere): lo stacco a una gamba non si aumenta e non c'è squat", () => {
    const b = plan[1];
    expect(b.exercises.find((e) => e.id === "slrdl")?.noIncrease).toBe(true);
    expect(b.exercises.some((e) => /squat/i.test(e.name))).toBe(false);
  });
  it("id degli esercizi unici in tutta la scheda", () => {
    const ids = plan.flatMap((w) => w.exercises.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("validazione", () => {
  it("scheda: duplicati, range e serie", () => {
    const p = defaultGymPlan();
    p[0].exercises[1].id = p[0].exercises[0].id;
    expect(validateGymPlan(p).join()).toMatch(/duplicato/);
    const q = defaultGymPlan();
    q[0].exercises[0].repMin = 9;
    expect(validateGymPlan(q).join()).toMatch(/range/);
    const r = defaultGymPlan();
    r[0].exercises[0].sets = 0;
    expect(validateGymPlan(r).join()).toMatch(/serie/);
    const n = defaultGymPlan();
    n[0].exercises[0].name = "  ";
    expect(validateGymPlan(n).join()).toMatch(/senza nome/);
  });
  it("log: pesi e ripetizioni", () => {
    expect(validateGymLog(log({}))).toBeUndefined();
    expect(validateGymLog({ ...log({}), entries: [] })).toBeDefined();
    expect(validateGymLog(log({ sets: [[60, 0]] }))).toMatch(/ripetizioni/);
    expect(validateGymLog(log({ sets: [[-5, 8]] }))).toMatch(/peso/);
    expect(validateGymLog(log({ sets: [[60, 8.5]] }))).toMatch(/ripetizioni/);
  });
});

describe("progressione (doppia)", () => {
  it("prima volta: nessun suggerimento", () => {
    expect(suggestNext(squat, undefined)).toBeUndefined();
    expect(suggestNext(squat, [])).toBeUndefined();
  });
  it("tutte le serie al massimo → sali di peso e riparti dal minimo", () => {
    const s = suggestNext(squat, [{ weightKg: 60, reps: 8 }, { weightKg: 60, reps: 8 }, { weightKg: 60, reps: 8 }])!;
    expect(s).toMatchObject({ kind: "increase", weightKg: 65, targetReps: 5 });
    expect(s.text).toMatch(/65 kg/);
  });
  it("incremento con la virgola (2,5 kg)", () => {
    const panca: Exercise = { ...squat, id: "panca", incrementKg: 2.5 };
    expect(suggestNext(panca, [{ weightKg: 40, reps: 8 }, { weightKg: 40, reps: 8 }, { weightKg: 40, reps: 8 }])?.text).toMatch(/42,5 kg/);
  });
  it("serie incomplete → stesso peso, punta al massimo; non scala mai da sola", () => {
    const s = suggestNext(squat, [{ weightKg: 60, reps: 8 }, { weightKg: 60, reps: 6 }, { weightKg: 60, reps: 4 }])!;
    expect(s).toMatchObject({ kind: "repeat", weightKg: 60, targetReps: 8 });
    const bad = suggestNext(squat, [{ weightKg: 60, reps: 3 }, { weightKg: 60, reps: 3 }, { weightKg: 60, reps: 2 }])!;
    expect(bad.weightKg).toBe(60);
  });
  it("meno serie del previsto non basta per salire", () => {
    expect(suggestNext(squat, [{ weightKg: 60, reps: 8 }, { weightKg: 60, reps: 8 }])?.kind).toBe("repeat");
  });
  it("serie a pesi diversi: vale il peso di lavoro più alto", () => {
    const s = suggestNext(squat, [{ weightKg: 50, reps: 8 }, { weightKg: 60, reps: 8 }, { weightKg: 60, reps: 7 }])!;
    expect(s.weightKg).toBe(60);
    expect(s.kind).toBe("repeat");
  });
  it("noIncrease (gambe leggere del venerdì): mai aumenti", () => {
    const light: Exercise = { ...squat, noIncrease: true, note: "Gambe leggere." };
    const s = suggestNext(light, [{ weightKg: 20, reps: 8 }, { weightKg: 20, reps: 8 }, { weightKg: 20, reps: 8 }])!;
    expect(s).toMatchObject({ kind: "hold", weightKg: 20 });
  });
  it("incremento 0 (peso corpo): nessun aumento automatico", () => {
    const dead: Exercise = { ...squat, incrementKg: 0 };
    expect(suggestNext(dead, [{ weightKg: 0, reps: 8 }, { weightKg: 0, reps: 8 }, { weightKg: 0, reps: 8 }])?.kind).toBe("hold");
  });
});

describe("storico", () => {
  const logs = [log({ id: "a", date: "2026-12-07", sets: [[60, 8], [60, 7], [60, 6]] }), log({ id: "b", date: "2026-12-14", sets: [[62.5, 5], [62.5, 5], [62.5, 5]] })];
  it("lastSets: l'ultima volta, anche prima di una data", () => {
    expect(lastSets(logs, "squat")?.date).toBe("2026-12-14");
    expect(lastSets(logs, "squat", "2026-12-14")?.date).toBe("2026-12-07");
    expect(lastSets(logs, "squat", "2026-12-07")).toBeUndefined();
    expect(lastSets(logs, "panca")).toBeUndefined();
  });
  it("exerciseHistory in ordine di data con peso massimo e volume", () => {
    const h = exerciseHistory(logs, "squat");
    expect(h.map((p) => p.date)).toEqual(["2026-12-07", "2026-12-14"]);
    expect(h[1]).toMatchObject({ topWeightKg: 62.5, repsAtTop: 5, volume: 937.5 });
    expect(h[0].volume).toBe(60 * 8 + 60 * 7 + 60 * 6);
  });
  it("volume", () => {
    expect(volumeOf([{ weightKg: 10, reps: 10 }, { weightKg: 20, reps: 5 }])).toBe(200);
    expect(logVolume(logs[1])).toBe(937.5);
  });
});

describe("stato palestra", () => {
  it("parte dalla scheda di default; si personalizza e si ripristina", () => {
    let s = initialState();
    expect(gymPlanOf(s)).toHaveLength(2);
    const plan = defaultGymPlan();
    plan[0].exercises[0].name = "Squat al multipower";
    s = setGymPlan(s, plan);
    expect(gymPlanOf(s)[0].exercises[0].name).toBe("Squat al multipower");
    expect(gymPlanOf(resetGymPlan(s))[0].exercises[0].name).toBe("Squat");
    expect(() => setGymPlan(s, [{ ...plan[0], name: "" }])).toThrow(RangeError);
  });
  it("un solo log per allenamento e giorno; si elimina; valida", () => {
    let s = saveGymLog(initialState(), log({ id: "a", date: "2026-12-07" }));
    s = saveGymLog(s, log({ id: "b", date: "2026-12-07", sets: [[65, 8]] }));
    expect(s.gymLogs).toHaveLength(1);
    expect(s.gymLogs[0].id).toBe("b");
    s = saveGymLog(s, log({ id: "c", date: "2026-12-07", workoutId: "B" }));
    expect(s.gymLogs).toHaveLength(2);
    expect(() => saveGymLog(s, log({ sets: [[60, 0]] }))).toThrow(RangeError);
    expect(removeGymLog(s, "c").gymLogs).toHaveLength(1);
  });
  it("un vecchio salvataggio senza palestra si legge lo stesso", () => {
    const old = { ...initialState() } as Record<string, unknown>;
    delete old.gymLogs;
    expect(parseState(old)?.gymLogs).toEqual([]);
  });
});
