import { KIND_LABEL, paceHint, shortDate, WEEKDAY_LABEL } from "../domain/guidance";
import type { SessionStatus } from "../domain/summary";
import type { Adjustment, Profile } from "../domain/types";
import { Pill } from "./ui";

const STATE_PILL = {
  done: ["Fatta", "ok"],
  missed: ["Saltata", "warn"],
  today: ["Oggi", "accent"],
  upcoming: null,
} as const;

export function SessionRow({
  status,
  profile,
  adjustment,
  showHint = true,
}: {
  status: SessionStatus;
  profile: Profile;
  adjustment?: Adjustment;
  showHint?: boolean;
}) {
  const { session, date, state, run } = status;
  const pill = STATE_PILL[state];
  const hint = showHint ? paceHint(session, profile) : undefined;
  const nonRun = session.kind === "gym" || session.kind === "rest";
  return (
    <li className={`rounded-xl border p-3 ${state === "today" ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30" : "border-zinc-200 dark:border-zinc-800"} ${nonRun ? "opacity-80" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {WEEKDAY_LABEL[session.weekday]} <span className="font-normal text-zinc-500">{shortDate(date)}</span>
        </p>
        <div className="flex items-center gap-1">
          {adjustment ? <Pill tone="warn">Cambiata {adjustment.rule}</Pill> : null}
          {pill ? <Pill tone={pill[1]}>{pill[0]}</Pill> : null}
        </div>
      </div>
      <p className="mt-1 text-sm">
        <span className="font-medium">{KIND_LABEL[session.kind]}</span>
        {session.description && session.kind !== "rest" ? <> · {session.description}</> : session.kind === "rest" ? <> · {session.description}</> : null}
      </p>
      {adjustment ? (
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
          {adjustment.reason} Previsto: <span className="line-through">{adjustment.original.description}</span>
        </p>
      ) : null}
      {hint ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
      {run ? (
        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
          Fatta: {run.km.toFixed(1)} km{run.pain > 0 ? ` · dolore ${run.pain}/10` : ""}
        </p>
      ) : null}
    </li>
  );
}
