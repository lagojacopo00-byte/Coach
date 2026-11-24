"use client";

import Link from "next/link";
import { useState } from "react";
import { exportBackup, importBackup } from "../data/storage";
import { replaceState, setSimDate, updateState } from "../data/store";
import { stopStatus } from "../domain/coach";
import { formatDuration, parseDuration, shortDate } from "../domain/guidance";
import { applyOnboarding, onboardingCheckIn, validateOnboarding, type OnboardingInput } from "../domain/profile";
import { HALF_CHECKPOINT_SEC, halfAdvice } from "../domain/rules";
import {
  addCheckIn,
  applyOnboardingToState,
  clearRunStop,
  initialState,
  recordHalf,
  recordThresholdTest,
  type AppState,
} from "../domain/state";
import { easyPaceRange, formatPace, hrZones, parsePace, thresholdPaceRange } from "../domain/zones";
import { AdviceList, btnDanger, btnPrimary, btnSecondary, Card, Field, H2, inputCls, PageTitle } from "./ui";
import { TimeInput } from "./time-input";
import { WithCoach } from "./with-coach";

const num = (v: string): number | undefined => (v.trim() === "" ? undefined : Number(v.replace(",", ".")));

export function ProfiloView() {
  return (
    <WithCoach>
      {({ state, today, simDate }) => (
        <>
          <PageTitle sub="Dati, zone, test fisici e backup">Profilo</PageTitle>
          <StopSection state={state} today={today} />
          <Onboarding key={String(state.onboardingDone)} state={state} today={today} />
          <ExtraEasy state={state} />
          <Zones state={state} />
          <ThresholdTest state={state} today={today} />
          <HalfTest state={state} today={today} />
          <Backup state={state} />
          <Tools simDate={simDate} today={today} />
          <p className="mt-6 text-center text-sm"><Link href="/todo" className="text-orange-600">Elementi da fare</Link></p>
        </>
      )}
    </WithCoach>
  );
}

function StopSection({ state, today }: { state: AppState; today: string }) {
  const stop = stopStatus(state);
  if (!stop.active) return null;
  const since = stop.since;
  return (
    <Card tone="stop" className="mb-4">
      <p className="font-semibold">Corsa sospesa dal {stop.since ? shortDate(stop.since) : ""}</p>
      <p className="mt-1 text-sm">Dolore puntiforme sull&apos;osso della tibia: bici al posto della corsa e valutazione da un medico o fisioterapista dello sport. Il coach non è un medico.</p>
      {since !== undefined && today > since ? (
        <button
          type="button"
          className={`${btnDanger} mt-3 w-full`}
          onClick={() => {
            if (window.confirm("Confermi di essere stato valutato da un professionista e di poter riprendere a correre?")) {
              updateState((s) => clearRunStop(s, today));
            }
          }}
        >
          Valutato da un professionista: riprendo
        </button>
      ) : (
        <p className="mt-3 text-sm font-medium">Il via libera si può registrare dal giorno dopo la segnalazione, dopo la visita.</p>
      )}
    </Card>
  );
}

