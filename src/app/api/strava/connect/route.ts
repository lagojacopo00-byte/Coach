import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl, readEnv, STRAVA_STATE_COOKIE } from "../../../../server/strava";
import { cookieOptions } from "../../../../server/strava-http";

/** Inizia il collegamento: manda su Strava con uno `state` casuale (anti-CSRF) salvato in un cookie breve. */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const env = readEnv();
  if (!env) return NextResponse.redirect(new URL("/profilo?strava=non-configurato", origin));
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(env, `${origin}/api/strava/callback`, state));
  res.cookies.set(STRAVA_STATE_COOKIE, state, cookieOptions(600));
  return res;
}
