"use client";

import { useEffect, useState } from "react";
import { fetchGarminActivities, garminErrorText, getGarminStatus, lockGarmin, unlockGarmin, type GarminStatus } from "../data/garmin-client";
import { applyImport } from "./import-runs";
import { btnPrimary, btnSecondary, Field, inputCls, Section } from "./ui";

/** Stato di Garmin per questo browser. `undefined` finché non risponde. */
export function useGarminStatus(refreshKey = 0): GarminStatus | undefined {
  const [status, setStatus] = useState<GarminStatus | undefined>();
  useEffect(() => {
    let alive = true;
    getGarminStatus().then((s) => alive && setStatus(s ?? { configured: false, unlocked: false }));
    return () => {
      alive = false;
    };
  }, [refreshKey]);
  return status;
}

const ISSUE_TEXT: Record<string, string> = {
  missing_key: "Manca la variabile GARMIN_API_KEY.",
  missing_pin: "Manca la variabile GARMIN_APP_PIN (il PIN che scegli tu).",
  short_pin: "GARMIN_APP_PIN è troppo corto: servono almeno 8 caratteri.",
};

export function GarminSection() {
  const [refresh, setRefresh] = useState(0);
  const status = useGarminStatus(refresh);
  const [msg, setMsg] = useState<string | undefined>();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function unlock() {
    setBusy(true);
    setMsg(undefined);
    const r = await unlockGarmin(pin);
    setBusy(false);
    if (r === "ok") {
      setPin("");
      setRefresh((n) => n + 1);
    } else setMsg(r === "wrong_pin" ? "PIN errato." : "Non riesco a contattare il server: riprova.");
  }

  async function importRecent() {
    setBusy(true);
    setMsg(undefined);
    const r = await fetchGarminActivities();
    setBusy(false);
    if (!r.ok) {
      setMsg(garminErrorText(r.error));
      if (r.error === "locked") setRefresh((n) => n + 1);
      return;
    }
    setMsg([applyImport(r.activities), r.message].filter(Boolean).join(" "));
  }

  return (
    <Section title="Garmin" hint={!status ? undefined : !status.configured ? "da configurare" : status.unlocked ? "attivo" : "bloccato"}>
        {!status ? (
          <p className="text-sm text-zinc-500">Controllo…</p>
        ) : !status.configured ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium">Per importare le corse dal Garmin servono una chiave e un PIN sul server (una volta sola):</p>
            <ol className="list-decimal space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
              <li>Dal <b>sito</b> di Garmin Connect (non l&apos;app): Impostazioni → Personal API, e crea la chiave. Si vede una volta sola e scade (la durata la scegli tu, al massimo 1 anno).</li>
              <li>Su Vercel, nel progetto: Settings → Environment Variables. Aggiungi <span className="font-mono">GARMIN_API_KEY</span> con la chiave e <span className="font-mono">GARMIN_APP_PIN</span> con un PIN o una frase tua di almeno 8 caratteri.</li>
              <li>Fai un nuovo deploy (Deployments → Redeploy).</li>
            </ol>
            <p className="text-zinc-600 dark:text-zinc-400">Il PIN serve perché l&apos;indirizzo del sito è pubblico: senza, chiunque lo conosca potrebbe leggere le tue corse.</p>
            {status.issue ? <p className="font-medium text-amber-700 dark:text-amber-300">{ISSUE_TEXT[status.issue]}</p> : null}
          </div>
        ) : !status.unlocked ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); unlock(); }}>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Scrivi il PIN per attivare l&apos;import Garmin su questo telefono (una volta, poi si ricorda).</p>
            <Field label="PIN">
              <input type="password" autoComplete="off" className={inputCls} value={pin} onChange={(e) => setPin(e.target.value)} />
            </Field>
            <button type="submit" className={`${btnPrimary} w-full`} disabled={busy || pin.length === 0}>{busy ? "Controllo…" : "Sblocca"}</button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Import Garmin attivo. Importa km, tempo, FC e dislivello; sensazioni e dolore li aggiungi tu. L&apos;app legge soltanto.</p>
            <button type="button" className={`${btnPrimary} w-full`} disabled={busy} onClick={importRecent}>{busy ? "Importo…" : "Importa le corse degli ultimi 30 giorni"}</button>
            <button type="button" className={`${btnSecondary} w-full`} onClick={async () => { await lockGarmin(); setMsg("Import Garmin bloccato su questo telefono."); setRefresh((n) => n + 1); }}>Blocca</button>
          </div>
        )}
        {msg ? <p role="status" className="mt-3 rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800">{msg}</p> : null}
      </Section>
  );
}
