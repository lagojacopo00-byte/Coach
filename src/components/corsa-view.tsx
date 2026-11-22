"use client";

import { useState } from "react";
import { updateState } from "../data/store";
import { formatDuration, formatPaceOrDash, KIND_LABEL, parseDuration, shortDate } from "../domain/guidance";
import { addRun, removeRun } from "../domain/state";
import { isRunSession, paceOf, RUN_KINDS } from "../domain/summary";
import type { PainLocation, PainType, Run, RunFeeling, SessionKind } from "../domain/types";
import { RUN_FEELINGS } from "../domain/types";
import { todayView } from "../domain/views";
import { weekForDate, weekdayOf } from "../domain/week";
import { AdviceList, btnDanger, btnPrimary, Card, Field, H2, inputCls, PageTitle } from "./ui";
import { WithCoach } from "./with-coach";

export function CorsaView() {
  return <WithCoach>{({ state, today }) => <Form key={today} state={state} today={today} />}</WithCoach>;
}

function Form({ state, today }: { state: import("../domain/state").AppState; today: string }) {
  const plannedKind = (date: string): SessionKind => {
    const w = weekForDate(date);
    const s = w?.sessions.find((x) => x.weekday === weekdayOf(date));
    return s && isRunSession(s) ? s.kind : "easy";
  };
  const [date, setDate] = useState(today);
  const [kind, setKind] = useState<SessionKind>(plannedKind(today));
  const [km, setKm] = useState("");
  const [time, setTime] = useState("");
  const [hr, setHr] = useState("");
  const [gain, setGain] = useState("");
  const [feeling, setFeeling] = useState<RunFeeling | "">("");
  const [pain, setPain] = useState(0);
  const [loc, setLoc] = useState<PainLocation>("tibia");
  const [type, setType] = useState<PainType>("diffuso");
  const [heavy, setHeavy] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const kmN = Number(km.replace(",", "."));
  const dur = parseDuration(time);
  const pace = kmN > 0 && dur ? paceOf({ km: kmN, durationSec: dur }) : undefined;

  function submit() {
    setSaved(false);
    if (!(kmN > 0)) return setError("Inserisci i km (es. 8,5).");
    if (!dur) return setError("Tempo non valido: usa mm:ss oppure h:mm:ss (es. 48:30).");
    const hrN = hr ? Number(hr) : undefined;
    if (hrN !== undefined && !(hrN >= 40 && hrN <= 230)) return setError("FC media non plausibile.");
    const run: Run = {
      id: crypto.randomUUID(),
      date,
      kind,
      km: kmN,
      durationSec: dur,
      avgPaceSecPerKm: Math.round(dur / kmN),
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
    setSaved(true);
    setKm("");
    setTime("");
    setHr("");
    setGain("");
    setFeeling("");
    setPain(0);
    setHeavy(false);
    setNotes("");
  }

  const advices = todayView(state, today).advices.filter((a) => a.rule === "R3" || a.rule === "R2");
  const recent = [...state.runs].reverse().slice(0, 15);

  return (
    <>
      <PageTitle sub="Registra in 20 secondi, appena finito">Nuova corsa</PageTitle>
      {saved ? <div className="mb-3 space-y-2"><Card tone="ok">Corsa salvata ✅</Card><AdviceList advices={advices} /></div> : null}
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <input type="date" className={inputCls} value={date} onChange={(e) => { setDate(e.target.value); setKind(plannedKind(e.target.value)); }} />
          </Field>
          <Field label="Tipo">
            <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as SessionKind)}>
              {RUN_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Km"><input inputMode="decimal" placeholder="8,5" className={inputCls} value={km} onChange={(e) => setKm(e.target.value)} /></Field>
          <Field label="Tempo" hint="mm:ss o h:mm:ss"><input inputMode="numeric" placeholder="48:30" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        {pace ? <p className="px-1 text-sm text-zinc-500">Passo medio: <span className="font-semibold">{formatPaceOrDash(pace)}/km</span></p> : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="FC media"><input inputMode="numeric" placeholder="bpm" className={inputCls} value={hr} onChange={(e) => setHr(e.target.value)} /></Field>
          <Field label="D+ (m)"><input inputMode="numeric" placeholder="0" className={inputCls} value={gain} onChange={(e) => setGain(e.target.value)} /></Field>
        </div>
        <Field label="Sensazioni">
          <select className={inputCls} value={feeling} onChange={(e) => setFeeling(e.target.value as RunFeeling | "")}>
            <option value="">–</option>
            {RUN_FEELINGS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
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
          <Card tone="stop" className="!p-3 text-sm font-medium">Dolore puntiforme sulla tibia: salvandolo il coach sospende la corsa e ti rimanda a un professionista.</Card>
        ) : null}
        <Field label="Note"><textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {error ? <p role="alert" className="text-sm font-medium text-red-600">{error}</p> : null}
        <button type="submit" className={`${btnPrimary} w-full`}>Salva corsa</button>
      </form>

      <H2>Ultime corse</H2>
      {recent.length === 0 ? <Card>Nessuna corsa registrata.</Card> : (
        <ul className="space-y-2">
          {recent.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <div>
                <p className="font-medium">{shortDate(r.date)} · {KIND_LABEL[r.kind]} · {r.km.toFixed(1)} km</p>
                <p className="text-zinc-500">{formatDuration(r.durationSec)} · {formatPaceOrDash(paceOf(r))}/km{r.avgHr ? ` · ${r.avgHr} bpm` : ""}{r.pain > 0 ? ` · dolore ${r.pain}/10` : ""}</p>
              </div>
              <button type="button" className={`${btnDanger} !min-h-9 !px-3 !py-1 text-xs`} onClick={() => { if (window.confirm("Eliminare questa corsa?")) updateState((s) => removeRun(s, r.id)); }}>Elimina</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
