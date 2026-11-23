"use client";

import { useState } from "react";
import { updateState } from "../data/store";
import { exerciseHistory, logVolume, workoutOn, type Workout } from "../domain/gym";
import { shortDate, WEEKDAY_LABEL } from "../domain/guidance";
import { gymPlanOf, removeGymLog, type AppState } from "../domain/state";
import type { IsoDate } from "../domain/types";
import { weekdayOf } from "../domain/week";
import { GymEditor } from "./gym-edit";
import { GymLogForm } from "./gym-log";
import { IconCheck } from "./icons";
import { btnPrimary, btnSecondary, Card, H2, inputCls, PageTitle } from "./ui";
import { WithCoach } from "./with-coach";

type Mode = { type: "list" } | { type: "log"; workoutId: string } | { type: "edit" };

export function PalestraView() {
  return <WithCoach>{({ state, today }) => <Content state={state} today={today} />}</WithCoach>;
}

function Content({ state, today }: { state: AppState; today: IsoDate }) {
  const plan = gymPlanOf(state);
  const todays = workoutOn(plan, weekdayOf(today));
  const [mode, setMode] = useState<Mode>({ type: "list" });
  const [date, setDate] = useState(today);
  const [saved, setSaved] = useState(false);
  const workout = mode.type === "log" ? plan.find((w) => w.id === mode.workoutId) : undefined;

  if (mode.type === "edit") {
    return (
      <>
        <PageTitle sub="Nomi, serie, ripetizioni e incrementi">Modifica scheda</PageTitle>
        <GymEditor plan={plan} onDone={() => setMode({ type: "list" })} />
      </>
    );
  }

  if (mode.type === "log" && workout) {
    return (
      <>
        <PageTitle sub={workout.focus}>{workout.name}</PageTitle>
        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium">Data</span>
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <GymLogForm key={`${workout.id}-${date}`} workout={workout} date={date} state={state} onDone={() => { setSaved(true); setMode({ type: "list" }); }} onBack={() => setMode({ type: "list" })} />
      </>
    );
  }

  const logs = [...state.gymLogs].reverse().slice(0, 12);
  return (
    <>
      <PageTitle sub="Registra pesi e ripetizioni: la volta dopo ti dico quando salire">Palestra</PageTitle>
      {saved ? <Card tone="ok" className="mb-3 flex items-center gap-2 !p-3"><IconCheck className="h-5 w-5" /> Allenamento chiuso: è nello storico</Card> : null}

      <ul className="space-y-3">
        {plan.map((w) => (
          <WorkoutCard key={w.id} w={w} state={state} today={today} isToday={todays?.id === w.id} onStart={() => { setSaved(false); setDate(today); setMode({ type: "log", workoutId: w.id }); }} />
        ))}
      </ul>
      <button type="button" className={`${btnSecondary} mt-3 w-full`} onClick={() => setMode({ type: "edit" })}>Modifica scheda</button>

      <H2>Progressi</H2>
      <Progress state={state} plan={plan} />

      <H2>Storico</H2>
      {logs.length === 0 ? (
        <Card>Ancora nessun allenamento registrato.</Card>
      ) : (
        <ul className="space-y-2">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div>
                <p className="font-medium">{shortDate(l.date)} · {plan.find((w) => w.id === l.workoutId)?.name ?? l.workoutId}</p>
                <p className="text-zinc-500">{l.entries.length} esercizi · volume {Math.round(logVolume(l))} kg</p>
              </div>
              <button type="button" className="min-h-9 rounded-xl border border-red-300 bg-red-50 px-3 text-xs font-medium text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200" onClick={() => { if (window.confirm("Eliminare questo allenamento?")) updateState((s) => removeGymLog(s, l.id)); }}>Elimina</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function WorkoutCard({ w, state, today, isToday, onStart }: { w: Workout; state: AppState; today: IsoDate; isToday: boolean; onStart: () => void }) {
  const inProgress = state.gymDrafts.some((d) => d.date === today && d.workoutId === w.id);
  const last = [...state.gymLogs].reverse().find((l) => l.workoutId === w.id);
  return (
    <li className={`rounded-2xl border bg-white p-4 dark:bg-zinc-900 ${isToday ? "border-orange-500 ring-1 ring-orange-500" : "border-zinc-200 dark:border-zinc-800"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {WEEKDAY_LABEL[w.weekday]}{isToday ? " · oggi" : ""}
      </p>
      <h2 className="text-lg font-bold">{w.name}</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{w.focus}</p>
      <p className="mt-1 text-sm text-zinc-500">
        {w.exercises.length} esercizi{last ? ` · ultima volta ${shortDate(last.date)}, volume ${Math.round(logVolume(last))} kg` : " · mai fatto"}
      </p>
      <button type="button" className={`${btnPrimary} mt-3 w-full`} onClick={onStart}>{inProgress ? "Riprendi" : "Inizia"}</button>
    </li>
  );
}

/** Peso massimo per esercizio: da dove sei partito e dove sei ora. */
function Progress({ state, plan }: { state: AppState; plan: Workout[] }) {
  const rows = plan
    .flatMap((w) => w.exercises)
    .map((e) => ({ e, h: exerciseHistory(state.gymLogs, e.id) }))
    .filter((x) => x.h.length > 0);
  if (rows.length === 0) return <Card>I progressi compaiono dopo il primo allenamento registrato.</Card>;
  return (
    <Card>
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.map(({ e, h }) => {
          const first = h[0];
          const lastP = h[h.length - 1];
          const diff = lastP.topWeightKg - first.topWeightKg;
          return (
            <li key={e.id} className="flex items-baseline justify-between gap-2 py-2 text-sm">
              <span className="font-medium">{e.name}</span>
              <span className="shrink-0 text-zinc-600 dark:text-zinc-400">
                {h.length === 1 ? `${lastP.topWeightKg} kg × ${lastP.repsAtTop}` : `${first.topWeightKg} → ${lastP.topWeightKg} kg (${diff >= 0 ? "+" : ""}${diff.toFixed(1).replace(".0", "")})`}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
