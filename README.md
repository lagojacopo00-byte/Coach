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

- **Oggi**: la settimana giorno per giorno, con una **V verde** su ciò che è fatto (corse e palestra). **Tieni premuto un giorno e trascinalo** su un altro per scambiarli (la palestra di mercoledì a venerdì, ad esempio): vale solo per oggi e i giorni futuri, mai per giorni già fatti, e compare subito in Settimane. «Annulla» o «torna al piano» ripristinano. Tocca un giorno per registrarlo (**Fatto** con km, tempo, FC, D+, sensazioni, dolore, tutto facoltativo; oppure **Non fatto** con motivo), per modificarlo o eliminarlo. Sotto: «Da fare a breve» e «Gambe pesanti o dolore?».
- **Settimane**: tutte le 16 settimane in una griglia (righe = settimane, colonne = lun–dom), colorate per tipo di seduta (leggenda sotto il calendario). In fondo l'andamento di carico e lungo.
- **Palestra**: la scheda (due full body con le gambe spezzate: A il lunedì, B il mercoledì). Registri pesi e ripetizioni per serie (il carico si copia su tutte le serie; si salva da solo a ogni modifica); le serie le decide il coach (volume che cresce, scarico, tapering).
- **Corse**: **Aggiungi corsa** (a mano o importando da Garmin/Strava), i **chilometri settimanali** con analisi, **tutte le corse** raggruppate per settimana e colorate per tipo (tocca una corsa per modificarla o eliminarla), e in fondo dati interessanti (corsa più lunga, settimana migliore, passo per tipo, FC negli easy…).
- **Profilo**: tutto in sezioni chiuse, si apre quella che serve: dati personali (una volta sola), easy facoltativa, Garmin, Strava, zone e ritmi, test soglia, mezza di prova, backup, strumenti.

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
