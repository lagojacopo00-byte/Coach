import { describe, expect, it } from "vitest";
import { addRun, initialState } from "../domain/state";
import { exportBackup, importBackup, loadSimDate, localRepository, saveSimDate, STATE_KEY, type KeyValueStorage } from "./storage";

function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("storage", () => {
  it("senza dati salvati parte dallo stato iniziale", () => {
    expect(localRepository(memory()).load().runs).toEqual([]);
  });

  it("salva e ricarica", () => {
    const m = memory();
    const repo = localRepository(m);
    repo.save(addRun(initialState(), { id: "a", date: "2026-11-24", kind: "easy", km: 8, durationSec: 3000, pain: 0 }));
    expect(localRepository(m).load().runs[0].id).toBe("a");
  });

  it("dati corrotti o di versione diversa → stato iniziale, senza crash", () => {
    const m = memory();
    m.setItem(STATE_KEY, "{non json");
    expect(localRepository(m).load().runs).toEqual([]);
    m.setItem(STATE_KEY, JSON.stringify({ version: 42 }));
    expect(localRepository(m).load().runs).toEqual([]);
  });

  it("storage che lancia errori non rompe il caricamento", () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(localRepository(broken).load().runs).toEqual([]);
    expect(loadSimDate(broken)).toBeUndefined();
  });

  it("backup: esporta e reimporta lo stesso stato", () => {
    const s = addRun(initialState(), { id: "a", date: "2026-11-24", kind: "easy", km: 8, durationSec: 3000, pain: 0 });
    const r = importBackup(exportBackup(s));
    expect(r.ok && r.state.runs).toHaveLength(1);
  });

  it("backup: accetta anche lo stato nudo, rifiuta il resto", () => {
    expect(importBackup(JSON.stringify(initialState())).ok).toBe(true);
    expect(importBackup("ciao").ok).toBe(false);
    expect(importBackup(JSON.stringify({ state: { version: 7 } })).ok).toBe(false);
  });

  it("data simulata: valida il formato", () => {
    const m = memory();
    saveSimDate(m, "2026-12-06");
    expect(loadSimDate(m)).toBe("2026-12-06");
    m.setItem("coach.simDate", "domani");
    expect(loadSimDate(m)).toBeUndefined();
    saveSimDate(m, undefined);
    expect(m.data.has("coach.simDate")).toBe(false);
  });
});
