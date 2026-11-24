# Coach Maratona

Web app personale (PWA, pensata per iPhone) per la Maratona di Roma del 14/03/2027, obiettivo sub 4h (5:41/km). Mostra il piano di 16 settimane, registra le corse e adatta il piano con regole deterministiche (vedi `docs/HANDOFF.md` e `PLAN.md`).

## Provarla

```bash
npm install
npm run dev        # http://localhost:3000
```

Versione di produzione (con service worker, per provare l'offline):

```bash
npm run build && npm start
```

## Come usarla

- **Oggi**: l'allenamento del giorno (dalla settimana 5 il venerdì può comparire una easy facoltativa di 35', solo se tibie/polpacci non danno segnali; si disattiva da Profilo), con ritmi e FC. Tocca **Fatto** (km, tempo, FC, D+, sensazioni, dolore: tutto facoltativo, puoi salvare anche solo "fatto"; il tempo si scrive solo con le cifre, 4139 diventa 41:39) o **Non fatto** (con motivo). Sotto, la settimana giorno per giorno e il check-in "gambe pesanti o dolore?".
- **Settimane**: tutte le 16 settimane in una griglia (righe = settimane, colonne = lun–dom), colorate per tipo di seduta (Easy, Lungo, Salite, Soglia, RM, Test/gara, Pesi). Tocca un giorno per dettagli e log, tocca il numero della settimana per il riepilogo. In fondo, l'andamento: carico settimanale e lungo, pianificato vs fatto.
- **Palestra**: la scheda (due full body con le gambe spezzate: A il lunedì, B il mercoledì; in scarico una serie in meno, nelle ultime due settimane gambe dimezzate). Registri pesi e ripetizioni per serie (scrivi il carico una volta e si copia su tutte le serie; si salva da solo a ogni modifica); le serie le decide il coach (volume che cresce, scarico, tapering). La volta dopo l'app ti dice se salire di peso (doppia progressione: quando chiudi tutte le serie al massimo delle ripetizioni sali di peso, altrimenti resti e punti a più ripetizioni). La scheda si modifica dall'app.
- **Corse**: per registrare una corsa fuori piano e vedere il registro.
- **Profilo**: dati di onboarding, zone FC, **test soglia** (ricalcola zone e ritmi), **mezza di prova** (valuta il target), backup, data simulata.

Per provare l'app in un'altra settimana: Profilo → Strumenti → Simula la data.

## Garmin (consigliato)

Import diretto dal Personal API di Garmin Connect: sola lettura, uso personale, nessun account in più. Importa km, tempo, FC media e dislivello; sensazioni e dolore li aggiungi tu.

Configurazione (una volta sola):
1. Dal **sito** di Garmin Connect (non l'app): Impostazioni → Personal API → crea la chiave. Si vede una volta sola e scade (30, 90, 180 giorni o 1 anno a tua scelta; Garmin scrive una settimana prima).
2. Su Vercel, nel progetto: Settings → Environment Variables. Aggiungi `GARMIN_API_KEY` (la chiave) e `GARMIN_APP_PIN` (un PIN o una frase tua, **almeno 8 caratteri**).
3. Redeploy (Deployments → Redeploy).
4. In Profilo → Garmin scrivi il PIN (una volta per telefono). Poi **Importa da Garmin** nella seduta del giorno, oppure **Importa le corse degli ultimi 30 giorni** dal Profilo.

Sicurezza: l'indirizzo del sito è pubblico e la chiave dà accesso ai tuoi dati, quindi le route Garmin si aprono solo col PIN (cookie `httpOnly` firmato, 90 giorni). Chi non ha il PIN non legge nulla. Cambiare `GARMIN_APP_PIN` (o la chiave) invalida tutte le sessioni già aperte; «Blocca» nel Profilo toglie l'accesso solo su quel telefono. La chiave non lascia mai il server. Quando la chiave scade l'app lo dice: ne crei una nuova e aggiorni `GARMIN_API_KEY`.

Nota: Garmin non pubblica in modo leggibile i nomi dei campi delle attività. L'app usa quelli di Garmin Connect; se al primo import non riconosce nulla, mostra i campi che ha ricevuto (solo i nomi) così si correggono.

## Strava (alternativa)

Se preferisci passare da Strava (il Garmin sincronizza lì le corse), l'app le importa da lì (km, tempo, FC media, dislivello), le sensazioni e il dolore li aggiungi tu. L'app legge soltanto: non scrive nulla su Strava.

Configurazione (una volta sola):
1. Su strava.com/settings/api crea un'app. Come «Authorization Callback Domain» metti il dominio del sito (es. `coach-beta.vercel.app`, senza `https://`).
2. Su Vercel, nel progetto: Settings → Environment Variables (il modello dei nomi è in `.env.example`; per provare sul computer lo copi in `.env.local`, che non va mai su GitHub). Aggiungi `STRAVA_CLIENT_ID` e `STRAVA_CLIENT_SECRET` con i valori di Strava (Production). La chiave segreta resta sul server, mai sul telefono.
3. Redeploy (Deployments → Redeploy).
4. In Profilo → Strava e Garmin: **Collega Strava**. Poi **Importa da Strava** nella seduta del giorno, oppure **Importa le corse degli ultimi 30 giorni** dal Profilo.

I token di accesso stanno in un cookie `httpOnly` cifrato (AES-256-GCM) nel tuo browser; sul server non si salva nulla. Le corse già importate non si duplicano e i giorni con una corsa scritta a mano non vengono toccati. Per scollegare: Profilo → Scollega Strava (revoca anche l'accesso su Strava).

## Dati

Salvati sul dispositivo (localStorage). Esporta un backup da Profilo → Backup. Il salvataggio su Supabase è in `PLAN.md` (F3).

## Sviluppo

`npm run check` = lint + typecheck + test + build. La logica sta in `src/domain/` (pura, testata); il piano base `plan.seed.ts` è immutabile e le modifiche del coach sono override derivati dai dati registrati.
