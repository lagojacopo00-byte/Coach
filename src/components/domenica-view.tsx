"use client";

import Link from "next/link";
import { useState } from "react";
import { updateState } from "../data/store";
import { shortDate } from "../domain/guidance";
import { toggleChecklist } from "../domain/state";
import { sundayView } from "../domain/views";
import { diffDays } from "../domain/week";
import { SessionRow } from "./session-row";
import { AdviceList, btnSecondary, Card, H2, PageTitle, Pill } from "./ui";
import { WithCoach } from "./with-coach";

const FEELING_ORDER = ["ottime", "buone", "normali", "pesanti", "pessime"] as const;

export function DomenicaView() {
  const [openId, setOpenId] = useState<string | undefined>();
  return (
    <WithCoach>
      {({ state, today }) => {
        const v = sundayView(state, today);
        const profile = state.profile;
        const f = v.finished;
        const weekRuns = f ? state.runs.filter((r) => r.date >= f.week.start && r.date <= f.week.end) : [];
        const feelings = FEELING_ORDER.map((k) => [k, weekRuns.filter((r) => r.feeling === k).length] as const).filter(([, n]) => n > 0);

        return (
          <>
            <PageTitle sub={`Oggi ${shortDate(today)}`}>Domenica sera</PageTitle>
            <AdviceList advices={v.advices} />

            <H2>1 · La settimana che arriva</H2>
            {v.next ? (
              <>
                <p className="mb-2 px-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Settimana {v.next.week.index} · {shortDate(v.next.week.start)}–{shortDate(v.next.week.end)}
                  {v.next.week.deload ? " · scarico" : ""} · ~{v.next.plannedKm.toFixed(0)} km
                </p>
                <ul className="space-y-2">
                  {v.next.summary.statuses.map((s) => (
                    <SessionRow key={s.session.weekday} status={s} profile={profile} adjustment={v.next?.effective.adjustments.find((a) => a.date === s.date)} />
                  ))}
                </ul>
                <div className="mt-3">
                  <AdviceList advices={v.next.advices.filter((a) => a.rule !== "R4")} />
                </div>
              </>
            ) : (
              <Card>{v.status === "after" ? "Il piano è concluso." : "Nessuna settimana in arrivo."}</Card>
            )}

            <H2 right={<Link href="/todo" className="text-sm text-orange-600">Tutte</Link>}>2 · Elementi da fare</H2>
            {v.checklist.length === 0 ? (
              <Card tone="ok">Tutto a posto per questa settimana. ✅</Card>
            ) : (
              <Card>
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {v.checklist.map((i) => (
                    <li key={i.id} className="py-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          aria-label={`Fatto: ${i.title}`}
                          className="h-6 w-6 shrink-0"
                          checked={state.checklistDone.includes(i.id)}
                          onChange={() => updateState((s) => toggleChecklist(s, i.id))}
                        />
                        <button type="button" className="flex-1 text-left" onClick={() => setOpenId(openId === i.id ? undefined : i.id)}>
                          <span className="font-medium">{i.title}</span>
                          {i.due ? (
                            <span className="ml-2"><Pill tone={i.due < today ? "stop" : diffDays(today, i.due) <= 3 ? "warn" : "default"}>{i.due < today ? "scaduta" : `entro ${shortDate(i.due)}`}</Pill></span>
                          ) : null}
                        </button>
                      </div>
                      {openId === i.id ? <p className="ml-9 mt-1 text-sm text-zinc-600 dark:text-zinc-400">{i.detail}</p> : null}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <H2>3 · La settimana appena finita</H2>
            {f ? (
              <>
                <Card>
                  <p className="text-sm text-zinc-500">Settimana {f.week.index} · {shortDate(f.week.start)}–{shortDate(f.week.end)}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-2xl font-bold">{f.summary.doneRuns}/{f.summary.plannedRuns}</p><p className="text-xs text-zinc-500">corse</p></div>
                    <div><p className="text-2xl font-bold">{f.actualKm.toFixed(1)}</p><p className="text-xs text-zinc-500">km (previsti ~{f.plannedKm.toFixed(0)})</p></div>
                    <div>
                      <p className="text-2xl font-bold">{f.changeVsPrevPct !== undefined ? `${f.changeVsPrevPct > 0 ? "+" : ""}${f.changeVsPrevPct.toFixed(0)}%` : "–"}</p>
                      <p className="text-xs text-zinc-500">vs sett. prec.</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm">
                    Sensazioni: {feelings.length > 0 ? feelings.map(([k, n]) => `${n}× ${k}`).join(", ") : "non registrate"}.
                  </p>
                  <p className="mt-1 text-sm">
                    Dolori: {f.summary.painRuns.length === 0 ? "nessuno segnalato" : f.summary.painRuns.map((r) => `${shortDate(r.date)} ${r.pain}/10${r.painLocation ? ` ${r.painLocation}` : ""}${r.painType ? ` (${r.painType})` : ""}`).join("; ")}.
                  </p>
                </Card>
                <ul className="mt-2 space-y-2">
                  {f.summary.statuses.filter((s) => s.session.kind !== "gym" && s.session.kind !== "rest").map((s) => (
                    <SessionRow key={s.session.weekday} status={s} profile={profile} showHint={false} adjustment={f.effective.adjustments.find((a) => a.date === s.date)} />
                  ))}
                </ul>
                {f.summary.extraRuns.length > 0 ? (
                  <p className="mt-2 px-1 text-sm text-zinc-500">Corse extra: {f.summary.extraRuns.map((r) => `${shortDate(r.date)} ${r.km.toFixed(1)} km`).join(", ")}.</p>
                ) : null}
                <div className="mt-2"><AdviceList advices={f.advices.filter((a) => a.rule === "R4")} /></div>
              </>
            ) : (
              <Card>
                Il piano parte domani: ancora nessuna settimana da riassumere. Registra le corse dalla scheda <span className="font-semibold">Corsa</span>.
              </Card>
            )}

            <Link href="/corsa" className={`${btnSecondary} mt-6 w-full`}>Registra una corsa</Link>
          </>
        );
      }}
    </WithCoach>
  );
}
