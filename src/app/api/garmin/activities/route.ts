import type { NextRequest } from "next/server";
import { describeRaw, mapGarminActivity, unrecognizedMessage } from "../../../../domain/garmin";
import type { ImportedActivity } from "../../../../domain/strava";
import { GARMIN_COOKIE, GarminAuthError, getToken, listActivities, readEnv, verifySession } from "../../../../server/garmin";
import { tokenCache } from "../../../../server/garmin-http";
import { NO_STORE } from "../../../../server/strava-http";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Le tue corse da Garmin nell'intervallo `from`–`to` (default: ultimi 30 giorni). Serve il blocco sbloccato. */
export async function GET(request: NextRequest) {
  // Leggo SEMPRE la richiesta per prima (route dinamica, mai prerenderizzata alla build).
  const cookie = request.cookies.get(GARMIN_COOKIE)?.value;
  const p = request.nextUrl.searchParams;
  const env = readEnv();
  if (!env) return Response.json({ error: "not_configured" }, { status: 503, headers: NO_STORE });
  const nowMs = Date.now();
  if (!verifySession(env, cookie, Math.floor(nowMs / 1000)))
    return Response.json({ error: "locked" }, { status: 401, headers: NO_STORE });

  const from = p.get("from");
  const to = p.get("to");
  // Un giorno di margine alla fine: non so se Garmin considera `endDate` incluso o escluso.
  const startDate = from && DATE.test(from) ? from : iso(nowMs - 30 * DAY_MS);
  const endDate = to && DATE.test(to) ? to : iso(nowMs + DAY_MS);

  try {
    const token = await getToken(env, Math.floor(nowMs / 1000), tokenCache);
    const raw = await listActivities(env, token, { startDate, endDate });
    const activities = raw.map(mapGarminActivity).filter((a): a is ImportedActivity => a !== undefined);
    const diagnostic = describeRaw(raw, activities.length);
    return Response.json({ activities, diagnostic, message: unrecognizedMessage(diagnostic) }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof GarminAuthError) {
      tokenCache.token = undefined;
      return Response.json({ error: "key_invalid" }, { status: 401, headers: NO_STORE });
    }
    return Response.json({ error: "garmin_error" }, { status: 502, headers: NO_STORE });
  }
}
