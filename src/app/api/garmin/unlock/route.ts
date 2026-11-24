import { NextResponse, type NextRequest } from "next/server";
import { GARMIN_COOKIE, pinMatches, readEnv, signSession } from "../../../../server/garmin";
import { clearCookie, sessionCookie } from "../../../../server/garmin-http";
import { NO_STORE } from "../../../../server/strava-http";

/** Sblocca l'import Garmin su questo browser con il PIN (GARMIN_APP_PIN). */
export async function POST(request: NextRequest) {
  const env = readEnv();
  if (!env) return Response.json({ error: "not_configured" }, { status: 503, headers: NO_STORE });
  const body = (await request.json().catch(() => null)) as { pin?: unknown } | null;
  if (!pinMatches(env, body?.pin)) {
    // Rallenta chi prova a indovinare il PIN.
    await new Promise((r) => setTimeout(r, 800));
    const res = NextResponse.json({ error: "wrong_pin" }, { status: 401, headers: NO_STORE });
    res.cookies.set(GARMIN_COOKIE, "", clearCookie());
    return res;
  }
  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  res.cookies.set(GARMIN_COOKIE, signSession(env, Math.floor(Date.now() / 1000)), sessionCookie());
  return res;
}
