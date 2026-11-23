import { RACE_DATE } from "./plan.seed";
import type { CheckIn, Profile } from "./types";

/** Profilo iniziale (HANDOFF §2/§4): target sub 4h = 5:41/km, corse mar/gio/dom, palestra lun/mer. */
export function defaultProfile(): Profile {
  return {
    name: "Jacopo",
    targetPaceSecPerKm: 341,
    raceDate: RACE_DATE,
    runDays: ["mar", "gio", "dom"],
    gymDays: ["lun", "mer"],
  };
}

/** Dati di onboarding (HANDOFF §8). Tutti opzionali: si possono completare dopo. */
export interface OnboardingInput {
  age?: number;
  restingHr?: number;
  maxHr?: number;
  weeklyKmLast4?: number;
  tibiaPain?: number;
  tibiaPainType?: "diffuso" | "puntiforme";
  shoes?: string;
  shoesKm?: number;
}

export function validateOnboarding(i: OnboardingInput): string[] {
  const errors: string[] = [];
  const inRange = (v: number | undefined, lo: number, hi: number) => v === undefined || (v >= lo && v <= hi);
  if (!inRange(i.age, 14, 100)) errors.push("Età non plausibile.");
  if (!inRange(i.restingHr, 25, 120)) errors.push("FC a riposo non plausibile (25–120).");
  if (!inRange(i.maxHr, 120, 230)) errors.push("FC massima non plausibile (120–230).");
  if (i.restingHr !== undefined && i.maxHr !== undefined && i.restingHr >= i.maxHr)
    errors.push("La FC a riposo deve essere minore della FC massima.");
  if (!inRange(i.weeklyKmLast4, 0, 250)) errors.push("Km settimanali non plausibili.");
  if (!inRange(i.tibiaPain, 0, 10)) errors.push("Il dolore va da 0 a 10.");
  if (!inRange(i.shoesKm, 0, 3000)) errors.push("Km scarpe non plausibili.");
  return errors;
}

export function applyOnboarding(profile: Profile, i: OnboardingInput): Profile {
  return {
    ...profile,
    ...(i.age !== undefined ? { age: i.age } : {}),
    ...(i.restingHr !== undefined ? { restingHr: i.restingHr } : {}),
    ...(i.maxHr !== undefined ? { maxHr: i.maxHr } : {}),
  };
}

/** Il dolore alle tibie indicato in onboarding diventa un check-in del giorno (così R2/R3 lo vedono). */
export function onboardingCheckIn(i: OnboardingInput, date: string): CheckIn | undefined {
  if (i.tibiaPain === undefined || i.tibiaPain <= 0) return undefined;
  return { date, pain: i.tibiaPain, painLocation: "tibia", painType: i.tibiaPainType ?? "diffuso" };
}
