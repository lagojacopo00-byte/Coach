import { describe, expect, it } from "vitest";
import {
  configIssue,
  getToken,
  GarminAuthError,
  GarminError,
  jwtExpiry,
  listActivities,
  pinMatches,
  readEnv,
  signSession,
  verifySession,
  type GarminEnv,
  type TokenCache,
} from "./garmin";

const env: GarminEnv = { apiKey: "KEY-123", pin: "una-frase-lunga", baseUrl: "https://personal.connectapi.garmin.com" };
const jwt = (exp: number) => `h.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.s`;

type Call = { url: string; init?: RequestInit };
function fakeFetch(respond: (c: Call) => Response) {
  const calls: Call[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    const c = { url: String(url), init };
    calls.push(c);
    return respond(c);
  }) as typeof fetch;
  return { fn, calls };
}
const text = (body: string, status = 200) => new Response(body, { status });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("configurazione", () => {
  it("servono la chiave e un PIN di almeno 8 caratteri", () => {
    expect(configIssue({})).toBe("missing_key");
    expect(configIssue({ GARMIN_API_KEY: "k" })).toBe("missing_pin");
    expect(configIssue({ GARMIN_API_KEY: "k", GARMIN_APP_PIN: "corto" })).toBe("short_pin");
    expect(configIssue({ GARMIN_API_KEY: "k", GARMIN_APP_PIN: "abcdefgh" })).toBeUndefined();
    expect(configIssue({ GARMIN_API_KEY: "  ", GARMIN_APP_PIN: "abcdefgh" })).toBe("missing_key");
  });
  it("readEnv: undefined se non è tutto a posto; l'indirizzo cambia solo per i test", () => {
    expect(readEnv({ GARMIN_API_KEY: "k" })).toBeUndefined();
    expect(readEnv({ GARMIN_API_KEY: " k ", GARMIN_APP_PIN: " abcdefgh " })).toEqual({ apiKey: "k", pin: "abcdefgh", baseUrl: "https://personal.connectapi.garmin.com" });
    expect(readEnv({ GARMIN_API_KEY: "k", GARMIN_APP_PIN: "abcdefgh", GARMIN_BASE_URL: "http://localhost:3201/" })?.baseUrl).toBe("http://localhost:3201");
  });
});

describe("blocco con PIN", () => {
  it("il PIN giusto passa, quello sbagliato o non-testo no", () => {
    expect(pinMatches(env, "una-frase-lunga")).toBe(true);
    expect(pinMatches(env, "una-frase-lunghe")).toBe(false);
    expect(pinMatches(env, "")).toBe(false);
    expect(pinMatches(env, undefined)).toBe(false);
    expect(pinMatches(env, 12345678)).toBe(false);
  });
  it("la sessione firmata vale fino alla scadenza", () => {
    const s = signSession(env, 1_000);
    expect(verifySession(env, s, 1_001)).toBe(true);
    expect(verifySession(env, s, 1_000 + 90 * 24 * 3600 + 1)).toBe(false);
  });
  it("manomessa, vuota o firmata con un'altra chiave/PIN non vale", () => {
    const s = signSession(env, 1_000);
    const [exp, sig] = s.split(".");
    expect(verifySession(env, `${Number(exp) + 999}.${sig}`, 1_001)).toBe(false);
    expect(verifySession(env, `${exp}.${sig.slice(0, -2)}AA`, 1_001)).toBe(false);
    expect(verifySession(env, undefined, 1_001)).toBe(false);
    expect(verifySession(env, "", 1_001)).toBe(false);
    expect(verifySession(env, "x.y", 1_001)).toBe(false);
    expect(verifySession({ ...env, pin: "un-altro-pin!" }, s, 1_001)).toBe(false);
    expect(verifySession({ ...env, apiKey: "ALTRA" }, s, 1_001)).toBe(false);
  });
  it("la sessione non contiene né la chiave né il PIN", () => {
    const s = signSession(env, 1_000);
    expect(s).not.toContain("KEY-123");
    expect(s).not.toContain("una-frase-lunga");
  });
});

