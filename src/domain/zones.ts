/** Zone FC da LTHR e ritmi easy/soglia (HANDOFF §5). Logica pura. */

export interface HrZone {
  id: "Z1" | "Z2" | "Z3" | "Z4" | "Z5";
  name: string;
  /** bpm, estremi inclusi; max undefined = nessun limite superiore. */
  min: number;
  max?: number;
}

/** Percentuali di LTHR (schema Friel per la corsa), con Z5 = da soglia in su. */
const ZONE_DEFS: { id: HrZone["id"]; name: string; from: number; to?: number }[] = [
  { id: "Z1", name: "Recupero", from: 0, to: 0.85 },
  { id: "Z2", name: "Aerobica (easy)", from: 0.85, to: 0.89 },
  { id: "Z3", name: "Tempo / maratona", from: 0.9, to: 0.94 },
  { id: "Z4", name: "Soglia", from: 0.95, to: 0.99 },
  { id: "Z5", name: "VO2max", from: 1.0 },
];

/** FC di soglia dal test 30': media della FC degli ultimi 20'. */
export function lthrFromTest(last20MinAvgHr: number): number {
  return Math.round(last20MinAvgHr);
}

export function hrZones(lthr: number): HrZone[] {
  if (!(lthr > 0)) throw new RangeError("LTHR deve essere positivo");
  return ZONE_DEFS.map((z, i) => {
    const prev = ZONE_DEFS[i - 1];
    // Z1 parte da 0; le altre iniziano un bpm sopra il massimo della precedente.
    const min = z.from === 0 ? 0 : Math.round(lthr * prev.to!) + 1;
    const max = z.to === undefined ? undefined : Math.round(lthr * z.to);
    return { id: z.id, name: z.name, min, max };
  });
}

export interface PaceRange {
  /** sec/km, il più veloce. */
  fast: number;
  /** sec/km, il più lento. */
  slow: number;
}

/** Ritmo soglia dal test: passo medio degli ultimi 20' (sec/km). */
export function thresholdPaceFromTest(last20MinPaceSecPerKm: number): number {
  return Math.round(last20MinPaceSecPerKm);
}

/**
 * Easy = soglia + 60–90 s/km (regola empirica: il talk test resta il criterio
 * principale, i ritmi sono un'indicazione). Se l'FC sale oltre Z2 si rallenta.
 */
export function easyPaceRange(thresholdPaceSecPerKm: number): PaceRange {
  return { fast: thresholdPaceSecPerKm + 60, slow: thresholdPaceSecPerKm + 90 };
}

/** Salite/ripetute: più veloci della soglia, a sensazione (forti ma controllate). */
export function thresholdPaceRange(thresholdPaceSecPerKm: number): PaceRange {
  return { fast: thresholdPaceSecPerKm - 5, slow: thresholdPaceSecPerKm + 5 };
}

export function formatPace(secPerKm: number): string {
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parsePace(text: string): number | undefined {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(text.trim());
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}
