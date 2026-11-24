"use client";

import { useState } from "react";
import { updateState } from "../data/store";
import { formatDuration, formatPaceOrDash, KIND_LABEL, parseOptionalDuration } from "../domain/guidance";
import { addRun } from "../domain/state";
import { isRunSession, paceOf, RUN_KINDS } from "../domain/summary";
import type { StravaActivity } from "../domain/strava";
import type { IsoDate, PainLocation, PainType, Run, RunFeeling, SessionKind } from "../domain/types";
import { RUN_FEELINGS } from "../domain/types";
import { weekForDate, weekdayOf } from "../domain/week";
import { TimeInput } from "./time-input";
import { btnPrimary, btnSecondary, Field, inputCls } from "./ui";

/** Tipo della corsa pianificata per una data, se c'è. */
export function plannedRunKindOn(date: IsoDate): SessionKind | undefined {
  const s = weekForDate(date)?.sessions.find((x) => x.weekday === weekdayOf(date));
  return s && isRunSession(s) ? s.kind : undefined;
}

/** Tipo di seduta pianificato per una data (easy se non c'è una corsa in piano). */
export function plannedKindOn(date: IsoDate): SessionKind {
  return plannedRunKindOn(date) ?? "easy";
}

const FEELING_LABEL: Record<RunFeeling, string> = {
  ottime: "Ottime",
  buone: "Buone",
  normali: "Normali",
  pesanti: "Pesanti",
  pessime: "Pessime",
};

