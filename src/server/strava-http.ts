/** Opzioni comuni delle route Strava. */
export const NO_STORE = { "cache-control": "no-store" } as const;

/** Cookie httpOnly: JavaScript nel browser non può leggerlo. `secure` in produzione (HTTPS). */
export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export const YEAR_SECONDS = 365 * 24 * 3600;
