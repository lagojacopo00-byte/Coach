import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mapStravaActivity, type StravaActivity } from "../domain/strava";

/**
 * Lato server dell'integrazione Strava. La chiave segreta di Strava resta qui (variabili d'ambiente su Vercel):
 * mai nel browser. I token dell'utente stanno in un cookie httpOnly cifrato; sul server non si salva nulla.
 */

export const STRAVA_COOKIE = "coach_strava";
export const STRAVA_STATE_COOKIE = "coach_strava_state";
/** Lettura delle attività (anche private). Niente scrittura. */
export const STRAVA_SCOPE = "read,activity:read_all";

export interface StravaEnv {
  clientId: string;
  clientSecret: string;
  /** Solo per i test (server finto); in produzione è Strava. */
  baseUrl: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Secondi dal 1970. */
  expiresAt: number;
}

type FetchFn = typeof fetch;

export class StravaAuthError extends Error {}
export class StravaError extends Error {}

export function readEnv(env: Record<string, string | undefined> = process.env): StravaEnv | undefined {
  const clientId = env.STRAVA_CLIENT_ID?.trim();
  const clientSecret = env.STRAVA_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret, baseUrl: (env.STRAVA_BASE_URL?.trim() || "https://www.strava.com").replace(/\/$/, "") };
}

/* ---------------------------------------------------------------- cookie cifrato */

const b64 = (b: Buffer) => b.toString("base64url");
const key = (secret: string) => createHash("sha256").update(`coach-strava:${secret}`).digest();

/** Cifra i token (AES-256-GCM): il cookie non si legge né si modifica senza la chiave. */
export function seal(tokens: Tokens, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(tokens), "utf8"), cipher.final()]);
  return `${b64(iv)}.${b64(cipher.getAuthTag())}.${b64(ct)}`;
}

export function unseal(value: string, secret: string): Tokens | undefined {
  try {
    const [iv, tag, ct] = value.split(".");
    if (!iv || !tag || !ct) return undefined;
    const d = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    const json = JSON.parse(Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8")) as Partial<Tokens>;
    if (typeof json.accessToken !== "string" || typeof json.refreshToken !== "string" || typeof json.expiresAt !== "number") return undefined;
    return { accessToken: json.accessToken, refreshToken: json.refreshToken, expiresAt: json.expiresAt };
  } catch {
    return undefined;
  }
}

/** Confronto a tempo costante (per lo `state` anti-CSRF). */
export function sameValue(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/* ---------------------------------------------------------------- OAuth */

export function authorizeUrl(env: StravaEnv, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: STRAVA_SCOPE,
    state,
  });
  return `${env.baseUrl}/oauth/authorize?${q.toString()}`;
}

/** Strava rimanda l'elenco dei permessi concessi: servono quelli per leggere le attività. */
export function scopeAllowsActivities(scope: string | null): boolean {
  return (scope ?? "").split(",").some((s) => s === "activity:read" || s === "activity:read_all");
}

function parseTokens(json: unknown): Tokens {
  const j = json as Record<string, unknown> | null;
  if (!j || typeof j.access_token !== "string" || typeof j.refresh_token !== "string" || typeof j.expires_at !== "number")
    throw new StravaError("risposta Strava non valida");
  return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: j.expires_at };
}

async function tokenRequest(env: StravaEnv, params: Record<string, string>, fetchFn: FetchFn): Promise<Tokens> {
  const res = await fetchFn(`${env.baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ client_id: env.clientId, client_secret: env.clientSecret, ...params }).toString(),
  });
  if (res.status === 400 || res.status === 401) throw new StravaAuthError("autorizzazione rifiutata");
  if (!res.ok) throw new StravaError(`token ${res.status}`);
  return parseTokens(await res.json());
}

export const exchangeCode = (env: StravaEnv, code: string, fetchFn: FetchFn = fetch) =>
  tokenRequest(env, { code, grant_type: "authorization_code" }, fetchFn);

export const refreshTokens = (env: StravaEnv, tokens: Tokens, fetchFn: FetchFn = fetch) =>
  tokenRequest(env, { refresh_token: tokens.refreshToken, grant_type: "refresh_token" }, fetchFn);

/** Rinnova i token se scadono entro un minuto. */
export async function freshTokens(
  env: StravaEnv,
  tokens: Tokens,
  nowSec: number,
  fetchFn: FetchFn = fetch,
): Promise<{ tokens: Tokens; refreshed: boolean }> {
  if (tokens.expiresAt - nowSec > 60) return { tokens, refreshed: false };
  return { tokens: await refreshTokens(env, tokens, fetchFn), refreshed: true };
}

/* ---------------------------------------------------------------- attività */

/** Le tue corse dal timestamp `afterSec` in poi (Strava le dà dalla più recente). */
export async function listRunActivities(
  env: StravaEnv,
  accessToken: string,
  afterSec: number,
  fetchFn: FetchFn = fetch,
  perPage = 50,
): Promise<StravaActivity[]> {
  const res = await fetchFn(`${env.baseUrl}/api/v3/athlete/activities?after=${Math.floor(afterSec)}&per_page=${perPage}`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
  });
  if (res.status === 401) throw new StravaAuthError("token non valido");
  if (!res.ok) throw new StravaError(`attività ${res.status}`);
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new StravaError("risposta Strava non valida");
  return json.map(mapStravaActivity).filter((a): a is StravaActivity => a !== undefined);
}

/** Revoca l'accesso su Strava (se fallisce, il cookie si cancella comunque). */
export async function deauthorize(env: StravaEnv, accessToken: string, fetchFn: FetchFn = fetch): Promise<void> {
  try {
    await fetchFn(`${env.baseUrl}/oauth/deauthorize`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ access_token: accessToken }).toString(),
    });
  } catch {
    /* best effort */
  }
}
