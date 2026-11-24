"use client";

import { useState } from "react";
import { updateState } from "../data/store";
import { easyPaceOf } from "../domain/coach";
import { detailText, formatRunSummary, KIND_LABEL, paceHint, sessionBrief, shortDate, WEEKDAY_LABEL, WEEKDAY_SHORT } from "../domain/guidance";
import { gelAdvice } from "../domain/rules";
import Link from "next/link";
import { workoutOn } from "../domain/gym";
import { applySwaps, swapTargets } from "../domain/moves";
import { addSkip, gymPlanOf, moveDay, removeRun, removeSkip, type AppState } from "../domain/state";
import { logVolume } from "../domain/gym";
import { isRunSession, type SessionStatus } from "../domain/summary";
import { SKIP_REASONS, type Adjustment, type IsoDate, type SkipReason, type Weekday } from "../domain/types";
import { IconCheck, IconX } from "./icons";
import { KIND_STYLE } from "./kind-style";
import { RunForm } from "./run-form";
import { fetchGarminActivities, garminErrorText } from "../data/garmin-client";
import { fetchStravaActivities, errorText } from "../data/strava-client";
import { activitiesOn, type ImportedActivity } from "../domain/strava";
import { addDays, weekForDate } from "../domain/week";
import { useGarminStatus } from "./garmin-card";
import { useStravaStatus } from "./strava-card";
import { btnDanger, btnPrimary, btnSecondary } from "./ui";

const REASON_LABEL: Record<SkipReason, string> = {
  stanco: "Stanco",
  dolore: "Dolore",
  impegni: "Impegni",
  malattia: "Malattia",
  altro: "Altro",
};

