import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Lato server dell'integrazione col Personal API di Garmin Connect (sola lettura, uso personale).
 * La chiave sta solo nelle variabili d'ambiente su Vercel. Poiché la chiave dà accesso ai TUOI dati
 * e l'indirizzo del sito è pubblico, le route si aprono solo dopo aver scritto un PIN (variabile
 * GARMIN_APP_PIN) che mette un cookie httpOnly firmato: senza, nessuno può leggere le tue corse.
 */

export const GARMIN_COOKIE = "coach_garmin";
export const MIN_PIN_LENGTH = 8;
const SESSION_SECONDS = 90 * 24 * 3600;

export interface GarminEnv {
  apiKey: string;
  pin: string;
  /** Solo per i test (server finto). */
  baseUrl: string;
}

export type GarminConfigIssue = "missing_key" | "missing_pin" | "short_pin";

type FetchFn = typeof fetch;

export class GarminAuthError extends Error {}
export class GarminError extends Error {}

/** Cosa manca alla configurazione (undefined se è tutto a posto). */
export function configIssue(env: Record<string, string | undefined> = process.env): GarminConfigIssue | undefined {
  if (!env.GARMIN_API_KEY?.trim()) return "missing_key";
  const pin = env.GARMIN_APP_PIN?.trim();
  if (!pin) return "missing_pin";
  if (pin.length < MIN_PIN_LENGTH) return "short_pin";
  return undefined;
}

export function readEnv(env: Record<string, string | undefined> = process.env): GarminEnv | undefined {
  if (configIssue(env)) return undefined;
  return {
    apiKey: env.GARMIN_API_KEY!.trim(),
    pin: env.GARMIN_APP_PIN!.trim(),
    baseUrl: (env.GARMIN_BASE_URL?.trim() || "https://personal.connectapi.garmin.com").replace(/\/$/, ""),
  };
}

/* ---------------------------------------------------------------- blocco con PIN */

const sessionKey = (env: GarminEnv) => createHash("sha256").update(`coach-garmin:${env.apiKey}:${env.pin}`).digest();
const digest = (s: string) => createHash("sha256").update(s).digest();

/** Confronto a tempo costante del PIN scritto con quello configurato. */
export function pinMatches(env: GarminEnv, given: unknown): boolean {
  return typeof given === "string" && timingSafeEqual(digest(given), digest(env.pin));
}

/** Valore del cookie di sessione: scadenza + firma HMAC. Non contiene né la chiave né il PIN. */
export function signSession(env: GarminEnv, nowSec: number): string {
  const exp = String(nowSec + SESSION_SECONDS);
  return `${exp}.${createHmac("sha256", sessionKey(env)).update(exp).digest("base64url")}`;
}

export function verifySession(env: GarminEnv, value: string | undefined, nowSec: number): boolean {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) <= nowSec) return false;
  const expected = createHmac("sha256", sessionKey(env)).update(exp).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const SESSION_MAX_AGE = SESSION_SECONDS;

/* ---------------------------------------------------------------- token */

export interface TokenCache {
  token?: string;
  /** Secondi dal 1970. */
  expiresAt?: number;
}

/** La scadenza (claim `exp`) di un JWT, senza verificarne la firma (serve solo per la cache). */
export function jwtExpiry(token: string): number | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Token d'accesso dalla chiave personale (POST, header `Authorization: ApiKey …`, risposta = il token in chiaro).
 * Vale 24 ore e non c'è refresh: se ne chiede uno nuovo. Si riusa finché restano più di 5 minuti.
 */
export async function getToken(env: GarminEnv, nowSec: number, cache: TokenCache = {}, fetchFn: FetchFn = fetch): Promise<string> {
  if (cache.token && cache.expiresAt && cache.expiresAt - nowSec > 300) return cache.token;
  const res = await fetchFn(`${env.baseUrl}/personalapitoken-service/personal-api/personal-api-key/token`, {
    method: "POST",
    headers: { authorization: `ApiKey ${env.apiKey}`, accept: "*/*" },
  });
  if (res.status === 401 || res.status === 403) throw new GarminAuthError("chiave non valida, scaduta o revocata");
  if (!res.ok) throw new GarminError(`token ${res.status}`);
  const token = (await res.text()).trim();
  if (!token) throw new GarminError("token vuoto");
  cache.token = token;
  cache.expiresAt = jwtExpiry(token) ?? nowSec + 3600;
  return token;
}

/* ---------------------------------------------------------------- attività */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Le attività nell'intervallo di date (YYYY-MM-DD), così come le dà Garmin (il mapping è nel dominio). */
export async function listActivities(
  env: GarminEnv,
  token: string,
  range: { startDate: string; endDate: string },
  fetchFn: FetchFn = fetch,
  limit = 50,
): Promise<unknown[]> {
  if (!DATE.test(range.startDate) || !DATE.test(range.endDate)) throw new GarminError("date non valide");
  const q = new URLSearchParams({ start: "0", limit: String(limit), startDate: range.startDate, endDate: range.endDate });
  const res = await fetchFn(`${env.baseUrl}/activitylist-service/activities/search/activities?${q.toString()}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (res.status === 401) throw new GarminAuthError("token non valido");
  if (!res.ok) throw new GarminError(`attività ${res.status}`);
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new GarminError("risposta Garmin non valida");
  return json;
}