export function RunForm({
  date: initialDate,
  defaultKind,
  plannedKm,
  existing,
  prefill,
  dateEditable = false,
  onSaved,
  onCancel,
}: {
  date: IsoDate;
  defaultKind: SessionKind;
  plannedKm?: number;
  existing?: Run;
  /** Dati presi da Strava: precompilano km, tempo, FC e dislivello. */
  prefill?: StravaActivity;
  dateEditable?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [date, setDate] = useState(existing?.date ?? initialDate);
  const [kind, setKind] = useState<SessionKind>(existing?.kind ?? defaultKind);
  const seed = existing ?? (prefill ? { km: prefill.km, durationSec: prefill.durationSec, avgHr: prefill.avgHr, elevationGainM: prefill.elevationGainM } : undefined);
  const [km, setKm] = useState(seed && seed.km > 0 ? String(seed.km).replace(".", ",") : "");
  const [time, setTime] = useState(seed && seed.durationSec > 0 ? formatDuration(seed.durationSec) : "");
  const [hr, setHr] = useState(seed?.avgHr?.toString() ?? "");
  const [gain, setGain] = useState(seed?.elevationGainM?.toString() ?? "");
  const [feeling, setFeeling] = useState<RunFeeling | undefined>(existing?.feeling);
  const [pain, setPain] = useState(existing?.pain ?? 0);
  const [loc, setLoc] = useState<PainLocation>(existing?.painLocation ?? "tibia");
  const [type, setType] = useState<PainType>(existing?.painType ?? "diffuso");
  const [heavy, setHeavy] = useState(existing?.heavyLegs ?? false);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string>();

  // Km, tempo e il resto sono facoltativi: puoi salvare anche solo "fatto".
  const kmN = km.trim() === "" ? 0 : Number(km.replace(",", "."));
  const dur = parseOptionalDuration(time);
  const pace = kmN > 0 && dur ? paceOf({ km: kmN, durationSec: dur }) : undefined;

  function submit() {
    if (!Number.isFinite(kmN) || kmN < 0) return setError("Km non validi (es. 8,5).");
    if (dur === undefined) return setError("Tempo non valido: minuti e secondi arrivano al massimo a 59.");
    const hrN = hr ? Number(hr) : undefined;
    if (hrN !== undefined && !(hrN >= 40 && hrN <= 230)) return setError("FC media non plausibile.");
    const run: Run = {
      id: existing?.id ?? (prefill ? `strava-${prefill.id}` : crypto.randomUUID()),
      ...(existing?.stravaId ?? prefill?.id ? { stravaId: existing?.stravaId ?? prefill?.id } : {}),
      date,
      kind,
      km: kmN,
      durationSec: dur,
      ...(kmN > 0 && dur > 0 ? { avgPaceSecPerKm: Math.round(dur / kmN) } : {}),
      ...(hrN ? { avgHr: hrN } : {}),
      ...(gain ? { elevationGainM: Number(gain) } : {}),
      ...(feeling ? { feeling } : {}),
      pain,
      ...(pain > 0 ? { painLocation: loc, painType: type } : {}),
      ...(heavy ? { heavyLegs: true } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    try {
      updateState((s) => addRun(s, run));
    } catch (e) {
      return setError(e instanceof Error ? e.message : "Errore nel salvataggio.");
    }
    setError(undefined);
    onSaved?.();
  }

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      {prefill && !existing ? (
        <p className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm dark:border-orange-900 dark:bg-orange-950/40">
          Dati da Strava ({prefill.name}). Controlla e aggiungi sensazioni e dolore.
        </p>
      ) : null}
      {dateEditable ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <input type="date" className={inputCls} value={date} onChange={(e) => { setDate(e.target.value); setKind(plannedKindOn(e.target.value)); }} />
          </Field>
          <Field label="Tipo">
            <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as SessionKind)}>
              {RUN_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </Field>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Km"><input inputMode="decimal" placeholder={plannedKm ? String(plannedKm).replace(".", ",") : "8,5"} className={inputCls} value={km} onChange={(e) => setKm(e.target.value)} /></Field>
        <Field label="Tempo" hint="Solo cifre: 4830 diventa 48:30"><TimeInput placeholder="48:30" value={time} onChange={setTime} /></Field>
      </div>
      <p className="px-1 text-xs text-zinc-500">Tutti i campi sono facoltativi: puoi salvare anche solo &quot;fatto&quot;.</p>
      {pace ? <p className="px-1 text-sm text-zinc-500">Passo medio: <span className="font-semibold">{formatPaceOrDash(pace)}/km</span></p> : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="FC media"><input inputMode="numeric" placeholder="bpm" className={inputCls} value={hr} onChange={(e) => setHr(e.target.value)} /></Field>
        <Field label="D+ (m)"><input inputMode="numeric" placeholder="0" className={inputCls} value={gain} onChange={(e) => setGain(e.target.value)} /></Field>
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium">Sensazioni</span>
        <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Sensazioni">
          {RUN_FEELINGS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={feeling === f}
              onClick={() => setFeeling(feeling === f ? undefined : f)}
              className={`min-h-11 rounded-xl border px-1 text-xs font-medium ${feeling === f ? "border-orange-500 bg-orange-500 text-white" : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"}`}
            >
              {FEELING_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={heavy} onChange={(e) => setHeavy(e.target.checked)} /><span>Gambe pesanti</span></label>
      <Field label={`Dolore: ${pain}/10`}>
        <input type="range" min={0} max={10} value={pain} onChange={(e) => setPain(Number(e.target.value))} className="w-full" />
      </Field>
      {pain > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dove">
            <select className={inputCls} value={loc} onChange={(e) => setLoc(e.target.value as PainLocation)}>
              <option value="tibia">Tibia</option><option value="polpaccio">Polpaccio</option><option value="altro">Altro</option>
            </select>
          </Field>
          <Field label="Tipo">
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as PainType)}>
              <option value="diffuso">Diffuso</option><option value="puntiforme">Puntiforme (su un punto dell&apos;osso)</option>
            </select>
          </Field>
        </div>
      ) : null}
      {pain > 0 && loc === "tibia" && type === "puntiforme" ? (
        <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
          Dolore puntiforme sulla tibia: salvandolo il coach sospende la corsa e ti rimanda a un professionista.
        </p>
      ) : null}
      <Field label="Note"><textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      {error ? <p role="alert" className="text-sm font-medium text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        {onCancel ? <button type="button" className={`${btnSecondary} flex-1`} onClick={onCancel}>Annulla</button> : null}
        <button type="submit" className={`${btnPrimary} flex-[2]`}>Salva</button>
      </div>
    </form>
  );
}