/** Dettaglio di una seduta + azioni: fatto (con dati e sensazioni), non fatto (con motivo). */
export function SessionPanel({
  status,
  adjustment,
  state,
  today,
  onMoved,
}: {
  status: SessionStatus;
  adjustment?: Adjustment;
  state: AppState;
  today: IsoDate;
  /** Chiamata dopo uno spostamento (di solito chiude la scheda). */
  onMoved?: () => void;
}) {
  const { session, date, run, skip } = status;
  const [mode, setMode] = useState<"idle" | "done" | "skip">("idle");
  const [prefill, setPrefill] = useState<ImportedActivity | undefined>();
  const style = KIND_STYLE[session.kind];
  const brief = sessionBrief(session);
  const hint = paceHint(session, state.profile);
  const gel = gelAdvice(session, easyPaceOf(state.profile));
  const isRun = isRunSession(session);
  const canLog = isRun && date <= today;

  return (
    <div>
      <div className={`rounded-2xl p-4 ${style.cell}`}>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
          {WEEKDAY_LABEL[session.weekday]} {shortDate(date)}
        </p>
        <p className="mt-1 text-2xl font-bold leading-tight">
          {KIND_LABEL[session.kind]}
          {brief.main ? <span className="ml-2">{brief.main}</span> : null}
        </p>
        {brief.sub ? <p className="text-sm font-medium opacity-80">{brief.sub}</p> : null}
        <p className="mt-2 text-sm">{detailText(session)}</p>
        {session.from && session.from !== session.weekday ? <p className="mt-2 text-xs font-medium opacity-80">Spostata da {WEEKDAY_LABEL[session.from].toLowerCase()}</p> : null}
      </div>

      {adjustment?.rule === "R8" ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Facoltativa (R8): {adjustment.reason} Se non la fai non cambia nulla.</p>
      ) : adjustment ? (
        <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          Cambiata dal coach ({adjustment.rule}): {adjustment.reason} Previsto: <span className="line-through">{adjustment.original.description}</span>
        </p>
      ) : null}
      {hint ? <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{hint}</p> : null}
      {gel ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{gel.message}</p> : null}

      {session.kind === "gym" ? <GymBlock state={state} date={date} weekday={session.from ?? session.weekday} /> : null}

      {!isRun ? null : mode === "done" ? (
        <div className="mt-4">
          <p className="mb-2 font-semibold">Com&apos;è andata?</p>
          <RunForm
            date={date}
            defaultKind={session.kind}
            plannedKm={session.km}
            existing={run}
            prefill={prefill}
            onSaved={() => { setPrefill(undefined); setMode("idle"); }}
            onCancel={() => setMode("idle")}
          />
        </div>
      ) : mode === "skip" ? (
        <SkipForm date={date} onDone={() => setMode("idle")} />
      ) : run ? (
        <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-100">
            <IconCheck className="h-5 w-5" /> Fatta
          </p>
          <p className="mt-1 text-sm">
            {formatRunSummary(run)}
            {run.avgHr ? ` · ${run.avgHr} bpm` : ""}
            {run.elevationGainM ? ` · D+ ${run.elevationGainM} m` : ""}
          </p>
          <p className="text-sm">
            {run.feeling ? `Sensazioni ${run.feeling}` : "Sensazioni non indicate"}
            {run.pain > 0 ? ` · dolore ${run.pain}/10${run.painLocation ? ` (${run.painLocation}${run.painType ? `, ${run.painType}` : ""})` : ""}` : ""}
            {run.heavyLegs ? " · gambe pesanti" : ""}
          </p>
          {run.notes ? <p className="mt-1 text-sm italic">{run.notes}</p> : null}
          <div className="mt-3 flex gap-2">
            <button type="button" className={`${btnSecondary} flex-1`} onClick={() => setMode("done")}>Modifica</button>
            <button type="button" className={`${btnDanger} flex-1`} onClick={() => { if (window.confirm("Eliminare questa corsa?")) updateState((s) => removeRun(s, run.id)); }}>Elimina</button>
          </div>
        </div>
      ) : skip ? (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="flex items-center gap-2 font-semibold"><IconX className="h-5 w-5" /> Non fatta{skip.reason ? ` · ${REASON_LABEL[skip.reason].toLowerCase()}` : ""}</p>
          <p className="mt-1 text-sm">Non si recupera: si va avanti col piano.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={`${btnPrimary} flex-1`} onClick={() => setMode("done")}>Ho corso</button>
            <button type="button" className={`${btnSecondary} flex-1`} onClick={() => updateState((s) => removeSkip(s, date))}>Annulla</button>
          </div>
        </div>
      ) : canLog && session.optional ? (
        <div className="mt-4">
          <button type="button" className={`${btnPrimary} w-full`} onClick={() => setMode("done")}>Fatto</button>
        </div>
      ) : canLog ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className={btnPrimary} onClick={() => setMode("done")}>Fatto</button>
          <button type="button" className={btnSecondary} onClick={() => setMode("skip")}>Non fatto</button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">Potrai registrarla {date === today ? "oggi" : `da ${shortDate(date)}`}.</p>
      )}

      {mode === "idle" ? <MoveChips status={status} state={state} today={today} onMoved={onMoved} /> : null}

      {isRun && mode === "idle" && canLog && !run ? <ActivityImport date={date} onPick={(a) => { setPrefill(a); setMode("done"); }} /> : null}
    </div>
  );
}

function SkipForm({ date, onDone }: { date: IsoDate; onDone: () => void }) {
  const [reason, setReason] = useState<SkipReason | undefined>();
  const [error, setError] = useState<string>();
  return (
    <div className="mt-4">
      <p className="mb-2 font-semibold">Perché?</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Motivo">
        {SKIP_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={reason === r}
            onClick={() => setReason(reason === r ? undefined : r)}
            className={`min-h-11 rounded-xl border px-4 text-sm font-medium ${reason === r ? "border-orange-500 bg-orange-500 text-white" : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"}`}
          >
            {REASON_LABEL[r]}
          </button>
        ))}
      </div>
      {reason === "dolore" ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Se è un dolore alla tibia, segnalalo anche dal check-in in Oggi: il coach lo tiene in conto.</p>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="button" className={`${btnSecondary} flex-1`} onClick={onDone}>Indietro</button>
        <button
          type="button"
          className={`${btnPrimary} flex-[2]`}
          onClick={() => {
            try {
              updateState((s) => addSkip(s, { date, ...(reason ? { reason } : {}) }));
              onDone();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Errore");
            }
          }}
        >
          Segna non fatta
        </button>
      </div>
    </div>
  );
}

