"use client";

import Link from "next/link";
import { useState } from "react";
import { CHECKLIST_SEED, dueSoon } from "../domain/checklist.seed";
import { KIND_LABEL, sessionBrief, shortDate, WEEKDAY_LABEL } from "../domain/guidance";
import { PHASES } from "../domain/plan.seed";
import { allCheckIns } from "../domain/state";
import { isRunSession, type SessionStatus } from "../domain/summary";
import { nextRunSession, todayView, weekView } from "../domain/views";
import { diffDays, nextWeek, weekdayOf } from "../domain/week";
import { CheckInForm } from "./checkin-form";
import { IconCheck, IconChevron, IconX } from "./icons";
import { KIND_STYLE } from "./kind-style";
import { Logo } from "./logo";
import { SessionPanel } from "./session-panel";
import { Sheet } from "./sheet";
import { AdviceList, Card, H2, Pill } from "./ui";
import { WithCoach } from "./with-coach";

function DayRow({ status, adjusted, onOpen }: { status: SessionStatus; adjusted: boolean; onOpen: () => void }) {
  const { session, date, state } = status;
  const brief = sessionBrief(session);
  const style = KIND_STYLE[session.kind];
  const muted = session.kind === "gym" || session.kind === "rest";
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full items-stretch gap-3 rounded-xl border bg-white p-0 text-left active:bg-zinc-50 dark:bg-zinc-900 dark:active:bg-zinc-800 ${state === "today" ? "border-orange-500 ring-1 ring-orange-500" : "border-zinc-200 dark:border-zinc-800"} ${muted ? "opacity-70" : ""}`}
      >
        <span className={`w-2 shrink-0 rounded-l-xl ${style.bar}`} aria-hidden />
        <span className="flex-1 py-2.5">
          <span className="block text-xs text-zinc-500">{WEEKDAY_LABEL[session.weekday]} {shortDate(date)}{adjusted ? " · cambiata dal coach" : ""}{session.optional ? " · facoltativa" : ""}</span>
          <span className="block font-semibold">
            {KIND_LABEL[session.kind]}
            {brief.main ? <span className="ml-1.5">{brief.main}</span> : null}
            {brief.sub ? <span className="ml-1.5 text-sm font-normal text-zinc-500">{brief.sub}</span> : null}
          </span>
        </span>
        <span className="flex w-10 items-center justify-center text-zinc-400">
          {state === "done" && !muted ? <IconCheck className="h-5 w-5 text-emerald-600" /> : state === "skipped" || state === "missed" ? <IconX className="h-5 w-5 text-amber-600" /> : <IconChevron className="h-4 w-4" />}
        </span>
      </button>
    </li>
  );
}

export function OggiView() {
  const [open, setOpen] = useState<string | undefined>();
  return (
    <WithCoach>
      {({ state, today, simDate }) => {
        const v = todayView(state, today);
        const displayWeek = v.week ?? nextWeek(today);
        const wv = v.week ? v.weekView : displayWeek ? weekView(state, displayWeek, today) : undefined;
        const statuses = wv?.summary.statuses ?? [];
        const todayStatus = statuses.find((s) => s.date === today);
        const adjustmentOn = (date: string) => wv?.effective.adjustments.find((a) => a.date === date);
        const todayCheckIn = allCheckIns(state).find((c) => c.date === today);
        const urgent = dueSoon(CHECKLIST_SEED, state.checklistDone, today, 5, diffDays).filter((i) => !i.optional);
        const next = !todayStatus || (todayStatus.session && !isRunSession(todayStatus.session)) ? nextRunSession(state, today) : undefined;
        const phase = displayWeek ? PHASES.find((p) => p.id === displayWeek.phase) : undefined;
        const openStatus = statuses.find((s) => s.date === open);

        return (
          <>
            <header className="mb-4 flex items-center gap-3 pt-2">
              <Logo className="h-11 w-11 shrink-0" />
              <div>
                <h1 className="text-2xl font-bold leading-tight">{WEEKDAY_LABEL[weekdayOf(today)]} {shortDate(today)}</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {v.week ? `Settimana ${v.week.index}${phase ? ` · ${phase.name}` : ""}` : displayWeek ? `Da domani: settimana ${displayWeek.index}` : "Piano concluso"}
                  {simDate ? " · data simulata" : ""}
                </p>
              </div>
            </header>

            <AdviceList advices={v.advices} />

            <H2>Oggi</H2>
            {todayStatus ? (
              <Card className="!p-3">
                <SessionPanel key={todayStatus.date} status={todayStatus} adjustment={adjustmentOn(todayStatus.date)} state={state} today={today} />
              </Card>
            ) : (
              <Card>
                <p className="font-semibold">Nessun allenamento in programma oggi.</p>
                <p className="mt-1 text-sm text-zinc-500">{v.status === "before" ? "Il piano parte lunedì 23 novembre." : "Il piano è concluso."}</p>
              </Card>
            )}
            {v.extraEasyNote ? (
              <p className="mt-2 px-1 text-sm text-zinc-600 dark:text-zinc-400">Easy facoltativa non attiva: {v.extraEasyNote}</p>
            ) : null}
            {next ? (
              <p className="mt-2 px-1 text-sm text-zinc-600 dark:text-zinc-400">
                Prossima corsa: <span className="font-semibold">{WEEKDAY_LABEL[next.session.weekday]} {shortDate(next.date)}</span> · {KIND_LABEL[next.session.kind]} {sessionBrief(next.session).main}
              </p>
            ) : null}

            {v.status === "during" ? (
              <details className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <summary className="cursor-pointer font-semibold">Gambe pesanti o dolore?</summary>
                <div className="mt-3">
                  <CheckInForm key={today + (todayCheckIn ? "x" : "")} today={today} current={todayCheckIn} />
                </div>
              </details>
            ) : null}

            {wv ? (
              <>
                <H2 right={<Link href="/settimane" className="text-sm font-medium text-orange-600 dark:text-orange-400">Tutte le settimane</Link>}>
                  {v.week ? "Questa settimana" : `Settimana ${displayWeek?.index}`}
                </H2>
                <ul className="space-y-2">
                  {statuses.map((s) => (
                    <DayRow key={s.date} status={s} adjusted={adjustmentOn(s.date) !== undefined && adjustmentOn(s.date)?.rule !== "R8"} onOpen={() => setOpen(s.date)} />
                  ))}
                </ul>
                <p className="mt-3 text-center text-sm text-zinc-500">
                  {wv.actualKm.toFixed(1)} km fatti · ~{wv.plannedKm.toFixed(0)} km previsti
                </p>
              </>
            ) : null}

            {urgent.length > 0 ? (
              <>
                <H2 right={<Link href="/todo" className="text-sm font-medium text-orange-600 dark:text-orange-400">Tutte</Link>}>Da fare a breve</H2>
                <Card>
                  <ul className="space-y-2">
                    {urgent.slice(0, 4).map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                        <span>{i.title}</span>
                        {i.due ? <Pill tone={i.due < today ? "stop" : "warn"}>{i.due < today ? "scaduta" : `entro ${shortDate(i.due)}`}</Pill> : null}
                      </li>
                    ))}
                  </ul>
                </Card>
              </>
            ) : null}

            {openStatus ? (
              <Sheet title={`${WEEKDAY_LABEL[openStatus.session.weekday]} ${shortDate(openStatus.date)}`} onClose={() => setOpen(undefined)}>
                <SessionPanel key={openStatus.date} status={openStatus} adjustment={adjustmentOn(openStatus.date)} state={state} today={today} />
              </Sheet>
            ) : null}
          </>
        );
      }}
    </WithCoach>
  );
}
