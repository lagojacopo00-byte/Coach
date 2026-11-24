"use client";

import Link from "next/link";
import { useState } from "react";
import { CHECKLIST_SEED, dueSoon } from "../domain/checklist.seed";
import { KIND_LABEL, sessionBrief, shortDate, WEEKDAY_LABEL } from "../domain/guidance";
import { PHASES } from "../domain/plan.seed";
import { updateState } from "../data/store";
import { allCheckIns, moveDay, resetWeekMoves, undoLastMove } from "../domain/state";
import { isRunSession, type SessionStatus } from "../domain/summary";
import { todayView, weekView } from "../domain/views";
import { diffDays, nextWeek, weekdayOf } from "../domain/week";
import { WeekList } from "./week-list";
import { CheckInForm } from "./checkin-form";
import { IconChevron, IconX } from "./icons";
import { KIND_STYLE } from "./kind-style";
import { Logo } from "./logo";
import { SessionPanel } from "./session-panel";
import { Sheet } from "./sheet";
import { AdviceList, Card, CheckBadge, H2, Pill, Section } from "./ui";
import { WithCoach } from "./with-coach";

function DayRow({ status, done, adjusted, onOpen }: { status: SessionStatus; done: boolean; adjusted: boolean; onOpen: () => void }) {
  const { session, date, state } = status;
  const brief = sessionBrief(session);
  const style = KIND_STYLE[session.kind];
  const muted = session.kind === "gym" || session.kind === "rest";
  const isToday = state === "today";
  const missed = isRunSession(session) && (state === "skipped" || state === "missed");
  return (
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full items-stretch gap-3 rounded-xl border bg-white p-0 text-left active:bg-zinc-50 dark:bg-zinc-900 dark:active:bg-zinc-800 ${isToday ? "border-orange-500 ring-1 ring-orange-500" : "border-zinc-200 dark:border-zinc-800"} ${muted && !done ? "opacity-70" : ""}`}
      >
        <span className={`w-2 shrink-0 rounded-l-xl ${style.bar}`} aria-hidden />
        <span className="flex-1 py-2.5">
          <span className="block text-xs text-zinc-500">
            {WEEKDAY_LABEL[session.weekday]} {shortDate(date)}
            {isToday ? " · oggi" : ""}
            {adjusted ? " · cambiata dal coach" : ""}
            {session.optional ? " · facoltativa" : ""}
            {session.from && session.from !== session.weekday ? " · spostata" : ""}
          </span>
          <span className="block font-semibold">
            {KIND_LABEL[session.kind]}
            {brief.main ? <span className="ml-1.5">{brief.main}</span> : null}
            {brief.sub ? <span className="ml-1.5 text-sm font-normal text-zinc-500">{brief.sub}</span> : null}
          </span>
        </span>
        <span className="flex min-w-12 items-center justify-center pr-2 text-zinc-400">
          {done ? (
            <CheckBadge />
          ) : missed ? (
            <span role="img" aria-label="Non fatta" className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
              <IconX className="h-4 w-4" />
            </span>
          ) : isToday && isRunSession(session) ? (
            <Pill tone="accent">Registra</Pill>
          ) : (
            <IconChevron className="h-4 w-4" />
          )}
        </span>
      </button>
  );
}

export function OggiView() {
  const [open, setOpen] = useState<string | undefined>();
  const [note, setNote] = useState<{ text: string; undo?: { weekIndex: number } } | undefined>();
  return (
    <WithCoach>
      {({ state, today, simDate }) => {
        const v = todayView(state, today);
        const displayWeek = v.week ?? nextWeek(today);
        const wv = v.week ? v.weekView : displayWeek ? weekView(state, displayWeek, today) : undefined;
        const statuses = wv?.summary.statuses ?? [];
        const adjustmentOn = (date: string) => wv?.effective.adjustments.find((a) => a.date === date);
        const todayCheckIn = allCheckIns(state).find((c) => c.date === today);
        const urgent = dueSoon(CHECKLIST_SEED, state.checklistDone, today, 5, diffDays).filter((i) => !i.optional);
        const phase = displayWeek ? PHASES.find((p) => p.id === displayWeek.phase) : undefined;
        const openStatus = statuses.find((s) => s.date === open);
        // Fatto: una corsa registrata, oppure (per la palestra) un allenamento salvato quel giorno.
        const isDone = (s: SessionStatus) => (s.session.kind === "gym" ? state.gymLogs.some((l) => l.date === s.date) : isRunSession(s.session) && s.state === "done");

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

            {v.advices.length > 0 ? <div className="mb-3"><AdviceList advices={v.advices} /></div> : null}

            {wv ? (
              <>
                <WeekList
                  items={statuses.map((s) => ({
                    date: s.date,
                    movable: s.session.kind !== "rest" && s.date >= today && !isDone(s) && s.state !== "skipped",
                    content: <DayRow status={s} done={isDone(s)} adjusted={adjustmentOn(s.date) !== undefined && adjustmentOn(s.date)?.rule !== "R8"} onOpen={() => setOpen(s.date)} />,
                  }))}
                  onBlocked={(date) => setNote({ text: statuses.find((x) => x.date === date)?.session.kind === "rest" ? "Il riposo non si sposta: sposta l'allenamento che vuoi mettere al suo posto." : "Questo giorno è passato o già fatto: non si sposta." })}
                  onMove={(from, to) => {
                    if (!displayWeek) return;
                    const fromStatus = statuses.find((x) => x.date === from);
                    try {
                      updateState((st) => moveDay(st, displayWeek.index, weekdayOf(from), weekdayOf(to), today));
                      setNote({ text: `Spostato a ${WEEKDAY_LABEL[weekdayOf(to)].toLowerCase()}: ${fromStatus ? KIND_LABEL[fromStatus.session.kind] : "giorno"}.`, undo: { weekIndex: displayWeek.index } });
                    } catch (e) {
                      setNote({ text: e instanceof Error ? e.message : "Non si può spostare." });
                    }
                  }}
                />
                {note ? (
                  <p role="status" className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-800">
                    <span>{note.text}</span>
                    {note.undo ? (
                      <button type="button" className="shrink-0 font-semibold text-orange-600 dark:text-orange-400" onClick={() => { const w = note.undo!.weekIndex; updateState((st) => undoLastMove(st, w)); setNote({ text: "Spostamento annullato." }); }}>
                        Annulla
                      </button>
                    ) : null}
                  </p>
                ) : null}
                <p className="mt-3 text-center text-sm text-zinc-500">
                  {wv.actualKm.toFixed(1).replace(".", ",")} km fatti · ~{wv.plannedKm.toFixed(0)} km previsti ·{" "}
                  <Link href="/settimane" className="font-medium text-orange-600 dark:text-orange-400">tutte le settimane</Link>
                </p>
                {wv.effective.moves.length > 0 ? (
                  <p className="mt-2 text-center text-sm text-zinc-500">
                    Settimana modificata ·{" "}
                    <button type="button" className="font-medium text-orange-600 dark:text-orange-400" onClick={() => { if (displayWeek) { const w = displayWeek.index; updateState((st) => resetWeekMoves(st, w)); setNote(undefined); } }}>
                      torna al piano
                    </button>
                  </p>
                ) : null}
                {v.extraEasyNote ? <p className="mt-2 px-1 text-sm text-zinc-600 dark:text-zinc-400">Easy facoltativa non attiva: {v.extraEasyNote}</p> : null}
              </>
            ) : (
              <Card>
                <p className="font-semibold">Il piano è concluso.</p>
              </Card>
            )}

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

            {v.status === "during" ? (
              <Section title="Gambe pesanti o dolore?" hint={todayCheckIn && (todayCheckIn.heavyLegs || todayCheckIn.pain > 0) ? "segnalato oggi" : undefined}>
                <CheckInForm key={today + (todayCheckIn ? "x" : "")} today={today} current={todayCheckIn} />
              </Section>
            ) : null}

            {openStatus ? (
              <Sheet title={`${WEEKDAY_LABEL[openStatus.session.weekday]} ${shortDate(openStatus.date)}`} onClose={() => setOpen(undefined)}>
                <SessionPanel key={openStatus.date} status={openStatus} adjustment={adjustmentOn(openStatus.date)} state={state} today={today} onMoved={() => setOpen(undefined)} />
              </Sheet>
            ) : null}
          </>
        );
      }}
    </WithCoach>
  );
}
