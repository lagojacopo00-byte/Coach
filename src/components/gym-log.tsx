"use client";

import { useState } from "react";
import { updateState } from "../data/store";
import {
  effectiveSets,
  gymContext,
  gymWeekNotes,
  lastSets,
  setsChangeNote,
  setWeight,
  suggestNext,
  type Exercise,
  type GymDraft,
  type GymDraftRow,
  type GymWeekContext,
  type Workout,
} from "../domain/gym";
import { shortDate } from "../domain/guidance";
import { autosaveGym, finishGymDraft, type AppState } from "../domain/state";
import type { IsoDate } from "../domain/types";
import { weekForDate } from "../domain/week";
import { btnPrimary, btnSecondary, Card, Field, inputCls } from "./ui";

const kgText = (n: number): string => String(n).replace(".", ",");

type Rows = Record<string, GymDraftRow[]>;

/** Porta le righe al numero di serie previsto, senza perdere ciò che hai già scritto. */
function fit(rows: GymDraftRow[], count: number): GymDraftRow[] {
  if (rows.length < count) {
    const w = rows.at(-1)?.w ?? "";
    return [...rows, ...Array.from({ length: count - rows.length }, () => ({ w, r: "" }))];
  }
  let keep = rows.length;
  while (keep > count && rows[keep - 1].r.trim() === "") keep--;
  return rows.slice(0, keep);
}

function startRows(ex: Exercise, state: AppState, date: IsoDate, ctx: GymWeekContext): GymDraftRow[] {
  const count = effectiveSets(ex, ctx);
  const sug = suggestNext(ex, lastSets(state.gymLogs, ex.id, date)?.sets);
  const w = sug && sug.weightKg > 0 ? kgText(sug.weightKg) : "";
  return Array.from({ length: count }, () => ({ w, r: "" }));
}

function initialState(workout: Workout, state: AppState, date: IsoDate, ctx: GymWeekContext): { rows: Rows; notes: string } {
  const draft = state.gymDrafts.find((d) => d.date === date && d.workoutId === workout.id);
  const log = state.gymLogs.find((l) => l.date === date && l.workoutId === workout.id);
  const rows: Rows = {};
  for (const ex of workout.exercises) {
    const count = effectiveSets(ex, ctx);
    const fromDraft = draft?.rows[ex.id];
    const entry = log?.entries.find((e) => e.exerciseId === ex.id);
    if (fromDraft) rows[ex.id] = fit(fromDraft, count);
    else if (entry) rows[ex.id] = fit(entry.sets.map((s) => ({ w: s.weightKg ? kgText(s.weightKg) : "", r: String(s.reps), manual: true })), count);
    else rows[ex.id] = startRows(ex, state, date, ctx);
  }
  return { rows, notes: draft?.notes ?? log?.notes ?? "" };
}

/**
 * Allenamento di palestra. Le serie le decide il coach (non si aggiungono né si tolgono). Il carico che scrivi
 * si copia sulle altre serie, le ripetizioni le scrivi tu. Si salva da solo a ogni modifica.
 */
export function GymLogForm({
  workout,
  date,
  state,
  onDone,
  onBack,
}: {
  workout: Workout;
  date: IsoDate;
  state: AppState;
  onDone: () => void;
  onBack: () => void;
}) {
  const ctx = gymContext(weekForDate(date), { logs: state.gymLogs, date });
  const weekNotes = gymWeekNotes(ctx);
  const [{ rows: initRows, notes: initNotes }] = useState(() => initialState(workout, state, date, ctx));
  const [rows, setRows] = useState<Rows>(initRows);
  const [notes, setNotes] = useState(initNotes);

  function persist(nextRows: Rows, nextNotes: string) {
    const draft: GymDraft = { date, workoutId: workout.id, rows: nextRows, notes: nextNotes };
    updateState((s) => autosaveGym(s, draft, workout));
  }
  function change(next: Rows) {
    setRows(next);
    persist(next, notes);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Si salva da solo a ogni modifica. Scrivi il carico una volta: si copia sulle altre serie.</p>
      {weekNotes.map((n) => (
        <p key={n} className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm dark:border-sky-900 dark:bg-sky-950/40">{n}</p>
      ))}
      {workout.exercises.map((ex) => {
        const last = lastSets(state.gymLogs, ex.id, date);
        const sug = suggestNext(ex, last?.sets);
        const change_ = setsChangeNote(ex, ctx);
        const sets = rows[ex.id] ?? [];
        return (
          <Card key={ex.id} className="!p-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold">{ex.name}</h3>
              <span className="shrink-0 text-sm text-zinc-500">{effectiveSets(ex, ctx)} × {ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}–${ex.repMax}`}</span>
            </div>
            {change_ ? <p className="text-xs font-medium text-sky-700 dark:text-sky-300">{change_}</p> : null}
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
              {sets.map((row, i) => (
                <div key={i} className="grid grid-cols-[2.2rem_1fr_1fr] items-center gap-2">
                  <span className="text-sm text-zinc-500">S{i + 1}</span>
                  <input
                    aria-label={`${ex.name} serie ${i + 1} peso (kg)`}
                    inputMode="decimal"
                    placeholder="kg"
                    className={inputCls}
                    value={row.w}
                    onChange={(e) => change({ ...rows, [ex.id]: setWeight(sets, i, e.target.value) })}
                  />
                  <input
                    aria-label={`${ex.name} serie ${i + 1} ripetizioni`}
                    inputMode="numeric"
                    placeholder="rip."
                    className={inputCls}
                    value={row.r}
                    onChange={(e) => change({ ...rows, [ex.id]: sets.map((x, j) => (j === i ? { ...x, r: e.target.value } : x)) })}
                  />
                </div>
              ))}
            </div>
            {last ? (
              <button
                type="button"
                className={`${btnSecondary} !min-h-9 mt-2 w-full text-sm`}
                onClick={() =>
                  change({
                    ...rows,
                    [ex.id]: sets.map((row, i) => {
                      const s = last.sets[Math.min(i, last.sets.length - 1)];
                      return { w: s.weightKg ? kgText(s.weightKg) : "", r: String(s.reps), manual: true };
                    }),
                  })
                }
              >
                Come l&apos;ultima volta
              </button>
            ) : null}
          </Card>
        );
      })}
      <Field label="Note">
        <textarea
          rows={2}
          className={inputCls}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            persist(rows, e.target.value);
          }}
        />
      </Field>
      <div className="flex gap-2">
        <button type="button" className={`${btnSecondary} flex-1`} onClick={onBack}>Indietro</button>
        <button
          type="button"
          className={`${btnPrimary} flex-[2]`}
          onClick={() => {
            updateState((s) => finishGymDraft(s, date, workout.id));
            onDone();
          }}
        >
          Fatto
        </button>
      </div>
    </div>
  );
}
