import { describe, expect, it } from "vitest";
import {
  authorizeUrl,
  deauthorize,
  exchangeCode,
  freshTokens,
  listRunActivities,
  readEnv,
  sameValue,
  scopeAllowsActivities,
  seal,
  StravaAuthError,
  StravaError,
  unseal,
  type StravaEnv,
  type Tokens,
} from "./strava";

const env: StravaEnv = { clientId: "123", clientSecret: "s3cret", baseUrl: "https://www.strava.com" };
const tokens: Tokens = { accessToken: "at", refreshToken: "rt", expiresAt: 2_000_000_000 };

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
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("configurazione", () => {
  it("serve ID e chiave; senza, non è configurato", () => {
    expect(readEnv({})).toBeUndefined();
    expect(readEnv({ STRAVA_CLIENT_ID: "1" })).toBeUndefined();
    expect(readEnv({ STRAVA_CLIENT_ID: "1", STRAVA_CLIENT_SECRET: "  " })).toBeUndefined();
    expect(readEnv({ STRAVA_CLIENT_ID: " 1 ", STRAVA_CLIENT_SECRET: "x" })).toEqual({ clientId: "1", clientSecret: "x", baseUrl: "https://www.strava.com" });
  });
  it("l'indirizzo di Strava si cambia solo per i test", () => {
    expect(readEnv({ STRAVA_CLIENT_ID: "1", STRAVA_CLIENT_SECRET: "x", STRAVA_BASE_URL: "http://localhost:3200/" })?.baseUrl).toBe("http://localhost:3200");
  });
});

describe("cookie cifrato", () => {
  it("cifra e decifra", () => {
    const s = seal(tokens, "chiave");
    expect(s).not.toContain("rt");
    expect(unseal(s, "chiave")).toEqual(tokens);
  });
  it("ogni cifratura è diversa (IV casuale)", () => {
    expect(seal(tokens, "k")).not.toBe(seal(tokens, "k"));
  });
  it("con la chiave sbagliata o se lo manometti, niente", () => {
    const s = seal(tokens, "chiave");
    expect(unseal(s, "altra")).toBeUndefined();
    const [iv, tag, ct] = s.split(".");
    const flipped = ct.slice(0, -2) + (ct.endsWith("AA") ? "BB" : "AA");
    expect(unseal(`${iv}.${tag}.${flipped}`, "chiave")).toBeUndefined();
    expect(unseal("", "chiave")).toBeUndefined();
    expect(unseal("a.b", "chiave")).toBeUndefined();
    expect(unseal("non.un.cookie", "chiave")).toBeUndefined();
  });
  it("sameValue: uguali sì, diversi o vuoti no", () => {
    expect(sameValue("abc", "abc")).toBe(true);
    expect(sameValue("abc", "abd")).toBe(false);
    expect(sameValue("abc", "abcd")).toBe(false);
    expect(sameValue(undefined, "abc")).toBe(false);
    expect(sameValue("", "")).toBe(false);
  });
});

describe("autorizzazione", () => {
  it("l'indirizzo di Strava ha ID, ritorno, permessi di sola lettura e state", () => {
    const u = new URL(authorizeUrl(env, "https://coach.example/api/strava/callback", "xyz"));
    expect(u.origin + u.pathname).toBe("https://www.strava.com/oauth/authorize");
    expect(u.searchParams.get("client_id")).toBe("123");
    expect(u.searchParams.get("redirect_uri")).toBe("https://coach.example/api/strava/callback");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("state")).toBe("xyz");
    expect(u.searchParams.get("scope")).toBe("read,activity:read_all");
    expect(u.search).not.toContain("s3cret");
  });
  it("servono i permessi sulle attività", () => {
    expect(scopeAllowsActivities("read,activity:read_all")).toBe(true);
    expect(scopeAllowsActivities("read,activity:read")).toBe(true);
    expect(scopeAllowsActivities("read")).toBe(false);
    expect(scopeAllowsActivities(null)).toBe(false);
  });
  it("scambio del codice: manda ID, chiave e codice nel corpo, mai nell'indirizzo", async () => {
    const f = fakeFetch(() => json({ access_token: "A", refresh_token: "R", expires_at: 123 }));
    expect(await exchangeCode(env, "CODICE", f.fn)).toEqual({ accessToken: "A", refreshToken: "R", expiresAt: 123 });
    expect(f.calls[0].url).toBe("https://www.strava.com/oauth/token");
    expect(f.calls[0].url).not.toContain("s3cret");
    const body = new URLSearchParams(String(f.calls[0].init?.body));
    expect(Object.fromEntries(body)).toEqual({ client_id: "123", client_secret: "s3cret", code: "CODICE", grant_type: "authorization_code" });
    expect(f.calls[0].init?.method).toBe("POST");
  });
  it("codice rifiutato → errore di autorizzazione; risposta strana → errore", async () => {
    await expect(exchangeCode(env, "x", fakeFetch(() => json({ message: "Bad" }, 400)).fn)).rejects.toBeInstanceOf(StravaAuthError);
    await expect(exchangeCode(env, "x", fakeFetch(() => json({ ok: 1 })).fn)).rejects.toBeInstanceOf(StravaError);
    await expect(exchangeCode(env, "x", fakeFetch(() => json({}, 500)).fn)).rejects.toBeInstanceOf(StravaError);
  });
});

