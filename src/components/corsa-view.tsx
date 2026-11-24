"use client";

import { useState } from "react";
import { fetchGarminActivities, garminErrorText } from "../data/garmin-client";
import { errorText, fetchStravaActivities } from "../data/strava-client";
import { updateState } from "../data/store";
import { formatDuration, formatPaceOrDash, KIND_SHORT, shortDate, WEEKDAY_LABEL } from "../domain/guidance";
import { PLAN_WEEKS } from "../domain/plan.seed";
import { removeRun, type AppState } from "../domain/state";
import { groupByWeek, kmInsights, runStats, type RunStats } from "../domain/stats";
import { notImported, type ImportedActivity } from "../domain/strava";
import { paceOf } from "../domain/summary";
import type { Run } from "../domain/types";
import { trendSeries } from "../domain/views";
import { weekdayOf, weekForDate } from "../domain/week";
import { useGarminStatus } from "./garmin-card";
import { applyImport } from "./import-runs";
import { KIND_STYLE } from "./kind-style";
import { plannedKindOn, RunForm } from "./run-form";
import { Sheet } from "./sheet";
import { useStravaStatus } from "./strava-card";
import { TrendChart } from "./trend-charts";
import { btnDanger, btnPrimary, btnSecondary, Card, CheckBadge, H2, PageTitle, Section } from "./ui";
import { WithCoach } from "./with-coach";

const km1 = (n: number) => `${n.toFixed(1).replace(".", ",")} km`;

export function CorsaView() {
  return <WithCoach>{({ state, today }) => <Content state={state} today={today} />}</WithCoach>;
}

