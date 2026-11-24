import type { NextRequest } from "next/server";
import { configIssue, GARMIN_COOKIE, readEnv, verifySession } from "../../../../server/garmin";
import { NO_STORE } from "../../../../server/strava-http";

/** Stato: configurato (chiave + PIN su Vercel) e sbloccato (cookie valido). Non chiama Garmin. */
export async function GET(request: NextRequest) {
  // Leggo SEMPRE la richiesta per prima: così la route è dinamica e non viene prerenderizzata alla build
  // (altrimenti "non configurato" resterebbe congelato anche dopo aver messo le chiavi).
  const cookie = request.cookies.get(GARMIN_COOKIE)?.value;
  const env = readEnv();
  const issue = configIssue();
  const unlocked = Boolean(env && verifySession(env, cookie, Math.floor(Date.now() / 1000)));
  return Response.json({ configured: Boolean(env), ...(issue ? { issue } : {}), unlocked }, { headers: NO_STORE });
}
