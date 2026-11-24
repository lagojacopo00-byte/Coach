import { PLAN_WEEKS } from "../domain/plan.seed";
import { shortDate } from "../domain/guidance";
import type { AppState } from "../domain/state";
import { actualWeekKm, changePct } from "../domain/summary";
import type { IsoDate, Week } from "../domain/types";
import { weekView } from "../domain/views";
import { AdviceList, Card } from "./ui";

const FEELING_ORDER = ["ottime", "buone", "normali", "pesanti", "pessime"] as const;

/** Riepilogo di una settimana: corse fatte/previste, km, variazione, sensazioni, dolori, avvisi del coach. */
export function WeekPanel({ week, state, today }: { week: Week; state: AppState; today: IsoDate }) {
  const v = weekView(state, week, today);
  const runs = state.runs.filter((r) => r.date >= week.start && r.date <= week.end);
  const prev = week.index > 0 ? PLAN_WEEKS[week.index - 1] : undefined;
  const previousKm = prev ? actualWeekKm(state.runs, prev) : undefined;
  const change = previousKm !== undefined ? changePct(previousKm, v.actualKm) : undefined;
  const feelings = FEELING_ORDER.map((k) => [k, runs.filter((r) => r.feeling === k).length] as const).filter(([, n]) => n > 0);
  const skipped = v.summary.statuses.filter((s) => s.state === "skipped" || s.state === "missed").length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500">{shortDate(week.start)} – {shortDate(week.end)}{week.deload ? " · settimana di scarico" : ""}</p>
      <Card>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-2xl font-bold">{v.summary.doneRuns}/{v.summary.plannedRuns}</p><p className="text-xs text-zinc-500">corse</p></div>
          <div><p className="text-2xl font-bold">{v.actualKm.toFixed(1)}</p><p className="text-xs text-zinc-500">km (previsti ~{v.plannedKm.toFixed(0)})</p></div>
          <div><p className="text-2xl font-bold">{change !== undefined ? `${change > 0 ? "+" : ""}${change.toFixed(0)}%` : "–"}</p><p className="text-xs text-zinc-500">vs sett. prec.</p></div>
        </div>
        <p className="mt-3 text-sm">Sensazioni: {feelings.length > 0 ? feelings.map(([k, n]) => `${n}× ${k}`).join(", ") : "non registrate"}.</p>
        <p className="mt-1 text-sm">
          Dolori: {v.summary.painRuns.length === 0 ? "nessuno segnalato" : v.summary.painRuns.map((r) => `${shortDate(r.date)} ${r.pain}/10${r.painLocation ? ` ${r.painLocation}` : ""}`).join("; ")}.
        </p>
        {skipped > 0 ? <p className="mt-1 text-sm">Sedute non fatte: {skipped}. Non si recuperano.</p> : null}
        {v.summary.extraRuns.length > 0 ? <p className="mt-1 text-sm text-zinc-500">Corse extra: {v.summary.extraRuns.map((r) => (r.km > 0 ? `${shortDate(r.date)} ${r.km.toFixed(1)} km` : shortDate(r.date))).join(", ")}.</p> : null}
      </Card>
      <AdviceList advices={v.advices} />
    </div>
  );
}
