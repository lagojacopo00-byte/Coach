# Coach Maratona — istruzioni per Claude Code

Web app personale (PWA, iPhone) per preparare la Maratona di Roma del 14/03/2027 (obiettivo sub 4h, 5:41/km). Mostra il piano di 16 settimane, registra le corse e adatta il piano con regole deterministiche. Lingua dell'app e dei commit: italiano, diretto, informale.

Fonti di verità: `docs/HANDOFF.md` (piano, regole, checklist) e `PLAN.md` (task e loop).

@AGENTS.md

## Stack
Next.js (App Router) + TypeScript + Tailwind, Vitest per la logica, Supabase (da F3), PWA (F5).

## Architettura
- `src/domain/`: logica pura, senza I/O, testata. Il piano base (`plan.seed.ts`) è immutabile; le modifiche del coach sono override con motivo, mai riscritture del seed.
- `src/data/`: repository Supabase. `src/app/`: UI mobile-first.

## Comandi
- `npm run check` = lint + typecheck + test + build. Deve essere verde prima di ogni commit.

## Regole del loop
1. Una iterazione = un solo task, il primo non spuntato di `PLAN.md`.
2. Scrivi i test insieme al codice; mai saltare o disattivare un test per tornare verde.
3. Se `npm run check` è rosso: correggi, max 3 tentativi, poi annota il blocco in `PLAN.md` e fermati.
4. Niente nuove dipendenze senza motivo scritto nel commit.
5. Fermati e chiedi se il task è ambiguo o tocca regole mediche/dati sensibili.
6. Commit piccoli in italiano; spunta il task in `PLAN.md` nello stesso commit.
7. Il coach non è un medico: il dolore puntiforme sulla tibia rimanda sempre a un professionista.
8. Prima di scrivere codice Next leggi la guida pertinente in `node_modules/next/dist/docs/`.
