// Shop settings (vacation mode) that John can change from his phone without a new deploy.
// GET  /api/settings  -> current settings (cached by Netlify for up to a minute)
// POST /api/settings  -> change settings; needs the ADMIN_PIN set in Netlify's environment variables
import { getStore } from "@netlify/blobs";
import { timingSafeEqual, createHash } from "node:crypto";

const DEFAULTS = {
  vacation: false,
  message: "The website shop is taking a short break. You can still order everything from our Etsy shop.",
  returnDate: "",
  updatedAt: null
};
const MAX_FAILS = 8;            // wrong PIN attempts allowed...
const LOCK_MINUTES = 30;        // ...per 30 minutes

const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...extra } });
const hash = s => createHash("sha256").update(String(s)).digest();
const sameSecret = (a, b) => timingSafeEqual(hash(a), hash(b));
const clean = (s, n) => String(s == null ? "" : s).replace(/[<>]/g, "").trim().slice(0, n);

export default async (req) => {
  const store = getStore("shop-settings");
  const current = { ...DEFAULTS, ...((await store.get("settings", { type: "json" })) || {}) };

  if (req.method === "GET") {
    return json(200, current, {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=30"
    });
  }
  if (req.method !== "POST") return json(405, { error: "Not allowed" });

  const pin = (Netlify.env.get("ADMIN_PIN") || "").trim();
  if (pin.length < 6) return json(500, { error: "ADMIN_PIN isn't set in Netlify (it needs at least 6 characters)." });

  const now = Date.now();
  const lock = (await store.get("lock", { type: "json" })) || { fails: 0, since: now };
  if (now - lock.since > LOCK_MINUTES * 60000) { lock.fails = 0; lock.since = now; }
  if (lock.fails >= MAX_FAILS) return json(429, { error: `Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes.` });

  let body = {};
  try { body = await req.json(); } catch (e) {}
  if (!body.pin || !sameSecret(String(body.pin).trim(), pin)) {
    lock.fails += 1;
    await store.setJSON("lock", lock);
    return json(401, { error: "Wrong PIN." });
  }
  if (lock.fails) await store.setJSON("lock", { fails: 0, since: now });

  if (body.check) return json(200, current, { "Cache-Control": "no-store" }); // PIN test only
  const next = {
    vacation: !!body.vacation,
    message: clean(body.message, 300) || DEFAULTS.message,
    returnDate: clean(body.returnDate, 40),
    updatedAt: new Date().toISOString()
  };
  await store.setJSON("settings", next);
  return json(200, next, { "Cache-Control": "no-store" });
};

export const config = { path: "/api/settings" };
