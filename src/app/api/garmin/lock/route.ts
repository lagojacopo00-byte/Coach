import { NextResponse } from "next/server";
import { GARMIN_COOKIE } from "../../../../server/garmin";
import { clearCookie } from "../../../../server/garmin-http";
import { NO_STORE } from "../../../../server/strava-http";

/** Blocca di nuovo l'import Garmin su questo browser. */
export async function POST() {
  const res = NextResponse.json({ ok: true }, { headers: NO_STORE });
  res.cookies.set(GARMIN_COOKIE, "", clearCookie());
  return res;
}
