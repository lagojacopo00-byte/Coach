import type { IsoDate } from "./types";

/** Elementi da fare (HANDOFF §7). Seed della checklist; lo stato spuntato sta nello stato dell'app. */
export interface ChecklistItem {
  id: string;
  title: string;
  detail: string;
  /** Scadenza indicativa; l'app la evidenzia se si avvicina. */
  due?: IsoDate;
  /** Indice settimana del piano in cui metterla in evidenza (0–15). */
  weekIndex?: number;
  optional?: boolean;
}

export const CHECKLIST_SEED: readonly ChecklistItem[] = [
  {
    id: "visita-medica",
    title: "Visita medica agonistica",
    detail:
      "Deve riportare la dicitura «idoneità sportiva agonistica alla pratica dell'ATLETICA LEGGERA». Diciture come «corsa» o «maratona» non valgono. Prenotala subito, prima del 29/11 se serve per il trail.",
    due: "2026-11-29",
    weekIndex: 0,
  },
  {
    id: "runcard",
    title: "Runcard FIDAL",
    detail:
      "runcard.com o app. Vale 365 giorni dall'emissione: copre trail e maratona con un solo pagamento, meglio della tessera di una società che scade il 31/12. Costo indicativo ~€30 (verificare).",
    due: "2026-11-29",
    weekIndex: 0,
  },
  {
    id: "gel-trail",
    title: "Gel/barrette per il trail e i lunghi",
    detail: "Un gel ogni 40–45' nei lunghi oltre 90'. Provali al trail: mai novità il giorno della gara.",
    due: "2026-11-28",
    weekIndex: 0,
  },
  {
    id: "iscrizione-maratona",
    title: "Iscrizione alla maratona",
    detail:
      "Su runromethemarathon.com. Falla presto: le quote salgono e l'edizione 2026 è andata sold out a inizio dicembre.",
    due: "2026-12-01",
    weekIndex: 1,
  },
  {
    id: "scarpe",
    title: "Controllare scarpe e km percorsi",
    detail: "Eventuale paio nuovo da rodare entro febbraio.",
    due: "2027-01-31",
    weekIndex: 2,
  },
  {
    id: "fascia-cardio",
    title: "Valutare una fascia cardio toracica",
    detail: "Se la FC da polso sembra assurda (picchi nei primi minuti), la fascia è più affidabile. Meglio averla prima del test soglia del 3/12.",
    due: "2026-12-03",
    weekIndex: 1,
  },
  {
    id: "endu-certificato",
    title: "Caricare il certificato su ENDU",
    detail: "Entro il 4/03/2027.",
    due: "2027-03-04",
    weekIndex: 14,
  },
  {
    id: "garmin",
    title: "Collegare i dati Garmin",
    detail: "Opzionale: per ora i dati si inseriscono a mano (import .fit/.csv in fase 2).",
    optional: true,
  },
];

/** Elementi non completati con scadenza entro `days` giorni (o già scaduti) alla data. */
export function dueSoon(
  items: readonly ChecklistItem[],
  done: readonly string[],
  today: IsoDate,
  days: number,
  diff: (from: IsoDate, to: IsoDate) => number,
): ChecklistItem[] {
  return items.filter((i) => !done.includes(i.id) && i.due !== undefined && diff(today, i.due) <= days);
}
