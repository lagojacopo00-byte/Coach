import type { NextRequest } from "next/server";
import { readEnv, STRAVA_COOKIE, unseal } from "../../../../server/strava";
import { NO_STORE } from "../../../../server/strava-http";

/** Stato dell'integrazione: configurata (chiavi su Vercel) e collegata (cookie valido). Non chiama Strava. */
export async function GET(request: NextRequest) {
  const env = readEnv();
  const sealed = request.cookies.get(STRAVA_COOKIE)?.value;
  const connected = Boolean(env && sealed && unseal(sealed, env.clientSecret));
  return Response.json({ configured: Boolean(env), connected }, { headers: NO_STORE });
}
