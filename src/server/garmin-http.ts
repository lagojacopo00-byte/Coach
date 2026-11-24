import { cookieOptions } from "./strava-http";
import type { TokenCache } from "./garmin";
import { SESSION_MAX_AGE } from "./garmin";

/** Il token Garmin vale 24 ore: si tiene in memoria finché l'istanza del server è viva. */
export const tokenCache: TokenCache = {};

export const sessionCookie = () => cookieOptions(SESSION_MAX_AGE);
export const clearCookie = () => cookieOptions(0);