describe("token", () => {
  it("POST con `Authorization: ApiKey …`, nessun corpo; il token è il testo della risposta", async () => {
    const f = fakeFetch(() => text(` ${jwt(9_000_000_000)} \n`));
    const t = await getToken(env, 1_000, {}, f.fn);
    expect(t).toBe(jwt(9_000_000_000));
    expect(f.calls[0].url).toBe("https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token");
    expect(f.calls[0].init?.method).toBe("POST");
    expect((f.calls[0].init?.headers as Record<string, string>).authorization).toBe("ApiKey KEY-123");
    expect(f.calls[0].init?.body).toBeUndefined();
    expect(f.calls[0].url).not.toContain("KEY-123");
  });
  it("lo riusa finché restano più di 5 minuti, poi ne chiede uno nuovo", async () => {
    const cache: TokenCache = {};
    const f = fakeFetch(() => text(jwt(10_000)));
    await getToken(env, 1_000, cache, f.fn);
    await getToken(env, 9_000, cache, f.fn); // restano 1000 s: riuso
    expect(f.calls).toHaveLength(1);
    await getToken(env, 9_800, cache, f.fn); // restano 200 s: nuovo
    expect(f.calls).toHaveLength(2);
  });
  it("chiave scaduta o revocata (401/403) → errore di autorizzazione; altri errori e risposta vuota → errore", async () => {
    await expect(getToken(env, 1, {}, fakeFetch(() => text("", 401)).fn)).rejects.toBeInstanceOf(GarminAuthError);
    await expect(getToken(env, 1, {}, fakeFetch(() => text("", 403)).fn)).rejects.toBeInstanceOf(GarminAuthError);
    await expect(getToken(env, 1, {}, fakeFetch(() => text("", 500)).fn)).rejects.toBeInstanceOf(GarminError);
    await expect(getToken(env, 1, {}, fakeFetch(() => text("  ")).fn)).rejects.toBeInstanceOf(GarminError);
  });
  it("token senza scadenza leggibile: vale un'ora; jwtExpiry non lancia", async () => {
    expect(jwtExpiry("non-un-jwt")).toBeUndefined();
    expect(jwtExpiry(jwt(123))).toBe(123);
    const cache: TokenCache = {};
    await getToken(env, 1_000, cache, fakeFetch(() => text("opaco")).fn);
    expect(cache.expiresAt).toBe(4_600);
  });
});

describe("attività", () => {
  const range = { startDate: "2026-11-01", endDate: "2026-11-30" };
  it("GET con Bearer, intervallo e limite", async () => {
    const f = fakeFetch(() => json([{ activityId: 1 }]));
    const r = await listActivities(env, "TOK", range, f.fn, 30);
    expect(r).toEqual([{ activityId: 1 }]);
    const u = new URL(f.calls[0].url);
    expect(u.origin + u.pathname).toBe("https://personal.connectapi.garmin.com/activitylist-service/activities/search/activities");
    expect(Object.fromEntries(u.searchParams)).toEqual({ start: "0", limit: "30", startDate: "2026-11-01", endDate: "2026-11-30" });
    expect((f.calls[0].init?.headers as Record<string, string>).authorization).toBe("Bearer TOKEN".replace("TOKEN", "TOK"));
  });
  it("401 → autorizzazione; altri errori e risposta non-lista → errore; date non valide → errore prima di chiamare", async () => {
    await expect(listActivities(env, "t", range, fakeFetch(() => json({}, 401)).fn)).rejects.toBeInstanceOf(GarminAuthError);
    await expect(listActivities(env, "t", range, fakeFetch(() => json({}, 429)).fn)).rejects.toBeInstanceOf(GarminError);
    await expect(listActivities(env, "t", range, fakeFetch(() => json({ a: 1 })).fn)).rejects.toBeInstanceOf(GarminError);
    const f = fakeFetch(() => json([]));
    await expect(listActivities(env, "t", { startDate: "ieri", endDate: "2026-11-30" }, f.fn)).rejects.toBeInstanceOf(GarminError);
    expect(f.calls).toHaveLength(0);
  });
});
