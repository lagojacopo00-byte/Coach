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

- **Oggi**: countdown, fase, seduta del giorno, check-in "come stanno le gambe?".
- **Domenica**: settimana che arriva, elementi da fare, riepilogo della settimana finita.
- **Corsa**: registra una corsa in pochi secondi.
- **Piano**: 16 settimane con le modifiche del coach (sempre con il motivo).
- **Profilo**: dati di onboarding, zone FC, **test soglia** (ricalcola zone e ritmi), **mezza di prova** (valuta il target), backup, data simulata.

Per provare l'app in un'altra settimana: Profilo → Strumenti → Simula la data.

## Dati

Salvati sul dispositivo (localStorage). Esporta un backup da Profilo → Backup. Il salvataggio su Supabase è in `PLAN.md` (F3).

## Sviluppo

`npm run check` = lint + typecheck + test + build. La logica sta in `src/domain/` (pura, testata); il piano base `plan.seed.ts` è immutabile e le modifiche del coach sono override derivati dai dati registrati.
