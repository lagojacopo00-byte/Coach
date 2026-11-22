"use client";

import { effectiveWeek } from "../domain/coach";
import { KIND_LABEL, shortDate, WEEKDAY_LABEL } from "../domain/guidance";
import { PHASES, PLAN_WEEKS } from "../domain/plan.seed";
import { actualWeekKm, isRunSession, plannedWeekKm } from "../domain/summary";
import { easyPaceOf } from "../domain/coach";
import { daysToRace, phaseProgress, weekForDate, weeksToRace } from "../domain/week";
import { Card, PageTitle, Pill, ProgressBar } from "./ui";
import { WithCoach } from "./with-coach";

export function PianoView() {
  return (
    <WithCoach>
      {({ state, today }) => {
        const cur = weekForDate(today);
        const pace = easyPaceOf(state.profile);
        const d = daysToRace(today, state.profile.raceDate);
        return (
          <>
            <PageTitle sub={d > 0 ? `${d} giorni · ${weeksToRace(today, state.profile.raceDate)} settimane alla maratona` : "Maratona di Roma · 14 marzo 2027"}>Piano 16 settimane</PageTitle>
            <Card>
              <div className="space-y-2">
                {PHASES.map((p) => (
                  <div key={p.id}>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold">{p.id} · {p.name}</span>
                      <span className="text-zinc-500">{shortDate(p.start)}–{shortDate(p.end)}</span>
                    </div>
                    <ProgressBar value={phaseProgress(p, today)} label={`Fase ${p.name}`} />
                    <p className="mt-0.5 text-[11px] text-zinc-500">{p.focus}</p>
                  </div>
                ))}
              </div>
            </Card>
            <div className="mt-4 space-y-2">
              {PLAN_WEEKS.map((w) => {
                const eff = effectiveWeek(w, state);
                const isCur = cur?.index === w.index;
                const actual = actualWeekKm(state.runs, w);
                return (
                  <details key={w.index} open={isCur} className={`rounded-2xl border p-3 ${isCur ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"}`}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                      <span>
                        <span className="font-semibold">Sett. {w.index}</span>
                        <span className="ml-2 text-sm text-zinc-500">{shortDate(w.start)}–{shortDate(w.end)}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        {w.deload ? <Pill tone="ok">scarico</Pill> : null}
                        {isCur ? <Pill tone="accent">ora</Pill> : null}
                        {eff.adjustments.length > 0 ? <Pill tone="warn">modificata</Pill> : null}
                        <span className="text-xs text-zinc-500">{actual > 0 ? `${actual.toFixed(0)}/` : ""}~{plannedWeekKm(eff.week, pace).toFixed(0)} km</span>
                      </span>
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm">
                      {eff.week.sessions.filter((s) => s.kind !== "rest").map((s) => {
                        const adj = eff.adjustments.find((a) => a.weekday === s.weekday);
                        return (
                          <li key={s.weekday} className={isRunSession(s) ? "" : "text-zinc-500"}>
                            <span className="inline-block w-9 font-medium">{WEEKDAY_LABEL[s.weekday].slice(0, 3)}</span>
                            <span className="font-medium">{KIND_LABEL[s.kind]}</span>
                            {s.kind === "gym" ? "" : ` · ${s.description}`}
                            {adj ? <span className="block pl-9 text-xs text-amber-700 dark:text-amber-300">{adj.reason} Previsto: <span className="line-through">{adj.original.description}</span></span> : null}
                          </li>
                        );
                      })}
                    </ul>
                    {w.index === 0 || w.sessions.some((s) => s.kind === "gym") ? (
                      <p className="mt-2 text-xs text-zinc-500">{w.sessions.some((s) => s.kind === "gym") ? "Palestra ven: calf raise eccentrici 3×15, tibialis raise 3×20, single-leg RDL 3×8; niente gambe pesanti nei 2 giorni prima del lungo." : ""}</p>
                    ) : null}
                  </details>
                );
              })}
            </div>
          </>
        );
      }}
    </WithCoach>
  );
}