function Onboarding({ state, today }: { state: AppState; today: string }) {
  const o = state.onboarding ?? {};
  const [age, setAge] = useState(o.age?.toString() ?? state.profile.age?.toString() ?? "");
  const [rhr, setRhr] = useState(o.restingHr?.toString() ?? state.profile.restingHr?.toString() ?? "");
  const [mhr, setMhr] = useState(o.maxHr?.toString() ?? state.profile.maxHr?.toString() ?? "");
  const [km4, setKm4] = useState(o.weeklyKmLast4?.toString() ?? "");
  const [tib, setTib] = useState(o.tibiaPain?.toString() ?? "0");
  const [tibType, setTibType] = useState<"diffuso" | "puntiforme">(o.tibiaPainType ?? "diffuso");
  const [shoes, setShoes] = useState(o.shoes ?? "");
  const [shoesKm, setShoesKm] = useState(o.shoesKm?.toString() ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  function save() {
    const input: OnboardingInput = {
      age: num(age), restingHr: num(rhr), maxHr: num(mhr), weeklyKmLast4: num(km4),
      tibiaPain: num(tib), tibiaPainType: tibType, shoes: shoes.trim() || undefined, shoesKm: num(shoesKm),
    };
    const errs = validateOnboarding(input);
    setErrors(errs);
    if (errs.length > 0) return setSaved(false);
    updateState((s) => {
      let next = applyOnboardingToState(s, input, applyOnboarding(s.profile, input));
      const c = onboardingCheckIn(input, today);
      if (c) next = addCheckIn(next, c);
      return next;
    });
    setSaved(true);
  }

  return (
    <>
      <H2>I tuoi dati {state.onboardingDone ? "" : "· da completare"}</H2>
      <Card>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Età"><input inputMode="numeric" className={inputCls} value={age} onChange={(e) => setAge(e.target.value)} /></Field>
            <Field label="FC riposo"><input inputMode="numeric" className={inputCls} value={rhr} onChange={(e) => setRhr(e.target.value)} /></Field>
            <Field label="FC max"><input inputMode="numeric" className={inputCls} value={mhr} onChange={(e) => setMhr(e.target.value)} /></Field>
          </div>
          <Field label="Km/settimana ultime 4 settimane (media)" hint="Serve al coach per il tetto +10% (R1)."><input inputMode="decimal" className={inputCls} value={km4} onChange={(e) => setKm4(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Dolore tibie oggi: ${tib}/10`}><input type="range" min={0} max={10} value={tib} onChange={(e) => setTib(e.target.value)} className="w-full" /></Field>
            <Field label="Tipo">
              <select className={inputCls} value={tibType} onChange={(e) => setTibType(e.target.value as "diffuso" | "puntiforme")}>
                <option value="diffuso">Diffuso</option><option value="puntiforme">Puntiforme</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Scarpe"><input className={inputCls} value={shoes} onChange={(e) => setShoes(e.target.value)} /></Field>
            <Field label="Km scarpe"><input inputMode="numeric" className={inputCls} value={shoesKm} onChange={(e) => setShoesKm(e.target.value)} /></Field>
          </div>
          <p className="text-xs text-zinc-500">Giorni fissi: corsa mar/gio/dom, palestra lun/ven (il piano è costruito su questi).</p>
          {errors.map((e) => <p key={e} role="alert" className="text-sm font-medium text-red-600">{e}</p>)}
          <button type="submit" className={`${btnPrimary} w-full`}>Salva</button>
          {saved ? <p className="text-center text-sm text-emerald-700 dark:text-emerald-300">Salvato.</p> : null}
        </form>
      </Card>
    </>
  );
}

function Zones({ state }: { state: AppState }) {
  const p = state.profile;
  if (!p.lthr || !p.thresholdPaceSecPerKm) {
    return (
      <>
        <H2>Zone e ritmi</H2>
        <Card tone="info"><p className="text-sm">Dopo il test soglia (gio 3 dicembre) inserisci i risultati qui sotto: l&apos;app calcola zone FC e ritmi. Fino ad allora si corre a sensazione (talk test).</p></Card>
      </>
    );
  }
  const z = hrZones(p.lthr);
  const e = easyPaceRange(p.thresholdPaceSecPerKm);
  const t = thresholdPaceRange(p.thresholdPaceSecPerKm);
  return (
    <>
      <H2>Zone e ritmi · LTHR {p.lthr}</H2>
      <Card>
        <table className="w-full text-sm">
          <tbody>
            {z.map((x) => (
              <tr key={x.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <td className="py-1 font-semibold">{x.id}</td><td>{x.name}</td>
                <td className="text-right">{x.max ? `${x.min}–${x.max}` : `≥${x.min}`} bpm</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm">Easy: <b>{formatPace(e.fast)}–{formatPace(e.slow)}</b>/km · Soglia: <b>{formatPace(t.fast)}–{formatPace(t.slow)}</b>/km · RM: <b>5:40</b>/km</p>
        <p className="mt-2 text-xs text-zinc-500">Imposta la stessa LTHR sul Garmin per avere le zone giuste sull&apos;orologio. I ritmi sono indicazioni: il talk test resta il criterio per l&apos;easy.</p>
      </Card>
    </>
  );
}

function ThresholdTest({ state, today }: { state: AppState; today: string }) {
  const [date, setDate] = useState(today);
  const [hr, setHr] = useState("");
  const [pace, setPace] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  function save() {
    const paceSec = parsePace(pace);
    if (!paceSec) return setError("Passo non valido: usa m:ss (es. 5:25).");
    try {
      let msg = "";
      updateState((s) => {
        const r = recordThresholdTest(s, { date, last20AvgHr: Number(hr), last20PaceSecPerKm: paceSec });
        msg = `LTHR ${r.recalculation.lthr} bpm · soglia ${formatPace(r.recalculation.thresholdPaceSecPerKm)}/km · easy ${formatPace(r.recalculation.easy.fast)}–${formatPace(r.recalculation.easy.slow)}/km. Aggiorna la LTHR sul Garmin.`;
        return r.state;
      });
      setError(undefined);
      setDone(msg);
    } catch (e) {
      setDone(undefined);
      setError(e instanceof Error ? e.message : "Valori non validi.");
    }
  }

  return (
    <>
      <H2>Test soglia 30&apos; · ricalcolo ritmi</H2>
      <Card>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">Riposo da 48h, in piano, 15&apos; di riscaldamento e 30&apos; al massimo sostenibile costante. Inserisci FC e passo medi degli <b>ultimi 20&apos;</b>.</p>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Field label="Data"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="FC media ultimi 20'"><input inputMode="numeric" className={inputCls} value={hr} onChange={(e) => setHr(e.target.value)} placeholder="bpm" /></Field>
            <Field label="Passo medio ultimi 20'" hint="Solo cifre: 525 diventa 5:25"><TimeInput maxDigits={4} value={pace} onChange={setPace} placeholder="5:25" /></Field>
          </div>
          {error ? <p role="alert" className="text-sm font-medium text-red-600">{error}</p> : null}
          <button type="submit" className={`${btnPrimary} w-full`}>Ricalcola zone e ritmi</button>
          {done ? <p className="rounded-xl bg-emerald-50 p-3 text-sm dark:bg-emerald-950/40">{done}</p> : null}
        </form>
        {state.thresholdTests.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-zinc-500">
            {state.thresholdTests.map((t) => <li key={t.date}>{shortDate(t.date)}: {t.last20AvgHr} bpm · {formatPace(t.last20PaceSecPerKm)}/km</li>)}
          </ul>
        ) : null}
      </Card>
    </>
  );
}

function HalfTest({ state, today }: { state: AppState; today: string }) {
  const [time, setTime] = useState(state.halfResult ? formatDuration(state.halfResult.timeSec) : "");
  const [error, setError] = useState<string>();
  const advice = state.halfResult ? halfAdvice(state.halfResult.timeSec) : undefined;
  return (
    <>
      <H2>Mezza di prova · 14 febbraio</H2>
      <Card>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const sec = parseDuration(time);
          if (!sec) return setError("Tempo non valido: usa h:mm:ss (es. 1:52:30).");
          setError(undefined);
          updateState((s) => recordHalf(s, { date: today, timeSec: sec }));
        }}>
          <Field label="Tempo ufficiale" hint={`Solo cifre: 15230 diventa 1:52:30. Checkpoint: ≤ ${formatDuration(HALF_CHECKPOINT_SEC)} = sub 4 realistico.`}><TimeInput value={time} onChange={setTime} placeholder="1:52:30" /></Field>
          {error ? <p role="alert" className="text-sm font-medium text-red-600">{error}</p> : null}
          <button type="submit" className={`${btnSecondary} w-full`}>Valuta il checkpoint</button>
        </form>
        {advice ? <div className="mt-3"><AdviceList advices={[advice]} /></div> : null}
      </Card>
    </>
  );
}

function Backup({ state }: { state: AppState }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string>();
  return (
    <>
      <H2>Backup</H2>
      <Card>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">I dati sono salvati su questo dispositivo. Esporta un backup ogni tanto (e prima di cambiare telefono o cancellare i dati di Safari).</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={btnSecondary} onClick={async () => {
            const data = exportBackup(state);
            try { await navigator.clipboard.writeText(data); setMsg("Copiato negli appunti: incollalo in Note."); } catch { setText(data); setMsg("Copia il testo qui sotto."); }
          }}>Copia backup</button>
          <button type="button" className={btnSecondary} onClick={() => {
            const url = URL.createObjectURL(new Blob([exportBackup(state)], { type: "application/json" }));
            const a = document.createElement("a");
            a.href = url; a.download = `coach-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
            URL.revokeObjectURL(url);
          }}>Scarica file</button>
        </div>
        <Field label="Ripristina da backup (incolla il testo)">
          <textarea rows={3} className={`${inputCls} mt-2`} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <button type="button" className={`${btnSecondary} mt-2 w-full`} onClick={() => {
          const r = importBackup(text);
          if (!r.ok) return setMsg(r.error);
          if (window.confirm("Sostituire i dati attuali con il backup?")) { replaceState(r.state); setMsg("Backup ripristinato."); setText(""); }
        }}>Ripristina</button>
        {msg ? <p className="mt-2 text-sm">{msg}</p> : null}
      </Card>
    </>
  );
}

function Tools({ simDate, today }: { simDate?: string; today: string }) {
  const [d, setD] = useState(simDate ?? today);
  return (
    <>
      <H2>Strumenti</H2>
      <Card>
        <p className="mb-2 text-sm font-medium">Simula la data (per provare l&apos;app in un&apos;altra settimana)</p>
        <div className="flex gap-2">
          <input type="date" className={inputCls} value={d} onChange={(e) => setD(e.target.value)} />
          <button type="button" className={btnSecondary} onClick={() => setSimDate(d)}>Applica</button>
        </div>
        {simDate ? <button type="button" className={`${btnSecondary} mt-2 w-full`} onClick={() => setSimDate(undefined)}>Torna alla data reale</button> : null}
        <button type="button" className={`${btnDanger} mt-4 w-full`} onClick={() => {
          if (window.confirm("Cancellare TUTTI i dati (corse, check-in, test, checklist)? Fai prima un backup.")) { replaceState(initialState()); setSimDate(undefined); }
        }}>Cancella tutti i dati</button>
      </Card>
    </>
  );
}

function ExtraEasy({ state }: { state: AppState }) {
  const on = state.extraEasyOff !== true;
  return (
    <>
      <H2>Easy facoltativa del venerdì</H2>
      <Card>
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0" checked={on} onChange={() => updateState((s) => ({ ...s, extraEasyOff: on ? true : undefined }))} />
          <span>
            <span className="font-medium">Proponi una easy di 35&apos; il venerdì</span>
            <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">
              Dalla settimana 5 (fine dicembre), solo se negli ultimi giorni non hai dolore a tibie o polpacci (3/10 o più), non hai avuto gambe pesanti e i km restano entro il +10%. Non compare nelle settimane di scarico, della mezza e delle ultime due prima della gara. Se non è il momento, il venerdì resta riposo.
            </span>
          </span>
        </label>
      </Card>
    </>
  );
}