describe("rinnovo dei token", () => {
  it("se non scadono a breve non chiama Strava", async () => {
    const f = fakeFetch(() => json({}));
    const r = await freshTokens(env, tokens, 1_000_000_000, f.fn);
    expect(r).toEqual({ tokens, refreshed: false });
    expect(f.calls).toHaveLength(0);
  });
  it("se scadono entro un minuto li rinnova con il refresh token", async () => {
    const f = fakeFetch(() => json({ access_token: "A2", refresh_token: "R2", expires_at: 9 }));
    const r = await freshTokens(env, { ...tokens, expiresAt: 1_000 }, 970, f.fn);
    expect(r).toEqual({ tokens: { accessToken: "A2", refreshToken: "R2", expiresAt: 9 }, refreshed: true });
    const body = Object.fromEntries(new URLSearchParams(String(f.calls[0].init?.body)));
    expect(body).toMatchObject({ grant_type: "refresh_token", refresh_token: "rt" });
  });
  it("se Strava rifiuta il rinnovo (accesso revocato) → errore di autorizzazione", async () => {
    await expect(freshTokens(env, { ...tokens, expiresAt: 1 }, 100, fakeFetch(() => json({}, 401)).fn)).rejects.toBeInstanceOf(StravaAuthError);
  });
});

describe("attività", () => {
  const act = (id: number, sport = "Run") => ({ id, name: "n", sport_type: sport, start_date_local: "2026-11-24T07:00:00Z", distance: 5000, moving_time: 1500 });
  it("chiede le attività dal timestamp, col token, e tiene solo le corse", async () => {
    const f = fakeFetch(() => json([act(1), act(2, "Ride"), act(3, "TrailRun")]));
    const list = await listRunActivities(env, "TOKEN", 1700000000.9, f.fn, 30);
    expect(list.map((a) => a.id)).toEqual([1, 3]);
    expect(f.calls[0].url).toBe("https://www.strava.com/api/v3/athlete/activities?after=1700000000&per_page=30");
    expect((f.calls[0].init?.headers as Record<string, string>).authorization).toBe("Bearer TOKEN");
  });
  it("401 → errore di autorizzazione; altri errori → errore generico; risposta non lista → errore", async () => {
    await expect(listRunActivities(env, "t", 0, fakeFetch(() => json({}, 401)).fn)).rejects.toBeInstanceOf(StravaAuthError);
    await expect(listRunActivities(env, "t", 0, fakeFetch(() => json({}, 429)).fn)).rejects.toBeInstanceOf(StravaError);
    await expect(listRunActivities(env, "t", 0, fakeFetch(() => json({ a: 1 })).fn)).rejects.toBeInstanceOf(StravaError);
  });
  it("deauthorize non lancia mai, nemmeno se la rete cade", async () => {
    const boom = (async () => { throw new Error("rete"); }) as typeof fetch;
    await expect(deauthorize(env, "t", boom)).resolves.toBeUndefined();
    const f = fakeFetch(() => json({}));
    await deauthorize(env, "TOK", f.fn);
    expect(f.calls[0].url).toBe("https://www.strava.com/oauth/deauthorize");
  });
});
