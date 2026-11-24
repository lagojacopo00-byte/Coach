"use client";

import { useEffect, useRef, useState } from "react";
import { KIND_LABEL, KIND_SHORT, sessionBrief, shortDate, WEEKDAY_LABEL, WEEKDAY_SHORT } from "../domain/guidance";
import { PHASES, PLAN_WEEKS } from "../domain/plan.seed";
import { WEEKDAYS, type Weekday } from "../domain/types";
import { trendSeries, weekView } from "../domain/views";
import { weekForDate } from "../domain/week";
import { IconCheck, IconX } from "./icons";
import { KIND_STYLE, LEGEND } from "./kind-style";
import { SessionPanel } from "./session-panel";
import { Sheet } from "./sheet";
import { TrendChart } from "./trend-charts";
import { Card, H2, PageTitle } from "./ui";
import { WeekPanel } from "./week-panel";
import { WithCoach } from "./with-coach";

type Selection = { type: "session"; week: number; weekday: Weekday } | { type: "week"; week: number };

export function SettimaneView() {
  const [sel, setSel] = useState<Selection | undefined>();
  const currentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = currentRef.current;
    if (el && el.dataset.index && Number(el.dataset.index) > 1) el.scrollIntoView({ block: "center" });
  }, []);

  return (
    <WithCoach>
      {({ state, today }) => {
        const cur = weekForDate(today);
        const views = PLAN_WEEKS.map((w) => weekView(state, w, today));
        const trend = trendSeries(state, PLAN_WEEKS, today);
        const selWeek = sel ? PLAN_WEEKS[sel.week] : undefined;
        const selView = sel ? views[sel.week] : undefined;
        const selStatus = sel?.type === "session" ? selView?.summary.statuses.find((s) => s.session.weekday === sel.weekday) : undefined;

        return (
          <>
            <PageTitle>Settimane</PageTitle>

            <div className="sticky top-0 z-10 -mx-1 grid grid-cols-[2.4rem_repeat(7,minmax(0,1fr))] gap-[3px] bg-[var(--background)] px-1 pb-1 pt-1 text-center text-[10px] font-semibold uppercase text-zinc-500">
              <span />
              {WEEKDAYS.map((d) => <span key={d}>{WEEKDAY_SHORT[d]}</span>)}
            </div>

            <div className="space-y-[3px]">
              {PLAN_WEEKS.map((w, wi) => {
                const phase = PHASES.find((p) => p.id === w.phase)!;
                const firstOfPhase = wi === 0 || PLAN_WEEKS[wi - 1].phase !== w.phase;
                const isCur = cur?.index === w.index;
                const v = views[wi];
                return (
                  <div key={w.index} ref={isCur ? currentRef : undefined} data-index={isCur ? w.index : undefined}>
                    {firstOfPhase ? (
                      <p className="mb-1 mt-3 px-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        {phase.name} <span className="font-normal text-zinc-500">· {phase.focus}</span>
                      </p>
                    ) : null}
                    <div className={`grid grid-cols-[2.4rem_repeat(7,minmax(0,1fr))] gap-[3px] rounded-xl ${isCur ? "ring-2 ring-orange-500 ring-offset-2 ring-offset-[var(--background)]" : ""}`}>
                      <button
                        type="button"
                        onClick={() => setSel({ type: "week", week: w.index })}
                        aria-label={`Riepilogo settimana ${w.index}`}
                        className="flex flex-col items-center justify-center rounded-lg text-center leading-tight active:bg-zinc-200 dark:active:bg-zinc-800"
                      >
                        <span className="text-sm font-bold">{w.index}</span>
                        <span className="text-[9px] text-zinc-500">{shortDate(w.start)}</span>
                        {w.deload ? <span className="text-[8px] font-semibold text-emerald-600 dark:text-emerald-400">scarico</span> : null}
                      </button>
                      {WEEKDAYS.map((d) => {
                        const st = v.summary.statuses.find((x) => x.session.weekday === d);
                        // Settimana della gara: niente palestra lunedì e mercoledì → cella vuota.
                        if (!st) return <div key={d} aria-hidden className="min-h-[3.6rem]" />;
                        const s = st.session;
                        const brief = sessionBrief(s);
                        const style = KIND_STYLE[s.kind];
                        const muted = s.kind === "gym" || s.kind === "rest";
                        const adjusted = v.effective.adjustments.some((a) => a.weekday === d && a.rule !== "R8");
                        const gymDone = s.kind === "gym" && state.gymLogs.some((l) => l.date === st.date);
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setSel({ type: "session", week: w.index, weekday: d })}
                            aria-label={`Settimana ${w.index}, ${WEEKDAY_LABEL[d]} ${shortDate(st.date)}: ${KIND_LABEL[s.kind]} ${brief.main} ${brief.sub ?? ""}${st.state === "done" ? ", fatta" : st.state === "skipped" || st.state === "missed" ? ", non fatta" : ""}`}
                            className={`relative flex min-h-[3.6rem] flex-col items-center justify-center overflow-hidden rounded-lg px-0.5 py-1 text-center leading-tight ${style.cell} ${st.state === "today" ? "ring-2 ring-inset ring-orange-500" : ""} ${st.state === "missed" || st.state === "skipped" ? "opacity-50" : ""} ${s.optional ? "border-2 border-dashed border-emerald-500/60" : ""} ${adjusted ? "outline outline-2 -outline-offset-2 outline-amber-500" : ""}`}
                          >
                            {s.kind === "rest" ? (
                              <span className="text-xs">·</span>
                            ) : (
                              <>
                                <span className={`text-[9px] font-bold uppercase ${muted ? "font-medium" : ""}`}>{KIND_SHORT[s.kind]}</span>
                                {brief.main ? <span className={`whitespace-nowrap font-bold ${brief.main.length > 5 ? "text-[10px]" : "text-[12px]"}`}>{brief.main}</span> : null}
                                {brief.sub ? <span className="text-[8px] leading-tight opacity-80">{brief.sub}</span> : null}
                              </>
                            )}
                            {(st.state === "done" && !muted) || gymDone ? <IconCheck className="absolute right-0.5 top-0.5 h-3 w-3" /> : null}
                            {(st.state === "skipped" || st.state === "missed") ? <IconX className="absolute right-0.5 top-0.5 h-3 w-3" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Legenda">
              {LEGEND.map((l) => (
                <li key={l.label} className={`rounded-md px-2 py-0.5 text-xs font-semibold ${KIND_STYLE[l.kind].cell}`}>{l.label}</li>
              ))}
            </ul>

            <H2>Andamento</H2>
            <Card className="space-y-6">
              <TrendChart title="Carico settimanale" unit="km" data={trend} pick={(p) => ({ planned: p.plannedKm, actual: p.actualKm })} currentIndex={cur?.index} />
              <TrendChart title="Lungo" unit="km" data={trend} pick={(p) => ({ planned: p.longPlannedKm, actual: p.longActualKm })} currentIndex={cur?.index} />
            </Card>

            {sel && selWeek ? (
              <Sheet
                title={sel.type === "week" ? `Settimana ${selWeek.index}` : `${WEEKDAY_LABEL[sel.weekday]} ${shortDate(selStatus?.date ?? selWeek.start)} · sett. ${selWeek.index}`}
                onClose={() => setSel(undefined)}
              >
                {sel.type === "week" ? (
                  <WeekPanel week={selWeek} state={state} today={today} />
                ) : selStatus ? (
                  <SessionPanel
                    key={selStatus.date}
                    status={selStatus}
                    adjustment={selView?.effective.adjustments.find((a) => a.weekday === sel.weekday)}
                    state={state}
                    today={today}
                  />
                ) : null}
              </Sheet>
            ) : null}
          </>
        );
      }}
    </WithCoach>
  );
}
