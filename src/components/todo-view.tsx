"use client";

import { updateState } from "../data/store";
import { CHECKLIST_SEED } from "../domain/checklist.seed";
import { shortDate } from "../domain/guidance";
import { toggleChecklist } from "../domain/state";
import { diffDays } from "../domain/week";
import { Card, H2, PageTitle, Pill } from "./ui";
import { WithCoach } from "./with-coach";

export function TodoView() {
  return (
    <WithCoach>
      {({ state, today }) => {
        const open = CHECKLIST_SEED.filter((i) => !state.checklistDone.includes(i.id));
        const done = CHECKLIST_SEED.filter((i) => state.checklistDone.includes(i.id));
        const row = (i: (typeof CHECKLIST_SEED)[number], checked: boolean) => (
          <li key={i.id} className="py-3">
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0" checked={checked} onChange={() => updateState((s) => toggleChecklist(s, i.id))} />
              <span className="flex-1">
                <span className={`font-medium ${checked ? "line-through opacity-60" : ""}`}>{i.title}</span>
                {i.optional ? <span className="ml-2"><Pill>opzionale</Pill></span> : null}
                {i.due && !checked ? (
                  <span className="ml-2"><Pill tone={i.due < today ? "stop" : diffDays(today, i.due) <= 5 ? "warn" : "default"}>{i.due < today ? `scaduta ${shortDate(i.due)}` : `entro ${shortDate(i.due)}`}</Pill></span>
                ) : null}
                <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">{i.detail}</span>
              </span>
            </label>
          </li>
        );
        return (
          <>
            <PageTitle sub={`${done.length}/${CHECKLIST_SEED.length} completati`}>Da fare</PageTitle>
            {open.length === 0 ? <Card tone="ok">Tutto fatto.</Card> : <Card><ul className="divide-y divide-zinc-200 dark:divide-zinc-800">{open.map((i) => row(i, false))}</ul></Card>}
            {done.length > 0 ? (<><H2>Completati</H2><Card><ul className="divide-y divide-zinc-200 dark:divide-zinc-800">{done.map((i) => row(i, true))}</ul></Card></>) : null}
            <p className="mt-4 px-1 text-xs text-zinc-500">Costi e regole sono quelli del documento di partenza: verifica sempre sui siti ufficiali.</p>
          </>
        );
      }}
    </WithCoach>
  );
}