function Content({ state, today }: { state: AppState; today: string }) {
  const stats = runStats(state.runs, today);
  const trend = trendSeries(state, PLAN_WEEKS, today);
  const cur = weekForDate(today);
  const [editing, setEditing] = useState<Run | undefined>();
  const groups = groupByWeek([...state.runs].filter((r) => r.date <= today).sort((a, b) => b.date.localeCompare(a.date)));
  const thisWeekKm = cur ? (trend[cur.index]?.actualKm ?? 0) : 0;
  const thisWeekPlanned = cur ? (trend[cur.index]?.plannedKm ?? 0) : 0;
  const insights = kmInsights(stats);

  return (
    <>
      <PageTitle>Corse</PageTitle>

      <AddRunBox state={state} today={today} />

      <H2>Chilometri settimanali</H2>
      <Card>
        <TrendChart title="Km a settimana" unit="km" data={trend} pick={(p) => ({ planned: p.plannedKm, actual: p.actualKm })} currentIndex={cur?.index} />
        <div className="mt-4 grid grid-cols-2 gap-2">
          {cur ? <Tile label="Questa settimana" value={km1(thisWeekKm)} sub={`previsti ~${thisWeekPlanned.toFixed(0)} km`} /> : null}
          <Tile
            label="Ultimi 7 giorni"
            value={km1(stats.last7Km)}
            sub={stats.last7ChangePct !== undefined ? `${stats.last7ChangePct >= 0 ? "+" : ""}${stats.last7ChangePct.toFixed(0)}% sui 7 precedenti` : undefined}
          />
          {stats.avg4WeeksKm !== undefined ? <Tile label="Media ultime settimane" value={km1(stats.avg4WeeksKm)} sub="settimane complete" /> : null}
          <Tile label="Totale" value={km1(stats.totalKm)} sub={`${stats.runs} ${stats.runs === 1 ? "corsa" : "corse"}`} />
        </div>
        {insights.length > 0 ? (
          <ul className="mt-4 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
            {insights.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : null}
      </Card>

      <H2>Tutte le corse</H2>
      {groups.length === 0 ? (
        <Card>Ancora nessuna corsa registrata.</Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.monday}>
              <div className="mb-1.5 flex items-baseline justify-between px-1 text-sm">
                <span className="font-semibold">{g.planIndex !== undefined ? `Settimana ${g.planIndex}` : `Settimana del ${shortDate(g.monday)}`}</span>
                <span className="text-zinc-500">{km1(g.items.reduce((s, r) => s + r.km, 0))}</span>
              </div>
              <ul className="space-y-2">
                {g.items.map((r) => (
                  <RunRow key={r.id} run={r} onOpen={() => setEditing(r)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Curiosities stats={stats} />

      {editing ? (
        <Sheet title={`Corsa del ${shortDate(editing.date)}`} onClose={() => setEditing(undefined)}>
          <RunForm existing={editing} date={editing.date} defaultKind={editing.kind} dateEditable onSaved={() => setEditing(undefined)} onCancel={() => setEditing(undefined)} />
          <button
            type="button"
            className={`${btnDanger} mt-3 w-full`}
            onClick={() => {
              if (window.confirm("Eliminare questa corsa?")) {
                updateState((s) => removeRun(s, editing.id));
                setEditing(undefined);
              }
            }}
          >
            Elimina corsa
          </button>
        </Sheet>
      ) : null}
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {sub ? <p className="text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}

function RunRow({ run, onOpen }: { run: Run; onOpen: () => void }) {
  const style = KIND_STYLE[run.kind];
  const pace = paceOf(run);
  const bits = [
    run.durationSec > 0 ? formatDuration(run.durationSec) : undefined,
    pace ? `${formatPaceOrDash(pace)}/km` : undefined,
    run.avgHr ? `${run.avgHr} bpm` : undefined,
    run.elevationGainM ? `D+ ${run.elevationGainM} m` : undefined,
  ].filter(Boolean);
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-stretch gap-3 rounded-xl border border-zinc-200 bg-white p-0 text-left active:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:active:bg-zinc-800">
        <span className={`w-2 shrink-0 rounded-l-xl ${style.bar}`} aria-hidden />
        <span className="flex flex-1 items-center justify-between gap-2 py-2.5 pr-3">
          <span className="min-w-0">
            <span className="block text-xs text-zinc-500">{WEEKDAY_LABEL[weekdayOf(run.date)]} {shortDate(run.date)}</span>
            <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${style.cell}`}>{KIND_SHORT[run.kind]}</span>
            {bits.length > 0 ? <span className="mt-0.5 block truncate text-xs text-zinc-500">{bits.join(" · ")}</span> : <span className="mt-0.5 block text-xs text-zinc-500">senza km e tempo</span>}
          </span>
          <span className="shrink-0 text-right">
            {run.km > 0 ? (
              <span className="text-2xl font-bold tabular-nums">{run.km.toFixed(1).replace(".", ",")}<span className="ml-0.5 text-sm font-medium text-zinc-500">km</span></span>
            ) : (
              <CheckBadge />
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

function Curiosities({ stats: s }: { stats: RunStats }) {
  const tiles: { label: string; value: string; sub?: string }[] = [];
  if (s.longest) tiles.push({ label: "Corsa più lunga", value: km1(s.longest.km), sub: shortDate(s.longest.date) });
  if (s.bestWeek) tiles.push({ label: "Settimana migliore", value: km1(s.bestWeek.km), sub: `settimana ${s.bestWeek.index}` });
  if (s.avgPaceSecPerKm) tiles.push({ label: "Passo medio", value: `${formatPaceOrDash(s.avgPaceSecPerKm)}/km`, sub: "su tutte le corse" });
  if (s.easyAvgHr) tiles.push({ label: "FC media negli easy", value: `${s.easyAvgHr} bpm`, sub: `${s.easyHrCount} ${s.easyHrCount === 1 ? "corsa" : "corse"} con FC` });
  if (s.totalElevationM > 0) tiles.push({ label: "Dislivello totale", value: `${Math.round(s.totalElevationM)} m` });
  if (s.monthKm > 0) tiles.push({ label: "Questo mese", value: km1(s.monthKm) });
  if (s.daysSinceLast !== undefined) tiles.push({ label: "Dall'ultima corsa", value: s.daysSinceLast === 0 ? "oggi" : `${s.daysSinceLast} ${s.daysSinceLast === 1 ? "giorno" : "giorni"}` });
  if (tiles.length === 0) return null;
  return (
    <>
      <H2>Dati interessanti</H2>
      <Card>
        <div className="grid grid-cols-2 gap-2">
          {tiles.map((t) => (
            <Tile key={t.label} {...t} />
          ))}
        </div>
        {s.paceByKind.length > 0 ? (
          <div className="mt-4">
            <p className="mb-1.5 text-sm font-semibold">Passo per tipo di corsa</p>
            <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {s.paceByKind.map((k) => (
                <li key={k.kind} className="flex items-center justify-between gap-2 py-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${KIND_STYLE[k.kind].cell}`}>{KIND_SHORT[k.kind]}</span>
                  <span className="text-zinc-500">{km1(k.km)} · {k.count} {k.count === 1 ? "corsa" : "corse"}</span>
                  <span className="font-semibold tabular-nums">{formatPaceOrDash(k.avgPaceSecPerKm)}/km</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </>
  );
}

/** "Aggiungi corsa": si apre con l'import da Garmin/Strava (se attivo) e il form a mano. */
function AddRunBox({ state, today }: { state: AppState; today: string }) {
  const [prefill, setPrefill] = useState<ImportedActivity | undefined>();
  const [round, setRound] = useState(0);
  const [saved, setSaved] = useState(false);
  return (
    <Section title="Aggiungi corsa">
      <div className="space-y-3">
        <ImportBox state={state} onPick={(a) => { setSaved(false); setPrefill(a); setRound((n) => n + 1); }} />
        {saved ? <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"><CheckBadge /> Corsa salvata</p> : null}
        <p className="text-sm font-semibold">{prefill ? `Dati da ${prefill.source === "garmin" ? "Garmin" : "Strava"}: controlla e salva` : "Scrivi i dati a mano"}</p>
        <RunForm
          key={`${prefill?.source ?? "m"}-${prefill?.id ?? 0}-${round}`}
          date={prefill?.date ?? today}
          defaultKind={plannedKindOn(prefill?.date ?? today)}
          prefill={prefill}
          dateEditable
          onSaved={() => { setPrefill(undefined); setRound((n) => n + 1); setSaved(true); }}
        />
      </div>
    </Section>
  );
}

function ImportBox({ state, onPick }: { state: AppState; onPick: (a: ImportedActivity) => void }) {
  const garmin = useGarminStatus();
  const strava = useStravaStatus();
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<ImportedActivity[] | undefined>();
  const [msg, setMsg] = useState<string | undefined>();
  const source = garmin?.unlocked ? "garmin" : strava?.connected ? "strava" : undefined;

  if (!source) {
    return (
      <p className="text-sm text-zinc-500">
        {garmin?.configured ? "Per importare dal Garmin sblocca prima l'import dal Profilo." : "Per importare le corse dal Garmin, attiva l'import dal Profilo."}
      </p>
    );
  }
  const label = source === "garmin" ? "Garmin" : "Strava";

  async function load() {
    setBusy(true);
    setMsg(undefined);
    const r = source === "garmin" ? await fetchGarminActivities() : await fetchStravaActivities();
    setBusy(false);
    if (!r.ok) return setMsg(source === "garmin" ? garminErrorText(r.error as never) : errorText(r.error as never));
    const fresh = notImported(state.runs, r.activities);
    setItems(fresh);
    if (fresh.length === 0) setMsg(`Nessuna corsa nuova su ${label} negli ultimi 30 giorni.`);
  }

  return (
    <div className="space-y-2">
      <button type="button" className={`${btnPrimary} w-full`} disabled={busy} onClick={load}>
        {busy ? `Cerco su ${label}…` : `Cerca le ultime corse su ${label}`}
      </button>
      {items && items.length > 0 ? (
        <>
          <ul className="space-y-2">
            {items.map((a) => (
              <li key={`${a.source}-${a.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-medium">{a.name}</span>
                  <span className="text-zinc-500">{shortDate(a.date)} · {km1(a.km)}{a.durationSec > 0 ? ` · ${formatDuration(a.durationSec)}` : ""}</span>
                </span>
                <button type="button" className={`${btnSecondary} !min-h-10 shrink-0 !px-3`} onClick={() => onPick(a)}>Usa</button>
              </li>
            ))}
          </ul>
          <button type="button" className={`${btnSecondary} w-full`} onClick={() => { setMsg(applyImport(items)); setItems(undefined); }}>
            Importa tutte ({items.length})
          </button>
        </>
      ) : null}
      {msg ? <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">{msg}</p> : null}
    </div>
  );
}
