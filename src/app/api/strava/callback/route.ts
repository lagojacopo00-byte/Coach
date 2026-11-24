import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, readEnv, sameValue, scopeAllowsActivities, seal, STRAVA_COOKIE, STRAVA_STATE_COOKIE } from "../../../../server/strava";
import { cookieOptions, YEAR_SECONDS } from "../../../../server/strava-http";

/** Ritorno da Strava: verifica lo `state`, scambia il codice coi token e li salva cifrati nel cookie. */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const back = (result: string) => {
    const res = NextResponse.redirect(new URL(`/profilo?strava=${result}`, origin));
    res.cookies.set(STRAVA_STATE_COOKIE, "", cookieOptions(0));
    return res;
  };
  const env = readEnv();
  if (!env) return back("non-configurato");
  const code = searchParams.get("code");
  if (searchParams.get("error") || !code) return back("negato");
  if (!sameValue(request.cookies.get(STRAVA_STATE_COOKIE)?.value, searchParams.get("state") ?? undefined)) return back("errore");
  if (!scopeAllowsActivities(searchParams.get("scope"))) return back("permessi");
  try {
    const tokens = await exchangeCode(env, code);
    const res = back("ok");
    res.cookies.set(STRAVA_COOKIE, seal(tokens, env.clientSecret), cookieOptions(YEAR_SECONDS));
    return res;
  } catch {
    return back("errore");
  }
}