function GymBlock({ state, date, weekday }: { state: AppState; date: IsoDate; weekday: Weekday }) {
  const workout = workoutOn(gymPlanOf(state), weekday);
  const done = state.gymLogs.find((l) => l.date === date && (!workout || l.workoutId === workout.id));
  if (!workout) return null;
  return (
    <div className="mt-4">
      {done ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
          <IconCheck className="h-5 w-5" /> {workout.name} fatta · volume {Math.round(logVolume(done))} kg
        </p>
      ) : null}
      <Link href="/palestra" className={`${done ? btnSecondary : btnPrimary} mt-2 w-full`}>
        {done ? "Rivedi la scheda" : `Apri la scheda: ${workout.name}`}
      </Link>
    </div>
  );
}

/** "Importa da Garmin/Strava": cerca le corse di quel giorno e precompila il form. Compare solo se una sorgente è attiva. */
function ActivityImport({ date, onPick }: { date: IsoDate; onPick: (a: ImportedActivity) => void }) {
  const garmin = useGarminStatus();
  const strava = useStravaStatus();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | undefined>();
  const [choices, setChoices] = useState<ImportedActivity[]>([]);
  const source = garmin?.unlocked ? "garmin" : strava?.connected ? "strava" : undefined;
  if (!source) {
    return garmin?.configured ? (
      <p className="mt-3 text-sm text-zinc-500">Per importare dal Garmin, sblocca prima l&apos;import dal Profilo.</p>
    ) : null;
  }
  const label = source === "garmin" ? "Garmin" : "Strava";

  async function load() {
    setBusy(true);
    setMsg(undefined);
    // Un giorno di margine per parte: i fusi orari di Garmin/Strava non coincidono con i tuoi; filtro per data locale.
    const r =
      source === "garmin"
        ? await fetchGarminActivities(addDays(date, -1), addDays(date, 1))
        : await fetchStravaActivities(Date.parse(`${date}T00:00:00Z`) / 1000 - 86_400);
    setBusy(false);
    if (!r.ok) return setMsg(source === "garmin" ? garminErrorText(r.error as never) : errorText(r.error as never));
    const found = activitiesOn(r.activities, date);
    if (found.length === 0) return setMsg(`Nessuna corsa su ${label} il ${shortDate(date)}. L'orologio deve aver finito di sincronizzare.`);
    if (found.length === 1) return onPick(found[0]);
    setChoices(found);
  }

  return (
    <div className="mt-3">
      <button type="button" className={`${btnSecondary} w-full`} disabled={busy} onClick={load}>
        {busy ? `Cerco su ${label}…` : `Importa da ${label}`}
      </button>
      {choices.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {choices.map((a) => (
            <li key={a.id}>
              <button type="button" className={`${btnSecondary} w-full justify-between`} onClick={() => onPick(a)}>
                <span className="truncate">{a.name}</span>
                <span className="ml-2 shrink-0 text-sm text-zinc-500">{a.km.toFixed(1).replace(".", ",")} km</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {msg ? <p role="status" className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{msg}</p> : null}
    </div>
  );
}

/** Modo alternativo al trascinamento: scegli il giorno in cui spostare questa seduta. */
function MoveChips({ status, state, today, onMoved }: { status: SessionStatus; state: AppState; today: IsoDate; onMoved?: () => void }) {
  const week = weekForDate(status.date);
  if (!week || status.session.kind === "rest") return null;
  const current = applySwaps(week, state.swaps.filter((x) => x.weekIndex === week.index));
  const from = status.session.weekday;
  const targets = swapTargets({ week: current, today, runs: state.runs, gymLogs: state.gymLogs, skips: state.skips }, from);
  if (targets.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-semibold">Sposta in un altro giorno</p>
      <div className="flex flex-wrap gap-2">
        {targets.map((t) => (
          <button
            key={t}
            type="button"
            className={`${btnSecondary} !min-h-10 !px-3`}
            aria-label={`Sposta a ${WEEKDAY_LABEL[t]}`}
            onClick={() => {
              updateState((s) => moveDay(s, week.index, from, t, today));
              onMoved?.();
            }}
          >
            {WEEKDAY_SHORT[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
