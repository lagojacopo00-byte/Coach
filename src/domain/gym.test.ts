import { describe, expect, it } from "vitest";
import {
  defaultGymPlan,
  draftToLog,
  effectiveSets,
  exerciseHistory,
  gymContext,
  gymWeekNotes,
  isConsistent,
  setsChangeNote,
  setWeight,
  volumeBonus,
  type GymDraft,
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
import { PLAN_WEEKS } from "./plan.seed";
import { autosaveGym, finishGymDraft, gymPlanOf, initialState, parseState, removeGymLog, resetGymPlan, saveGymLog, setGymPlan } from "./state";

const squat: Exercise = { id: "squat", name: "Squat", sets: 3, repMin: 5, repMax: 8, incrementKg: 5 };
const log = (over: Partial<GymLog> & { sets?: [number, number][] }): GymLog => ({
  id: over.id ?? "l" + Math.random(),
  date: over.date ?? "2026-12-07",
  workoutId: over.workoutId ?? "A",
  entries: [{ exerciseId: "squat", name: "Squat", sets: (over.sets ?? [[60, 8], [60, 8], [60, 8]]).map(([w, r]) => ({ weightKg: w, reps: r })) }],
});

describe("scheda di partenza", () => {
  const plan = defaultGymPlan();
  const all = plan.flatMap((w) => w.exercises);
  it("due full body: A il lunedì, B il mercoledì", () => {
    expect(plan.map((w) => [w.id, w.weekday])).toEqual([["A", "lun"], ["B", "mer"]]);
    expect(workoutOn(plan, "mer")?.id).toBe("B");
    expect(workoutOn(plan, "ven")).toBeUndefined();
  });
  it("contiene gli esercizi concordati con le serie e i range chiesti", () => {
    const get = (id: string) => all.find((e) => e.id === id)!;
    expect(get("chin-up")).toMatchObject({ sets: 5, repMin: 5, repMax: 8 });
    expect(get("military")).toMatchObject({ sets: 4, repMin: 5, repMax: 8 });
    for (const id of ["squat", "rdl", "bulgari", "panca", "tirata", "alzate-a", "alzate-b"]) expect(get(id), id).toBeDefined();
  });
  it("le gambe sono spezzate: squat il lunedì, stacco e bulgari il mercoledì", () => {
    expect(plan[0].exercises.filter((e) => e.group === "gambe").map((e) => e.id)).toEqual(["squat"]);
    expect(plan[1].exercises.filter((e) => e.group === "gambe").map((e) => e.id)).toEqual(["rdl", "bulgari"]);
  });
  it("ogni seduta ha spinta, trazione e prevenzione tibie/polpacci", () => {
    for (const w of plan) {
      const names = w.exercises.map((e) => e.name).join("|");
      expect(names, w.id).toMatch(/Calf raise/);
      expect(names, w.id).toMatch(/Tibialis raise/);
    }
    expect(plan[0].exercises.some((e) => e.id === "panca")).toBe(true);
    expect(plan[0].exercises.some((e) => e.id === "chin-up")).toBe(true);
    expect(plan[1].exercises.some((e) => e.id === "military")).toBe(true);
    expect(plan[1].exercises.some((e) => e.id === "tirata")).toBe(true);
  });
  it("calf: gamba tesa il lunedì, ginocchio piegato (soleo) il mercoledì", () => {
    expect(plan[0].exercises.some((e) => /in piedi/.test(e.name))).toBe(true);
    expect(plan[1].exercises.some((e) => /ginocchio piegato/.test(e.name))).toBe(true);
  });
  it("è valida e gli id sono unici", () => {
    expect(validateGymPlan(plan)).toEqual([]);
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
  });
});

describe("dosaggio per settimana", () => {
  const w = (i: number) => PLAN_WEEKS[i];
  const sets = (id: string, week: number) => {
    const e = defaultGymPlan().flatMap((x) => x.exercises).find((x) => x.id === id)!;
    return effectiveSets(e, gymContext(w(week)));
  };
  it("settimana normale: serie piene", () => {
    expect(sets("squat", 5)).toBe(3);
    expect(sets("chin-up", 5)).toBe(5);
  });
  it("scarico (4 e 9): una serie in meno ovunque", () => {
    expect(sets("chin-up", 4)).toBe(4);
    expect(sets("military", 9)).toBe(3);
    expect(sets("tibialis-a", 4)).toBe(2);
  });
  it("tapering (14): gambe dimezzate, parte alta invariata", () => {
    expect(sets("rdl", 14)).toBe(2);
    expect(sets("bulgari", 14)).toBe(2);
    expect(sets("squat", 14)).toBe(2);
    expect(sets("chin-up", 14)).toBe(5);
    expect(sets("military", 14)).toBe(4);
  });
  it("qualità dura il martedì (sett. 10 soglia 2×15', sett. 13 salite 6×2'): squat a 2", () => {
    expect(gymContext(w(10)).hardQuality).toBe(true);
    expect(gymContext(w(13)).hardQuality).toBe(true);
    expect(sets("squat", 10)).toBe(2);
    expect(sets("squat", 13)).toBe(2);
    expect(sets("rdl", 10)).toBe(3);
    expect(gymContext(w(5)).hardQuality).toBe(false);
  });
  it("non scende mai sotto 1 serie; senza settimana nessun aggiustamento", () => {
    expect(effectiveSets({ ...defaultGymPlan()[0].exercises[0], sets: 1 }, { weekIndex: 14, deload: true, taper: true, hardQuality: false, consistent: false })).toBe(1);
    expect(gymContext(undefined)).toEqual({ weekIndex: 0, deload: false, taper: false, hardQuality: false, consistent: false });
  });
  it("note leggibili", () => {
    expect(gymWeekNotes(gymContext(w(4)))[0]).toMatch(/scarico/);
    expect(gymWeekNotes(gymContext(w(14)))[0]).toMatch(/gambe dimezzate/);
    expect(gymWeekNotes(gymContext(w(5)))).toEqual([]);
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
  it("noIncrease: mai aumenti", () => {
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

describe("volume che cresce (lo decide il coach)", () => {
  const plan = defaultGymPlan();
  const ex = (id: string) => plan.flatMap((w) => w.exercises).find((e) => e.id === id)!;
  const three = (): GymLog[] => ["2026-12-01", "2026-12-04", "2026-12-08"].map((d, i) => log({ id: `c${i}`, date: d }));
  const ctx = (week: number, consistent = true) => ({ ...gymContext(PLAN_WEEKS[week]), consistent });

  it("continuità: servono 3 allenamenti nelle ultime 3 settimane", () => {
    expect(isConsistent(three(), "2026-12-10")).toBe(true);
    expect(isConsistent(three().slice(0, 2), "2026-12-10")).toBe(false);
    expect(isConsistent(three(), "2027-01-20")).toBe(false); // troppo vecchi
    expect(gymContext(PLAN_WEEKS[5], { logs: three(), date: "2026-12-28" }).consistent).toBe(false); // 28 dic: i log sono oltre 21 giorni
    expect(gymContext(PLAN_WEEKS[2], { logs: three(), date: "2026-12-10" }).consistent).toBe(true);
  });
  it("prima della settimana 5 le serie sono quelle di base", () => {
    for (const id of ["panca", "tirata", "alzate-a"]) expect(effectiveSets(ex(id), ctx(2)), id).toBe(ex(id).sets);
    expect(effectiveSets(ex("panca"), ctx(4))).toBe(2); // sett. 4 è di scarico: 3 − 1
    expect(volumeBonus(ex("panca"), ctx(3))).toBe(0);
  });
  it("dalla settimana 5: +1 serie su panca, tirata e alzate; dalla 10 le alzate arrivano a 5", () => {
    expect(effectiveSets(ex("panca"), ctx(6))).toBe(4);
    expect(effectiveSets(ex("tirata"), ctx(6))).toBe(4);
    expect(effectiveSets(ex("alzate-a"), ctx(6))).toBe(4);
    expect(effectiveSets(ex("alzate-a"), ctx(10))).toBe(5);
    expect(effectiveSets(ex("panca"), ctx(10))).toBe(4);
  });
  it("senza continuità il volume non sale", () => {
    expect(effectiveSets(ex("panca"), ctx(6, false))).toBe(3);
  });
  it("chin-up, military e gambe non aumentano mai", () => {
    for (const id of ["chin-up", "military", "rdl", "bulgari"]) expect(effectiveSets(ex(id), ctx(7)), id).toBe(ex(id).sets);
    expect(effectiveSets(ex("squat"), ctx(7))).toBe(3);
  });
  it("in scarico si toglie una serie anche dal volume aumentato", () => {
    expect(effectiveSets(ex("panca"), ctx(9))).toBe(3); // (3+1)-1
    expect(effectiveSets(ex("alzate-a"), ctx(9))).toBe(3);
  });
  it("note sul perché le serie cambiano", () => {
    expect(setsChangeNote(ex("panca"), ctx(6))).toMatch(/\+1 serie: volume in crescita/);
    expect(setsChangeNote(ex("chin-up"), ctx(4))).toMatch(/-1 serie: scarico/);
    expect(setsChangeNote(ex("rdl"), ctx(14))).toMatch(/gambe dimezzate/);
    expect(setsChangeNote(ex("squat"), ctx(10))).toMatch(/qualità dura/);
    expect(setsChangeNote(ex("panca"), ctx(2))).toBeUndefined();
  });
});

describe("carico copiato su tutte le serie", () => {
  const rows = [{ w: "", r: "" }, { w: "", r: "" }, { w: "", r: "" }];
  it("scrivo il carico una volta e si copia su tutte le altre; le ripetizioni restano mie", () => {
    const r = setWeight(setWeight(rows, 0, "6"), 0, "60");
    expect(r.map((x) => x.w)).toEqual(["60", "60", "60"]);
    expect(r.map((x) => x.r)).toEqual(["", "", ""]);
    const withReps = setWeight([{ w: "", r: "8" }, { w: "", r: "7" }, { w: "", r: "" }], 1, "62,5");
    expect(withReps.map((x) => x.r)).toEqual(["8", "7", ""]);
    expect(withReps.map((x) => x.w)).toEqual(["62,5", "62,5", "62,5"]);
  });
  it("una serie scritta a mano non viene sovrascritta dalle altre", () => {
    let r = setWeight(rows, 0, "60");
    r = setWeight(r, 2, "55"); // 3ª serie diversa: copia anche sulla 2ª (non manuale), non sulla 1ª (manuale)
    expect(r.map((x) => x.w)).toEqual(["60", "55", "55"]);
    r = setWeight(r, 0, "65"); // la 2ª non è scritta a mano → segue; la 3ª sì → resta 55
    expect(r.map((x) => x.w)).toEqual(["65", "65", "55"]);
  });
  it("non muta l'originale", () => {
    setWeight(rows, 0, "60");
    expect(rows[0].w).toBe("");
  });
});

describe("salvataggio a ogni modifica", () => {
  const A = defaultGymPlan()[0];
  const draft = (rows: GymDraft["rows"], notes = ""): GymDraft => ({ date: "2026-12-07", workoutId: "A", rows, notes });
  it("draftToLog: solo serie con ripetizioni valide; peso vuoto = peso corpo; senza serie = niente", () => {
    expect(draftToLog(draft({ squat: [{ w: "60", r: "" }] }), A)).toBeUndefined();
    const l = draftToLog(draft({ squat: [{ w: "60", r: "8" }, { w: "60", r: "" }, { w: "60", r: "7" }], "chin-up": [{ w: "", r: "6" }] }, " bene "), A)!;
    expect(l.entries.map((e) => [e.exerciseId, e.sets])).toEqual([
      ["squat", [{ weightKg: 60, reps: 8 }, { weightKg: 60, reps: 7 }]],
      ["chin-up", [{ weightKg: 0, reps: 6 }]],
    ]);
    expect(l.id).toBe("gym-2026-12-07-A");
    expect(l.notes).toBe("bene");
    expect(draftToLog(draft({ squat: [{ w: "60", r: "8,5" }] }), A)).toBeUndefined();
    expect(draftToLog(draft({ squat: [{ w: "abc", r: "8" }] }), A)).toBeUndefined();
  });
  it("autosaveGym: scrivo un peso → bozza salvata; scrivo le ripetizioni → compare nello storico", () => {
    let s = autosaveGym(initialState(), draft({ squat: [{ w: "60", r: "" }, { w: "60", r: "" }] }), A);
    expect(s.gymDrafts).toHaveLength(1);
    expect(s.gymLogs).toHaveLength(0);
    s = autosaveGym(s, draft({ squat: [{ w: "60", r: "8" }, { w: "60", r: "" }] }), A);
    expect(s.gymDrafts).toHaveLength(1);
    expect(s.gymLogs).toHaveLength(1);
    expect(lastSets(s.gymLogs, "squat")?.sets).toEqual([{ weightKg: 60, reps: 8 }]);
  });
  it("togliendo tutte le ripetizioni l'allenamento esce dallo storico", () => {
    let s = autosaveGym(initialState(), draft({ squat: [{ w: "60", r: "8" }] }), A);
    s = autosaveGym(s, draft({ squat: [{ w: "60", r: "" }] }), A);
    expect(s.gymLogs).toHaveLength(0);
    expect(s.gymDrafts).toHaveLength(1);
  });
  it("finishGymDraft toglie la bozza ma non l'allenamento; le bozze vecchie si ripuliscono", () => {
    let s = autosaveGym(initialState(), draft({ squat: [{ w: "60", r: "8" }] }), A);
    s = finishGymDraft(s, "2026-12-07", "A");
    expect(s.gymDrafts).toEqual([]);
    expect(s.gymLogs).toHaveLength(1);
    s = autosaveGym(s, { ...draft({ squat: [{ w: "50", r: "" }] }), date: "2026-12-07" }, A);
    s = autosaveGym(s, { ...draft({ squat: [{ w: "70", r: "" }] }), date: "2027-01-10" }, A);
    expect(s.gymDrafts.map((d) => d.date)).toEqual(["2027-01-10"]);
  });
  it("un vecchio salvataggio senza bozze si legge lo stesso", () => {
    const old = { ...initialState() } as Record<string, unknown>;
    delete old.gymDrafts;
    expect(parseState(old)?.gymDrafts).toEqual([]);
  });
});
