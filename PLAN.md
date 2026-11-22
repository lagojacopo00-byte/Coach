# PLAN — task del loop

Piano completo: vedi `docs/HANDOFF.md`. Un task per iterazione; spunta quando `npm run check` è verde.

## F0 Scaffold
- [x] Next.js + Tailwind + TypeScript, Vitest, lint, CI, CLAUDE.md, PLAN.md, HANDOFF

## F1 Dominio (`src/domain/`)
- [x] Tipi: Session, Week, Phase, Run, Profile
- [x] `plan.seed.ts`: 16 settimane + settimana 0 (§4), con test di coerenza (date, fasi, sett. 15 = maratona)
- [x] `week.ts`: settimana corrente da una data, fase, countdown alla gara
- [ ] `zones.ts`: zone FC da LTHR e ritmi easy/soglia (§5)
- [ ] `summary.ts`: pianificato vs fatto, km settimanali, variazione % settimanale

## F2 Regole coach (`src/domain/rules.ts`)
- [ ] R1 tetto +10% settimanale (scarichi sett. 4 e 9 esclusi)
- [ ] R2 martedì con gambe pesanti/tibie doloranti → easy
- [ ] R3 dolore puntiforme sull'osso → stop corsa, bici, avviso medico
- [ ] R4 seduta saltata: nessun recupero
- [ ] R5 ricalcolo ritmi dopo test soglia
- [ ] R6 promemoria gel nei lunghi > 90'
- [ ] R7 mezza 14/02 oltre 1:54 → proposta di rivedere il target

## F3 Supabase (supervisionato)
- [ ] Migrazioni, RLS utente singolo, auth magic link, repository in `src/data/`

## F4 UI (mobile-first)
- [ ] Vista Domenica sera: prossima settimana + checklist + riepilogo
- [ ] Form rapido log corsa
- [ ] Piano 16 settimane, barra fasi, countdown
- [ ] Checklist elementi da fare (seed §7)
- [ ] Onboarding (§8) e inserimento LTHR

## F5 PWA
- [ ] Manifest, icone, service worker, prova "Aggiungi a Home" su iPhone

## F6 Fase 2 (opzionale)
- [ ] Import Garmin .fit/.csv, grafici, coach chat Claude API

## Blocchi
(nessuno)
