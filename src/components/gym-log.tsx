"use client";

import { useState } from "react";
import { updateState } from "../data/store";
import { lastSets, suggestNext, type Exercise, type GymEntry, type GymLog, type GymSet, type Workout } from "../domain/gym";
import { shortDate } from "../domain/guidance";
import { saveGymLog, type AppState } from "../domain/state";
import type { IsoDate } from "../domain/types";
import { btnPrimary, btnSecondary, Card, Field, inputCls } from "./ui";

type Row = { w: string; r: string };

const num = (v: string): number => Number(v.trim().replace(",", "."));
const kgText = (n: number): string => String(n).replace(".", ",");

function initialRows(ex: Exercise, state: AppState, date: IsoDate, existing?: GymEntry): Row[] {
  if (existing) return existing.sets.map((s) => ({ w: s.weightKg ? kgText(s.weightKg) : "", r: String(s.reps) }));
  const last = lastSets(state.gymLogs, ex.id, date);
  const sug = suggestNext(ex, last?.sets);
  const w = sug ? kgText(sug.weightKg) : "";
  return Array.from({ length: ex.sets }, () => ({ w: sug && sug.weightKg > 0 ? w : "", r: "" }));
}

/** Registra una seduta di palestra: pesi e ripetizioni per serie, con ultima volta e suggerimento. */
export function GymLogForm({
  workout,
  date,
  state,
  onSaved,
  onCancel,
}: {
  workout: Workout;
  date: IsoDate;
  state: AppState;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const existing = state.gymLogs.find((l) => l.date === date && l.workoutId === workout.id);
  const [rows, setRows] = useState<Record<string, Row[]>>(() =>
    Object.fromEntries(workout.exercises.map((ex) => [ex.id, initialRows(ex, state, date, existing?.entries.find((e) => e.exerciseId === ex.id))])),
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string>();

  const setRow = (id: string, i: number, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [id]: r[id].map((row, j) => (j === i ? { ...row, ...patch } : row)) }));

  function save() {
    const entries: GymEntry[] = [];
    for (const ex of workout.exercises) {
      const sets: GymSet[] = [];
      for (const row of rows[ex.id] ?? []) {
        if (row.r.trim() === "") continue;
        const reps = num(row.r);
        const weightKg = row.w.trim() === "" ? 0 : num(row.w);
        if (!Number.isFinite(reps) || !Number.isFinite(weightKg)) return setError(`${ex.name}: controlla peso e ripetizioni.`);
        sets.push({ weightKg, reps });
      }
      if (sets.length > 0) entries.push({ exerciseId: ex.id, name: ex.name, sets });
    }
    if (entries.length === 0) return setError("Inserisci le ripetizioni di almeno una serie.");
    const log: GymLog = { id: existing?.id ?? crypto.randomUUID(), date, workoutId: workout.id, entries, ...(notes.trim() ? { notes: notes.trim() } : {}) };
    try {
      updateState((s) => saveGymLog(s, log));
    } catch (e) {
      return setError(e instanceof Error ? e.message : "Errore nel salvataggio.");
    }
    setError(undefined);
    onSaved();
  }

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
      {workout.exercises.map((ex) => {
        const last = lastSets(state.gymLogs, ex.id, date);
        const sug = suggestNext(ex, last?.sets);
        return (
          <Card key={ex.id} className="!p-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold">{ex.name}</h3>
              <span className="shrink-0 text-sm text-zinc-500">{ex.sets} × {ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}–${ex.repMax}`}</span>
            </div>
            {ex.note ? <p className="text-xs text-zinc-500">{ex.note}</p> : null}
            {last ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Ultima volta ({shortDate(last.date)}): {last.sets.map((s) => `${kgText(s.weightKg)}×${s.reps}`).join(", ")}
              </p>
            ) : (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Prima volta: scegli un peso con cui chiudi tutte le serie lasciando 2 ripetizioni di riserva.</p>
            )}
            {sug ? <p className="mt-1 text-sm font-semibold text-orange-700 dark:text-orange-300">{sug.text}</p> : null}
            <div className="mt-2 space-y-2">
              {rows[ex.id].map((row, i) => (
                <div key={i} className="grid grid-cols-[2.2rem_1fr_1fr] items-center gap-2">
                  <span className="text-sm text-zinc-500">S{i + 1}</span>
                  <input aria-label={`${ex.name} serie ${i + 1} peso (kg)`} inputMode="decimal" placeholder="kg" className={inputCls} value={row.w} onChange={(e) => setRow(ex.id, i, { w: e.target.value })} />
                  <input aria-label={`${ex.name} serie ${i + 1} ripetizioni`} inputMode="numeric" placeholder="rip." className={inputCls} value={row.r} onChange={(e) => setRow(ex.id, i, { r: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <button type="button" className={`${btnSecondary} !min-h-9 flex-1 text-sm`} onClick={() => setRows((r) => ({ ...r, [ex.id]: [...r[ex.id], { w: r[ex.id].at(-1)?.w ?? "", r: "" }] }))}>+ serie</button>
              {rows[ex.id].length > 1 ? (
                <button type="button" className={`${btnSecondary} !min-h-9 flex-1 text-sm`} onClick={() => setRows((r) => ({ ...r, [ex.id]: r[ex.id].slice(0, -1) }))}>- serie</button>
              ) : null}
              {last ? (
                <button type="button" className={`${btnSecondary} !min-h-9 flex-[2] text-sm`} onClick={() => setRows((r) => ({ ...r, [ex.id]: last.sets.map((s) => ({ w: s.weightKg ? kgText(s.weightKg) : "", r: String(s.reps) })) }))}>
                  Come l&apos;ultima volta
                </button>
              ) : null}
            </div>
          </Card>
        );
      })}
      <Field label="Note"><textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      {error ? <p role="alert" className="text-sm font-medium text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" className={`${btnSecondary} flex-1`} onClick={onCancel}>Annulla</button>
        <button type="submit" className={`${btnPrimary} flex-[2]`}>Salva allenamento</button>
      </div>
    </form>
  );
}
