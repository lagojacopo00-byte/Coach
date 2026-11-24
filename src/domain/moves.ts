import { WEEKDAYS, type IsoDate, type Run, type Session, type Skip, type Week, type Weekday } from "./types";
import { WEEKDAY_LABEL } from "./guidance";
import type { GymLog } from "./gym";
import { dateOfWeekday } from "./week";

/**
 * Spostare un giorno = scambiare due giorni della stessa settimana (la palestra va a venerdì, il venerdì
 * di riposo passa a mercoledì). Il piano base non si tocca: lo scambio è un override salvato.
 */
export interface DaySwap {
  weekIndex: number;
  a: Weekday;
  b: Weekday;
}

const order = (d: Weekday) => WEEKDAYS.indexOf(d);

/** Applica gli scambi alla settimana. Un giorno senza seduta (es. settimana della gara) riceve/lascia un riposo. */
export function applySwaps(week: Week, swaps: readonly DaySwap[]): Week {
  let sessions: Session[] = week.sessions.map((s) => ({ ...s }));
  for (const sw of swaps) {
    if (sw.weekIndex !== week.index || sw.a === sw.b) continue;
    const at = (d: Weekday) => sessions.find((s) => s.weekday === d);
    const sa = at(sw.a);
    const sb = at(sw.b);
    const rest = (d: Weekday): Session => ({ weekday: d, kind: "rest", description: "Riposo" });
    const moved: Session[] = [
      { ...(sa ?? rest(sw.a)), weekday: sw.b, from: (sa ?? rest(sw.a)).from ?? sw.a },
      { ...(sb ?? rest(sw.b)), weekday: sw.a, from: (sb ?? rest(sw.b)).from ?? sw.b },
    ];
    sessions = [...sessions.filter((s) => s.weekday !== sw.a && s.weekday !== sw.b), ...moved];
  }
  // I riposi sintetici "tornati a casa" non servono: se un giorno non c'era nel piano e ora è di nuovo vuoto, resta fuori.
  sessions = sessions.filter((s) => !(s.kind === "rest" && s.from !== undefined && s.description === "Riposo" && !week.sessions.some((w) => w.weekday === s.weekday)));
  // Tornato al suo posto: nessun segno di spostamento.
  sessions = sessions.map((s) => {
    if (s.from !== undefined && s.from === s.weekday) {
      const { from: _unused, ...rest } = s;
      void _unused;
      return rest;
    }
    return s;
  });
  sessions.sort((x, y) => order(x.weekday) - order(y.weekday));
  return { ...week, sessions };
}

export interface SwapContext {
  /** Settimana già con gli spostamenti precedenti applicati. */
  week: Week;
  today: IsoDate;
  runs: readonly Run[];
  gymLogs: readonly GymLog[];
  skips: readonly Skip[];
}

const done = (c: SwapContext, date: IsoDate) => c.runs.some((r) => r.date === date) || c.gymLogs.some((l) => l.date === date);

/** Perché NON si può scambiare `a` con `b` (undefined = si può). */
export function whyNotSwap(c: SwapContext, a: Weekday, b: Weekday): string | undefined {
  if (a === b) return "Scegli due giorni diversi.";
  const dateA = dateOfWeekday(c.week, a);
  const dateB = dateOfWeekday(c.week, b);
  const sa = c.week.sessions.find((s) => s.weekday === a);
  const sb = c.week.sessions.find((s) => s.weekday === b);
  if ((!sa || sa.kind === "rest") && (!sb || sb.kind === "rest")) return "Due giorni di riposo: non c'è niente da spostare.";
  for (const [d, wd] of [[dateA, a], [dateB, b]] as const) {
    if (d < c.today) return `${WEEKDAY_LABEL[wd]} è già passato: si spostano solo oggi e i giorni futuri.`;
    if (done(c, d)) return `${WEEKDAY_LABEL[wd]} è già fatto: non si sposta.`;
    if (c.skips.some((k) => k.date === d)) return `${WEEKDAY_LABEL[wd]} è segnato come non fatto: non si sposta.`;
  }
  return undefined;
}

/** Con quali giorni si può scambiare `a`. */
export function swapTargets(c: SwapContext, a: Weekday): Weekday[] {
  return WEEKDAYS.filter((b) => b !== a && whyNotSwap(c, a, b) === undefined);
}
