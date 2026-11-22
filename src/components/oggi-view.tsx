"use client";

import Link from "next/link";
import { CHECKLIST_SEED, dueSoon } from "../domain/checklist.seed";
import { allCheckIns } from "../domain/state";
import { shortDate, WEEKDAY_LABEL } from "../domain/guidance";
import { PHASES } from "../domain/plan.seed";
import { isRunSession } from "../domain/summary";
import { todayView } from "../domain/views";
import { diffDays, phaseProgress, weeksToRace } from "../domain/week";
import { CheckInForm } from "./checkin-form";
import { SessionRow } from "./session-row";
import { AdviceList, btnPrimary, btnSecondary, Card, H2, Pill, ProgressBar } from "./ui";
import { WithCoach } from "./with-coach";

export function OggiView() {
  return (
    <WithCoach>
      {({ state, today, simDate }) => {
        const v = todayView(state, today);
        const profile = state.profile;
        const urgent = dueSoon(CHECKLIST_SEED, state.checklistDone, today, 5, diffDays).filter((i) => !i.optional);
        const todayCheckIn = allCheckIns(state).find((c) => c.date === today);
        const todayRunDone = state.runs.some((r) => r.date === today);
        const sessionRow = v.weekView?.summary.statuses.find((s) => s.date === today);
        const adjustment = v.weekView?.effective.adjustments.find((a) => a.date === today);

        return (
          <>
            <Card tone="accent" className="mb-4 mt-2">
              <p className="text-sm opacity-90">Run Rome The Marathon · dom 14 mar 2027</p>
              {v.daysToRace > 0 ? (
                <p className="mt-1 text-4xl font-bold">{v.daysToRace} <span className="text-xl font-semibold">giorni</span></p>
              ) : v.daysToRace === 0 ? (
                <p className="mt-1 text-3xl font-bold">È oggi. Buona gara! 🏁</p>
              ) : (
                <p className="mt-1 text-2xl font-bold">Maratona fatta. Complimenti! 🏅</p>
              )}
              {v.daysToRace > 0 ? <p className="mt-1 text-sm opacity-90">{weeksToRace(today, profile.raceDate)} settimane · obiettivo sub 4h (5:41/km)</p> : null}
              {simDate ? <p className="mt-2 inline-block rounded bg-black/20 px-2 py-0.5 text-xs">Data simulata: {shortDate(simDate)} (Profilo → Strumenti)</p> : null}
            </Card>

            <AdviceList advices={v.advices} />

            <H2>Fasi</H2>
            <Card>
              <div className="flex gap-1" aria-label="Barra delle fasi">
                {PHASES.map((p) => (
                  <div key={p.id} className="flex-1">
                    <ProgressBar value={phaseProgress(p, today)} label={`Fase ${p.id}: ${p.name}`} />
                    <p className={`mt-1 truncate text-[10px] ${v.phase?.id === p.id ? "font-bold text-orange-600 dark:text-orange-400" : "text-zinc-500"}`}>{p.id} · {p.name}</p>
                  </div>
                ))}
              </div>
              {v.phase ? (
                <p className="mt-3 text-sm">
                  <span className="font-semibold">Fase {v.phase.id} – {v.phase.name}</span> · {v.phase.focus}
                  {v.week ? <span className="text-zinc-500"> · settimana {v.week.index}/15</span> : null}
                </p>
              ) : (
                <p className="mt-3 text-sm">{v.status === "before" ? "Il piano parte lunedì 23 novembre con la settimana 0 (scarico + trail easy)." : "Il piano è concluso."}</p>
              )}
            </Card>

            {v.status === "before" ? (
              <Card className="mt-4" tone="info">
                <p className="font-semibold">Stasera è domenica sera</p>
                <p className="mt-1 text-sm">Guarda la settimana che parte domani e gli elementi da sistemare.</p>
                <Link href="/domenica" className={`${btnPrimary} mt-3 w-full`}>Apri la vista Domenica</Link>
              </Card>
            ) : null}

            {v.week && v.todaySession && sessionRow ? (
              <>
                <H2>Oggi · {WEEKDAY_LABEL[v.todaySession.weekday]} {shortDate(today)}</H2>
                <ul>
                  <SessionRow status={sessionRow} profile={profile} adjustment={adjustment} />
                </ul>
                {isRunSession(v.todaySession) && !todayRunDone ? (
                  <Link href="/corsa" className={`${btnPrimary} mt-3 w-full`}>Registra la corsa</Link>
                ) : null}
              </>
            ) : null}

            {v.status === "during" ? (
              <>
                <H2>Come stanno le gambe?</H2>
                <Card>
                  <CheckInForm key={today + (todayCheckIn ? "x" : "")} today={today} current={todayCheckIn} />
                </Card>
              </>
            ) : null}

            {urgent.length > 0 ? (
              <>
                <H2 right={<Link href="/todo" className="text-sm text-orange-600">Tutte</Link>}>Da fare a breve</H2>
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

            {v.weekView ? (
              <>
                <H2 right={<Link href="/domenica" className="text-sm text-orange-600">Domenica sera</Link>}>Questa settimana</H2>
                <ul className="space-y-2">
                  {v.weekView.summary.statuses.map((s) => (
                    <SessionRow key={s.session.weekday} status={s} profile={profile} showHint={false} adjustment={v.weekView?.effective.adjustments.find((a) => a.date === s.date)} />
                  ))}
                </ul>
                <p className="mt-3 text-center text-sm text-zinc-500">
                  {v.weekView.actualKm.toFixed(1)} km fatti · ~{v.weekView.plannedKm.toFixed(0)} km previsti
                </p>
              </>
            ) : null}

            <div className="mt-6 grid grid-cols-2 gap-2">
              <Link href="/piano" className={btnSecondary}>Piano 16 settimane</Link>
              <Link href="/todo" className={btnSecondary}>Da fare</Link>
            </div>
          </>
        );
      }}
    </WithCoach>
  );
}
