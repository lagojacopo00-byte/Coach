"use client";

import { useState } from "react";
import { updateState } from "../data/store";
import { defaultGymPlan, validateGymPlan, type Exercise, type Workout } from "../domain/gym";
import { resetGymPlan, setGymPlan } from "../domain/state";
import { btnDanger, btnPrimary, btnSecondary, Card, inputCls } from "./ui";

const numOr = (v: string, fallback: number): number => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};

/** Modifica la scheda: nomi, serie, range di ripetizioni, incrementi; aggiungi, togli e sposta esercizi. */
export function GymEditor({ plan, onDone }: { plan: Workout[]; onDone: () => void }) {
  const [draft, setDraft] = useState<Workout[]>(() => structuredClone(plan));
  const [error, setError] = useState<string>();

  const patch = (wi: number, ei: number, p: Partial<Exercise>) =>
    setDraft((d) => d.map((w, i) => (i !== wi ? w : { ...w, exercises: w.exercises.map((e, j) => (j === ei ? { ...e, ...p } : e)) })));
  const move = (wi: number, ei: number, dir: -1 | 1) =>
    setDraft((d) =>
      d.map((w, i) => {
        if (i !== wi) return w;
        const ex = [...w.exercises];
        const to = ei + dir;
        if (to < 0 || to >= ex.length) return w;
        [ex[ei], ex[to]] = [ex[to], ex[ei]];
        return { ...w, exercises: ex };
      }),
    );

  function save() {
    const errors = validateGymPlan(draft);
    if (errors.length > 0) return setError(errors[0]);
    updateState((s) => setGymPlan(s, draft));
    onDone();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Cambia nomi, ripetizioni e incrementi, aggiungi o togli esercizi: lo storico resta agganciato. Le serie le decide il coach: le fa salire col tempo e le abbassa in scarico. L&apos;incremento è quanti kg salire quando chiudi tutte le serie al massimo delle ripetizioni.
      </p>
      {draft.map((w, wi) => (
        <section key={w.id}>
          <h2 className="mb-2 font-bold">{w.name} <span className="text-sm font-normal text-zinc-500">· {w.focus}</span></h2>
          <div className="space-y-2">
            {w.exercises.map((e, ei) => (
              <Card key={e.id} className="!p-3">
                <input aria-label="Nome esercizio" className={inputCls} value={e.name} onChange={(ev) => patch(wi, ei, { name: ev.target.value })} />
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <label>Rip. min<input inputMode="numeric" className={inputCls} value={e.repMin} onChange={(ev) => patch(wi, ei, { repMin: numOr(ev.target.value, e.repMin) })} /></label>
                  <label>Rip. max<input inputMode="numeric" className={inputCls} value={e.repMax} onChange={(ev) => patch(wi, ei, { repMax: numOr(ev.target.value, e.repMax) })} /></label>
                  <label>+ kg<input inputMode="decimal" className={inputCls} value={e.incrementKg} onChange={(ev) => patch(wi, ei, { incrementKg: numOr(ev.target.value, e.incrementKg) })} /></label>
                </div>
                <label className="mt-2 flex min-h-9 items-center gap-2 text-sm">
                  <input type="checkbox" className="h-5 w-5" checked={e.noIncrease === true} onChange={(ev) => patch(wi, ei, { noIncrease: ev.target.checked })} />
                  Non proporre aumenti (es. gambe leggere)
                </label>
                <div className="mt-2 flex gap-2">
                  <button type="button" className={`${btnSecondary} !min-h-9 flex-1 text-sm`} onClick={() => move(wi, ei, -1)} aria-label={`Sposta su ${e.name}`}>Su</button>
                  <button type="button" className={`${btnSecondary} !min-h-9 flex-1 text-sm`} onClick={() => move(wi, ei, 1)} aria-label={`Sposta giù ${e.name}`}>Giù</button>
                  <button type="button" className={`${btnDanger} !min-h-9 flex-1 text-sm`} onClick={() => setDraft((d) => d.map((x, i) => (i !== wi ? x : { ...x, exercises: x.exercises.filter((_, j) => j !== ei) })))}>Togli</button>
                </div>
              </Card>
            ))}
            <button
              type="button"
              className={`${btnSecondary} w-full`}
              onClick={() =>
                setDraft((d) =>
                  d.map((x, i) =>
                    i !== wi ? x : { ...x, exercises: [...x.exercises, { id: crypto.randomUUID(), name: "Nuovo esercizio", sets: 3, repMin: 8, repMax: 12, incrementKg: 2.5, group: "forza" }] },
                  ),
                )
              }
            >
              + Aggiungi esercizio
            </button>
          </div>
        </section>
      ))}
      {error ? <p role="alert" className="text-sm font-medium text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" className={`${btnSecondary} flex-1`} onClick={onDone}>Annulla</button>
        <button type="button" className={`${btnPrimary} flex-[2]`} onClick={save}>Salva scheda</button>
      </div>
      <button
        type="button"
        className={`${btnDanger} w-full`}
        onClick={() => {
          if (window.confirm("Tornare alla scheda di partenza? Lo storico dei log resta.")) {
            updateState((s) => resetGymPlan(s));
            setDraft(defaultGymPlan());
            onDone();
          }
        }}
      >
        Ripristina la scheda di partenza
      </button>
    </div>
  );
}
