# HANDOFF – Coach personale Maratona di Roma 2027

Questo file raccoglie tutto il contesto per costruire una web app personale che faccia da coach per la preparazione alla Maratona di Roma 2027. Va letto per intero prima di scrivere codice.

Piano originale (documento, fonte di verità al 22/11/2026): https://claude.ai/artifact/TbvwLqLxoz2bSjkhBH5aiJ

---

## 1. Cosa deve fare l'app

Uso: **ogni domenica sera** Jacopo apre l'app e vede:
1. **La settimana che arriva**: le 3 corse (con descrizione, ritmi e durata), le 2 sedute di palestra e i giorni di riposo.
2. **Gli "elementi da fare" della settimana**: cose da procurarsi o sistemare piano piano (es. prenotare la visita medica, comprare i gel, iscriversi alla gara, scaricare l'app Runcard), sotto forma di checklist.
3. **Il riepilogo della settimana appena finita**: corse fatte rispetto a quelle pianificate, km, sensazioni e dolori.

Durante la settimana registra le corse (data, tipo, km, tempo, passo, FC media, D+, sensazioni/dolori 0–10) e spunta gli elementi da fare.

Comportamento "da coach" (regole in §6): l'app adatta o segnala in base ai log. Per esempio: dolore alla tibia → la qualità diventa easy; settimana saltata → non recuperarla.

### MVP consigliato
- Piano delle 16 settimane salvato come dati (JSON/seed), con vista della settimana corrente calcolata dalla data di oggi
- Vista "Domenica sera": prossima settimana + checklist + riepilogo
- Log delle corse con form rapido da telefono (mobile-first, installabile come PWA)
- Countdown alla gara e barra di avanzamento delle fasi
- Persistenza semplice: localStorage o SQLite/Supabase se serve la sincronizzazione tra dispositivi

### Fase 2 (opzionale)
- Import dei dati Garmin: export .fit/.csv da Garmin Connect, oppure connettore/API
- Feedback generato via Claude API sui log della settimana ("coach chat")
- Ricalcolo dei ritmi dopo il test di soglia (§5)
- Grafici: km settimanali pianificati vs fatti, andamento di FC e passo sugli easy

Profilo dev: Jacopo conosce Python, SQL, Tableau e Power BI e lavora con Claude Code. Stack libero: va bene qualcosa di semplice (Vite + React + PWA, oppure Next.js).

---

## 2. Atleta

- **Nome:** Jacopo, vive a Roma
- **Fisico:** 1,91–1,92 m, ~80 kg (ott 2026), molto magro
- **Orologio:** Garmin Forerunner 165
- **Storico:** aveva smesso di correre per **shin splints** (tibie). A novembre 2026 ha i **polpacci molto affaticati**
- **Punto di partenza:**
  - Mezza maratona a **5:50/km (~2h03)** il 16/11/2026, senza preparazione, gel né acqua
  - FC molto alta fin dai primi km anche con sforzo percepito basso (probabilmente zone Garmin di default)
  - Easy run in Z2 a ~8:00/km con +200 m D+
  - Easy di 8 km in Z2 il 19/11
- **Preferenze:** tanta Z2; **gli piacciono le ripetute in salita**; gli piace il trail
- **Palestra:** 2 sedute full body a settimana, gestite da lui (in passato powerbuilding; vuole forza, postura, gambe/glutei, spalle/schiena)
- **Stile di comunicazione:** italiano, diretto, informale

---

## 3. Obiettivo e gare

| Evento | Data | Note |
|---|---|---|
| Trail 24–25 km, +400 m D+ | dom 29/11/2026 | Da fare easy/Z2, salite camminate, prova integrazione (gel ogni 40–45') |
| Test soglia 30' | gio 03/12/2026 | Vedi §5 |
| Mezza di prova | dom 14/02/2027 | Checkpoint: **≤1:54** = sub 4 realistico |
| **Run Rome The Marathon** | **dom 14/03/2027, ore 8:30** | Obiettivo **sub 4h → 5:41/km** (RM nel piano = 5:40/km) |

Lettura onesta: dalla mezza la previsione "a freddo" è 4h15–4h20. Il sub 4 è realistico con 16 settimane fatte bene.

---

## 4. Piano

### Settimana tipo
- **Lun** – palestra full body A (gambe: squat leggero)
- **Mar** – corsa di qualità (salite o soglia)
- **Mer** – palestra full body B (gambe: stacco a gambe tese + bulgari)
- **Gio** – corsa easy
- **Ven** – riposo (dalla sett. 5 può comparire una easy facoltativa di 35')
- **Sab** – riposo
- **Dom** – lungo

### Legenda ritmi
- **easy** = riesci a parlare (talk test). Fino al test di soglia si va a sensazione, non a FC
- **soglia** = "comodamente duro", circa il ritmo dei 10 km
- **RM** = ritmo maratona, 5:40/km
- **salite** = forti ma controllate, pendenza 5–8%, recupero scendendo piano o camminando
- Ogni qualità comincia con 15' easy di riscaldamento e finisce con 10' di defaticamento

### Fasi
| Fase | Date | Focus | Lungo |
|---|---|---|---|
| 0 – Avvicinamento | 23–29 nov | Scarico + trail easy | Trail 25 km |
| 1 – Base | 30 nov – 27 dic | Z2, tibie/polpacci, salite corte | 14 → 18 km |
| 2 – Sviluppo | 28 dic – 7 feb | Soglia + RM nel lungo, salite 60–90" | 18 → 26 km |
| 3 – Specifica | 8 – 28 feb | Blocchi a RM, salite 2' a settimane alterne | 28 – 32 km |
| 4 – Scarico | 1 – 14 mar | Volume giù, intensità mantenuta | 20 km → GARA |

### Programma corse (settimana per settimana)
| Sett. | Date | Mar (qualità) | Gio (easy) | Dom (lungo) |
|---|---|---|---|---|
| 0 | 23–29 nov | 45' easy | 30' easy | Trail 25 km easy, salite camminate |
| 1 | 30 nov – 6 dic | 40' easy (recupero trail) | Test soglia 30' | 14 km easy |
| 2 | 7–13 dic | Salite 6×30" | 45' easy | 16 km easy |
| 3 | 14–20 dic | Salite 8×30" | 45' + 6 allunghi | 18 km easy |
| 4 | 21–27 dic | Scarico: 40' + 4 allunghi | 35' easy | 14 km easy |
| 5 | 28 dic – 3 gen | Salite 6×60" | 50' easy | 18 km easy |
| 6 | 4–10 gen | Soglia 3×8' (rec. 2') | 50' easy | 20 km, ultimi 4 a RM |
| 7 | 11–17 gen | Salite 8×60" | 50' easy | 22 km easy |
| 8 | 18–24 gen | Soglia 3×10' (rec. 2') | 55' easy | 24 km con 8 a RM |
| 9 | 25–31 gen | Scarico: salite 6×60" | 40' easy | 16 km easy |
| 10 | 1–7 feb | Soglia 2×15' (rec. 3') | 55' easy | 26 km easy |
| 11 | 8–14 feb | Salite 6×90" | 45' easy | Mezza test (≤1:54) |
| 12 | 15–21 feb | 50' easy | 10 km con 6 a RM | 28 km easy |
| 13 | 22–28 feb | Salite 6×2' | 60' con 8 km a RM | 32 km, ultimi 12 a RM |
| 14 | 1–7 mar | 3×3 km a RM (rec. 3') | 45' easy | 20 km con 10 a RM |
| 15 | 8–14 mar | 40' con 3 km a RM | 25' + 4 allunghi | MARATONA |

### Scheda palestra (decisa il 23/11/2026: due full body, gambe spezzate)
**A – lunedì:** squat 3×5–6 (2 ripetizioni di riserva) · chin-up zavorrati 5×5–8 · panca piana 3×6–8 · alzate laterali 3×12–15 · calf raise in piedi (gamba tesa, discesa lenta) 3×12–15 · tibialis raise 3×15–20

**B – mercoledì:** military press 4×5–8 · stacco a gambe tese 3×6–8 · affondi bulgari 3×8–10 per gamba · tirata orizzontale 3×8–10 · alzate laterali 3×12–15 · calf raise a ginocchio piegato (soleo) 3×12–15 · tibialis raise 3×15–20

Perché così: niente leg day unico (giorni a pezzi); lo squat leggero il lunedì (il martedì c'è la qualità), stacchi e bulgari il mercoledì (dopo la qualità, giovedì solo easy, lungo 4 giorni dopo). Progressione: doppia progressione, si sale di peso solo quando tutte le serie arrivano al massimo delle ripetizioni.

Aggiustamenti: settimane di scarico (4 e 9) una serie in meno per esercizio; settimane 14–15 gambe dimezzate; qualità dura il martedì (sett. 10 e 13) squat a 2 serie.

Prevenzione tibie/polpacci: calf raise a gamba tesa e a ginocchio piegato, tibialis raise, glutei e anche con stacchi e bulgari. Niente salti o pliometria finché le tibie non reggono. Dolore puntiforme sull'osso: stop e professionista.

---

## 5. Test e zone
- **Test soglia 30'** (gio 3/12): a riposo da 48h, in piano. 15' di riscaldamento, poi 30' al massimo sostenibile in modo costante. **FC media degli ultimi 20' ≈ LTHR** → si ricalcolano le zone sul Garmin (basate su LTHR invece che sulla formula standard). L'app dovrebbe permettere di inserire LTHR e mostrare le zone
- Se la FC da polso sembra assurda (picchi nei primi minuti) → valutare una fascia toracica

---

## 6. Regole del coach (logica dell'app)
1. Aumento massimo di km del **+10% a settimana**; settimana di scarico ogni 3–4 (già nel piano: sett. 4 e 9)
2. Martedì con **gambe pesanti o tibie doloranti** → la qualità diventa un easy
3. **Dolore puntiforme sull'osso della tibia** → stop alla corsa, si passa alla bici e si valuta (eventualmente un medico)
4. Una seduta saltata non si recupera ammassandola: si va avanti col piano
5. Dopo il test di soglia → ricalcolo dei ritmi di easy e soglia
6. Integrazione: dal trail in poi provare i gel nei lunghi oltre i 90' (1 ogni 40–45')
7. Checkpoint mezza 14/02: se è oltre 1:54, rivedere il target (es. 4:05–4:10) invece di forzare

---

## 7. Burocrazia ed elementi da fare (seed per la checklist)
- [ ] **Visita medica agonistica** con la dicitura "idoneità sportiva agonistica alla pratica dell'ATLETICA LEGGERA" (diciture tipo "corsa" o "maratona" non valgono). Prenotarla subito, prima del 29/11 se serve per il trail
- [ ] **Runcard FIDAL** (runcard.com o app): vale 365 giorni dall'emissione → copre trail e maratona con un solo pagamento. È meglio della tessera di una società, che scade il 31/12 e andrebbe rinnovata per il 2027. Costo indicativo ~€30 (verificare)
- [ ] **Iscrizione alla maratona** su runromethemarathon.com: farla presto, le quote salgono e l'edizione 2026 è andata sold out a inizio dicembre
- [ ] **Caricare il certificato su ENDU entro il 4/03/2027**
- [ ] **Regolamento del trail del 29/11**: verificare quale tessera serve e se accetta la Runcard
- [ ] Gel/barrette per il trail e i lunghi
- [ ] Controllare scarpe e km percorsi (eventuale paio nuovo da rodare entro febbraio)
- [ ] Valutare una fascia cardio toracica
- [ ] (opz.) Collegare i dati Garmin

---

## 8. Dati ancora da raccogliere (chiederli in onboarding)
- Età, FC a riposo, FC massima più alta vista
- Km a settimana nelle ultime 4 settimane
- Dolore alle tibie oggi (0–10), puntiforme o diffuso
- Scarpe usate e km
- Giorni fissi (default: corsa Mar/Gio/Dom, palestra Lun/Mer)

---

## 9. Diario corse (dati iniziali)
| Data | Tipo | Km | Passo | D+ | Note |
|---|---|---|---|---|---|
| 16/11/2026 | Mezza maratona | 21,1 | 5:50 | – | Senza integrazione né acqua |
| 19/11/2026 | Easy Z2 | ~8 | ~8:00 | ~200 m | FC alta, ritmo molto basso per tenerla giù |
| 22/11/2026 | Easy 50–60' (pianificato) | 8–10 | – | piano | Niente salite, polpacci da tenere freschi per il trail |
