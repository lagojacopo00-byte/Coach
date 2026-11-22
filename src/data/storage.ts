import { initialState, parseState, type AppState } from "../domain/state";
import type { IsoDate } from "../domain/types";

/** Persistenza locale (localStorage). Il repository Supabase (F3) implementerà la stessa interfaccia. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StateRepository {
  load(): AppState;
  save(state: AppState): void;
}

export const STATE_KEY = "coach.state.v1";
export const SIM_DATE_KEY = "coach.simDate";

export function localRepository(storage: KeyValueStorage): StateRepository {
  return {
    load() {
      try {
        const raw = storage.getItem(STATE_KEY);
        if (!raw) return initialState();
        return parseState(JSON.parse(raw)) ?? initialState();
      } catch {
        return initialState();
      }
    },
    save(state) {
      storage.setItem(STATE_KEY, JSON.stringify(state));
    },
  };
}

/** Backup come testo JSON: da salvare in Note/File sull'iPhone. */
export function exportBackup(state: AppState): string {
  return JSON.stringify({ app: "coach-maratona", exportedAt: new Date().toISOString(), state }, null, 2);
}

export type ImportResult = { ok: true; state: AppState } | { ok: false; error: string };

export function importBackup(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Il file non è un JSON valido." };
  }
  const candidate =
    typeof parsed === "object" && parsed !== null && "state" in parsed ? (parsed as { state: unknown }).state : parsed;
  const state = parseState(candidate);
  if (!state) return { ok: false, error: "Backup non riconosciuto (versione o formato diversi)." };
  return { ok: true, state };
}

/** Data simulata per provare l'app in un'altra settimana (solo test). */
export function loadSimDate(storage: KeyValueStorage): IsoDate | undefined {
  try {
    const v = storage.getItem(SIM_DATE_KEY);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

export function saveSimDate(storage: KeyValueStorage, date: IsoDate | undefined): void {
  if (date) storage.setItem(SIM_DATE_KEY, date);
  else storage.removeItem(SIM_DATE_KEY);
}
