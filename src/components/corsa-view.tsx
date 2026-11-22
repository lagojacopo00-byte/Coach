"use client";

import { useState } from "react";
import { updateState } from "../data/store";
import { formatDuration, formatPaceOrDash, KIND_LABEL, shortDate } from "../domain/guidance";
import { removeRun, type AppState } from "../domain/state";
import { paceOf } from "../domain/summary";
import { IconCheck } from "./icons";
import { plannedKindOn, RunForm } from "./run-form";
import { btnDanger, Card, H2, PageTitle } from "./ui";
import { WithCoach } from "./with-coach";

export function CorsaView() {
  return <WithCoach>{({ state, today }) => <Content state={state} today={today} />}</WithCoach>;
}

function Content({ state, today }: { state: AppState; today: string }) {
  const [saved, setSaved] = useState(0);
  const recent = [...state.runs].reverse().slice(0, 20);
  return (
    <>
      <PageTitle sub="Per registrare una corsa fuori dal piano. Quelle in piano le registri da Oggi o da Settimane.">Corse</PageTitle>
      {saved > 0 ? (
        <Card tone="ok" className="mb-3 flex items-center gap-2 !p-3"><IconCheck className="h-5 w-5" /> Corsa salvata</Card>
      ) : null}
      <RunForm key={saved} date={today} defaultKind={plannedKindOn(today)} dateEditable onSaved={() => setSaved((n) => n + 1)} />

      <H2>Registro</H2>
      {recent.length === 0 ? (
        <Card>Nessuna corsa registrata.</Card>
      ) : (
        <ul className="space-y-2">
          {recent.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div>
                <p className="font-medium">{shortDate(r.date)} · {KIND_LABEL[r.kind]} · {r.km.toFixed(1)} km</p>
                <p className="text-zinc-500">
                  {formatDuration(r.durationSec)} · {formatPaceOrDash(paceOf(r))}/km{r.avgHr ? ` · ${r.avgHr} bpm` : ""}{r.feeling ? ` · ${r.feeling}` : ""}{r.pain > 0 ? ` · dolore ${r.pain}/10` : ""}
                </p>
              </div>
              <button type="button" className={`${btnDanger} !min-h-9 !px-3 !py-1 text-xs`} onClick={() => { if (window.confirm("Eliminare questa corsa?")) updateState((s) => removeRun(s, r.id)); }}>Elimina</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
