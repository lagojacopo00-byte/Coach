# PLAN — task del loop

Piano completo: vedi `docs/HANDOFF.md`. Un task per iterazione; spunta quando `npm run check` è verde.

## F0 Scaffold
- [x] Next.js + Tailwind + TypeScript, Vitest, lint, CI, CLAUDE.md, PLAN.md, HANDOFF

## F1 Dominio (`src/domain/`)
- [x] Tipi: Session, Week, Phase, Run, Profile
- [x] `plan.seed.ts`: 16 settimane + settimana 0 (§4), con test di coerenza (date, fasi, sett. 15 = maratona)
- [x] `week.ts`: settimana corrente da una data, fase, countdown alla gara
- [x] `zones.ts`: zone FC da LTHR e ritmi easy/soglia (§5)
- [x] `summary.ts`: pianificato vs fatto, km settimanali, variazione % settimanale

## F2 Regole coach (`src/domain/rules.ts`)
- [x] R1 tetto +10% settimanale (scarichi sett. 4 e 9 esclusi)
- [x] R2 martedì con gambe pesanti/tibie doloranti → easy
- [x] R3 dolore puntiforme sull'osso → stop corsa, bici, avviso medico
- [x] R4 seduta saltata: nessun recupero
- [x] R5 ricalcolo ritmi dopo test soglia
- [x] R6 promemoria gel nei lunghi > 90'
- [x] R7 mezza 14/02 oltre 1:54 → proposta di rivedere il target

## F3 Supabase (supervisionato)
- [x] Repository locale (localStorage) con backup/ripristino JSON in `src/data/` (interfaccia `StateRepository`)
- [ ] Migrazioni, RLS utente singolo, auth magic link, repository Supabase (serve un progetto Supabase)

## F4 UI (mobile-first)
- [x] Vista Domenica sera: prossima settimana + checklist + riepilogo
- [x] Form rapido log corsa
- [x] Piano 16 settimane, barra fasi, countdown
- [x] Checklist elementi da fare (seed §7)
- [x] Onboarding (§8) e inserimento LTHR

## F4b Redesign (richiesta di Jacopo, 22/11)
- [x] Griglia Settimane (righe = settimane, colonne = giorni, colori per tipo) con andamento carico/lungo
- [x] Oggi = allenamento del giorno + Fatto/Non fatto/sensazioni; via countdown, fasi e vista Domenica
- [x] Icone al posto delle emoji, nuovo logo
- [x] R8: easy facoltativa del venerdì dalla sett. 5 (mai in scarico, mezza e ultime due settimane), solo se dolore <3/10 a tibie/polpacci (21 gg), niente gambe pesanti (14 gg), nessuno stop R3 e +10% rispettato
- [x] Palestra: scheda modificabile, log pesi/ripetizioni, progressione, storico e progressi
- [x] Scheda palestra concordata: due full body (A lun, B mer), gambe spezzate, prevenzione tibie/polpacci; scarico/tapering/qualità dura dosano le serie
- [x] Palestra: serie decise dal coach (volume +1 su panca, tirata e alzate dalla sett. 5, solo con continuità), carico copiato su tutte le serie, salvataggio a ogni modifica con ripresa dell'allenamento
- [x] Tempi e passi scritti solo con le cifre (4139 → 41:39) e corsa salvabile senza km, tempo o altri dati
- [x] Import da Strava (Garmin sincronizza lì): collegamento OAuth, "Importa da Strava" nella seduta, import delle ultime corse; token in cookie httpOnly cifrato, chiavi solo su Vercel
- [x] Import da Garmin (Personal API, sola lettura): token dalla chiave, elenco attività, blocco con PIN (cookie firmato), diagnostica se non riconosce i campi
- [ ] Garmin: servono GARMIN_API_KEY e GARMIN_APP_PIN su Vercel; al primo import verificare i nomi dei campi (non documentati pubblicamente)
- [ ] Strava (alternativa): servono STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET su Vercel (le crea Jacopo su strava.com/settings/api)

## F5 PWA
- [x] Manifest, icone, service worker
- [ ] Prova "Aggiungi a Home" su iPhone (richiede hosting HTTPS e il tuo telefono)

## F6 Fase 2 (opzionale)
- [ ] Import Garmin .fit/.csv, grafici, coach chat Claude API

## Blocchi
- F3 Supabase: serve un progetto Supabase (URL + anon key) creato da Jacopo; la task è "supervisionata" e tocca dati sensibili (salute). Fino ad allora i dati stanno su localStorage, con backup manuale.
- R1: il piano base supera il +10% nelle sett. 2, 6, 8, 12, 15 (dopo settimane leggere o con la gara). Il seed non si tocca: l'app avvisa solo sui km reali. Da rivedere con Jacopo.
- Dopo i test fisici (soglia 3/12, mezza 14/02) i risultati si inseriscono in Profilo: ricalcolano zone/ritmi (R5) e valutano il target (R7). Eventuali modifiche al piano base vanno fatte a mano su `plan.seed.ts`.

- [x] Revisione UI (24/11): Oggi con la settimana e le V verdi; Settimane con leggenda in fondo; Corse con aggiungi/km settimanali/analisi/elenco colorato/dati interessanti; Profilo a sezioni chiuse
