import { NextResponse, type NextRequest } from "next/server";
import { deauthorize, readEnv, STRAVA_COOKIE, unseal } from "../../../../server/strava";
import { cookieOptions, NO_STORE } from "../../../../server/strava-http";

/** Scollega: revoca l'accesso su Strava (se riesce) e cancella il cookie. */
export async function POST(request: NextRequest) {
  const env = readEnv();
  const sealed = request.cookies.get(STRAVA_COOKIE)?.value;
  const tokens = env && sealed ? unseal(sealed, env.clientSecret) : undefined;
  if (env && tokens) await deauthorize(env, tokens.accessToken);
  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  res.cookies.set(STRAVA_COOKIE, "", cookieOptions(0));
  return res;
}
