"use client";

import { useEffect, useState } from "react";
import { disconnectStrava, errorText, fetchStravaActivities, getStravaStatus, type StravaStatus } from "../data/strava-client";
import { useGarminStatus } from "./garmin-card";
import { applyImport } from "./import-runs";
import { btnDanger, btnPrimary, btnSecondary, Section } from "./ui";

/** Stato di Strava per questo browser. `undefined` finché non risponde. */
export function useStravaStatus(refreshKey = 0): StravaStatus | undefined {
  const [status, setStatus] = useState<StravaStatus | undefined>();
  useEffect(() => {
    let alive = true;
    getStravaStatus().then((s) => alive && setStatus(s ?? { configured: false, connected: false }));
    return () => {
      alive = false;
    };
  }, [refreshKey]);
  return status;
}

const RESULT_TEXT: Record<string, string> = {
  ok: "Strava collegato.",
  negato: "Hai annullato il collegamento.",
  permessi: "Servono i permessi per leggere le attività: riprova e lascia spuntate tutte le caselle.",
  errore: "Collegamento non riuscito: riprova.",
  "non-configurato": "Strava non è ancora configurato (mancano le chiavi su Vercel).",
};

export function StravaSection() {
  const [refresh, setRefresh] = useState(0);
  const status = useStravaStatus(refresh);
  const [msg, setMsg] = useState<string | undefined>(() => {
    const r = new URLSearchParams(window.location.search).get("strava");
    return r ? RESULT_TEXT[r] : undefined;
  });
  const [busy, setBusy] = useState(false);
  // Si apre da solo quando si torna da Strava con un messaggio (?strava=…).
  const [startOpen] = useState(() => new URLSearchParams(window.location.search).has("strava"));
  const garmin = useGarminStatus();

  useEffect(() => {
    // Tolgo ?strava=… dall'indirizzo: il messaggio resta, il parametro no.
    if (new URLSearchParams(window.location.search).has("strava")) window.history.replaceState(null, "", "/profilo");
  }, []);

  async function importRecent() {
    setBusy(true);
    setMsg(undefined);
    const r = await fetchStravaActivities();
    if (!r.ok) {
      setMsg(errorText(r.error));
      if (r.error === "not_connected") setRefresh((n) => n + 1);
    } else {
      setMsg(applyImport(r.activities));
    }
    setBusy(false);
  }

  // Se Garmin è configurato e Strava no, non serve mostrare anche le istruzioni di Strava.
  if (garmin?.configured && status && !status.connected) return null;

  return (
    <Section title="Strava (alternativa a Garmin)" open={startOpen} hint={status?.connected ? "collegato" : undefined}>
        {!status ? (
          <p className="text-sm text-zinc-500">Controllo…</p>
        ) : !status.configured ? (
          <NotConfigured />
        ) : status.connected ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Strava è collegato. Il tuo Garmin sincronizza lì le corse: qui le importi con km, tempo, FC e dislivello. Sensazioni e dolore li aggiungi tu.</p>
            <button type="button" className={`${btnPrimary} w-full`} disabled={busy} onClick={importRecent}>
              {busy ? "Importo…" : "Importa le corse degli ultimi 30 giorni"}
            </button>
            <button
              type="button"
              className={`${btnDanger} w-full`}
              onClick={async () => {
                if (!window.confirm("Scollegare Strava? Le corse già importate restano.")) return;
                await disconnectStrava();
                setMsg("Strava scollegato.");
                setRefresh((n) => n + 1);
              }}
            >
              Scollega Strava
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Collega Strava per importare le corse del Garmin senza riscriverle. L&apos;app legge solo le tue attività, non scrive nulla su Strava.</p>
            {/* Navigazione normale (non Link): deve uscire dall'app verso Strava. */}
            <a href="/api/strava/connect" className={`${btnPrimary} w-full`}>Collega Strava</a>
          </div>
        )}
        {msg ? <p role="status" className="mt-3 rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800">{msg}</p> : null}
      </Section>
  );
}

function NotConfigured() {
  const host = window.location.host;
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">Per collegare Strava servono due chiavi sul server (una volta sola):</p>
      <ol className="list-decimal space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
        <li>Su strava.com/settings/api crea un&apos;app (nome a piacere). Come «Authorization Callback Domain» scrivi <span className="font-mono">{host}</span>.</li>
        <li>Su Vercel, nel progetto: Settings → Environment Variables. Aggiungi <span className="font-mono">STRAVA_CLIENT_ID</span> e <span className="font-mono">STRAVA_CLIENT_SECRET</span> con i valori di Strava.</li>
        <li>Fai un nuovo deploy (Deployments → Redeploy).</li>
      </ol>
      <p className={`${btnSecondary} pointer-events-none opacity-60`}>Collega Strava (non ancora disponibile)</p>
    </div>
  );
}
