import { easyPaceRange, formatPace, hrZones, thresholdPaceRange } from "./zones";
import type { Profile, Session } from "./types";

/** Ritmo maratona del piano (HANDOFF §4: RM = 5:40/km; il target gara è 5:41). */
export const RM_PACE_SEC = 340;

const range = (r: { fast: number; slow: number }) => `${formatPace(r.fast)}–${formatPace(r.slow)}/km`;

/** Indicazioni di ritmo/FC per una seduta, dal profilo (zone e ritmi si aggiornano dopo il test di soglia). */
export function paceHint(session: Session, profile: Profile): string | undefined {
  const t = profile.thresholdPaceSecPerKm;
  const z = profile.lthr ? hrZones(profile.lthr) : undefined;
  const z2 = z ? `${z[1].min}–${z[1].max} bpm` : undefined;
  const z4 = z ? `${z[3].min}–${z[3].max} bpm` : undefined;
  switch (session.kind) {
    case "easy":
    case "long":
    case "trail":
      return t
        ? `Easy ${range(easyPaceRange(t))}${z2 ? ` · FC Z2 ${z2}` : ""}. Se non riesci a parlare, rallenta.`
        : "A sensazione (talk test), non a FC: fino al test di soglia le zone Garmin di default non valgono.";
    case "hills":
      return "Forti ma controllate, pendenza 5–8%. Recupero scendendo piano o camminando.";
    case "threshold":
      return t
        ? `Soglia ~${range(thresholdPaceRange(t))}${z4 ? ` · FC Z4 ${z4}` : ""}. «Comodamente duro».`
        : "«Comodamente duro», circa il ritmo dei 10 km.";
    case "long_rm":
    case "rm_blocks":
    case "race":
      return `Tratti a RM ${formatPace(RM_PACE_SEC)}/km; il resto easy${t ? ` (${range(easyPaceRange(t))})` : ""}.`;
    case "half_test":
      return "Obiettivo ≤1:54:00 (5:24/km). Parti controllato, gel e acqua come in gara.";
    case "threshold_test":
      return "15' di riscaldamento, poi 30' al massimo sostenibile costante. La FC media degli ultimi 20' è la tua LTHR.";
    case "bike":
      return "Bici Z2, sforzo facile e conversazionale.";
    default:
      return undefined;
  }
}

export const KIND_LABEL: Record<string, string> = {
  easy: "Easy",
  hills: "Salite",
  threshold: "Soglia",
  long: "Lungo",
  long_rm: "Lungo con RM",
  rm_blocks: "Blocchi a RM",
  threshold_test: "Test soglia",
  trail: "Trail",
  half_test: "Mezza di prova",
  race: "MARATONA",
  gym: "Palestra",
  bike: "Bici Z2",
  rest: "Riposo",
};

export const WEEKDAY_LABEL: Record<string, string> = {
  lun: "Lunedì",
  mar: "Martedì",
  mer: "Mercoledì",
  gio: "Giovedì",
  ven: "Venerdì",
  sab: "Sabato",
  dom: "Domenica",
};

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** "2026-11-23" → "23 nov". */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

/** "mm:ss" o "h:mm:ss" → secondi; undefined se non valido. */
export function parseDuration(text: string): number | undefined {
  const parts = text.trim().split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p))) return undefined;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n > 59)) return undefined;
  const sec = nums.length === 3 ? nums[0] * 3600 + nums[1] * 60 + nums[2] : nums[0] * 60 + nums[1];
  return sec > 0 ? sec : undefined;
}

export function formatDuration(totalSec: number): string {
  const t = Math.round(totalSec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
