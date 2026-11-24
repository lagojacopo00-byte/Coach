import { NextResponse, type NextRequest } from "next/server";
import { freshTokens, listRunActivities, readEnv, seal, STRAVA_COOKIE, StravaAuthError, unseal } from "../../../../server/strava";
import { cookieOptions, NO_STORE, YEAR_SECONDS } from "../../../../server/strava-http";

const DAY = 86_400;

/** Le tue corse da Strava dal timestamp `after` (default: ultimi 30 giorni). Rinnova i token se servono. */
export async function GET(request: NextRequest) {
  const env = readEnv();
  if (!env) return Response.json({ error: "not_configured" }, { status: 503, headers: NO_STORE });
  const sealed = request.cookies.get(STRAVA_COOKIE)?.value;
  const tokens = sealed ? unseal(sealed, env.clientSecret) : undefined;
  if (!tokens) return Response.json({ error: "not_connected" }, { status: 401, headers: NO_STORE });

  const nowSec = Math.floor(Date.now() / 1000);
  const asked = Number(request.nextUrl.searchParams.get("after"));
  // Mai oltre 400 giorni indietro: limita le richieste a Strava.
  const after = Number.isFinite(asked) && asked > 0 ? Math.max(Math.floor(asked), nowSec - 400 * DAY) : nowSec - 30 * DAY;

  try {
    const fresh = await freshTokens(env, tokens, nowSec);
    const activities = await listRunActivities(env, fresh.tokens.accessToken, after);
    const res = NextResponse.json({ activities }, { headers: NO_STORE });
    if (fresh.refreshed) res.cookies.set(STRAVA_COOKIE, seal(fresh.tokens, env.clientSecret), cookieOptions(YEAR_SECONDS));
    return res;
  } catch (e) {
    if (e instanceof StravaAuthError) {
      // Accesso revocato su Strava: il cookie non vale più.
      const res = NextResponse.json({ error: "not_connected" }, { status: 401, headers: NO_STORE });
      res.cookies.set(STRAVA_COOKIE, "", cookieOptions(0));
      return res;
    }
    return Response.json({ error: "strava_error" }, { status: 502, headers: NO_STORE });
  }
}
