// GET  /api/settings  -> current shop settings (public: prices, shipping, vacation mode)
// POST /api/settings  -> change settings from the CMA Settings app; needs ADMIN_PIN
import { CATALOG, DEFAULTS, readSettings, json, safeEqual, sha256Hex } from "../../lib/shop.js";

const MAX_FAILS = 8, LOCK_MINUTES = 30;
const clean = (s, n) => String(s == null ? "" : s).replace(/[<>]/g, "").trim().slice(0, n);

export async function onRequestGet({ env }) {
  return json(200, await readSettings(env), { "Cache-Control": "no-cache" });
}

export async function onRequestPost({ request, env }) {
  if (!env.SETTINGS) return json(500, { error: "Settings storage isn't connected yet (KV binding SETTINGS)." });
  const pin = (env.ADMIN_PIN || "").trim();
  if (pin.length < 6) return json(500, { error: "ADMIN_PIN isn't set in Cloudflare (it needs at least 6 characters)." });

  const now = Date.now();
  const lock = (await env.SETTINGS.get("lock", "json")) || { fails: 0, since: now };
  if (now - lock.since > LOCK_MINUTES * 60000) { lock.fails = 0; lock.since = now; }
  if (lock.fails >= MAX_FAILS) return json(429, { error: `Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes.` });

  let body = {};
  try { body = await request.json(); } catch (e) {}
  const ok = body.pin && safeEqual(await sha256Hex(String(body.pin).trim()), await sha256Hex(pin));
  if (!ok) {
    lock.fails += 1;
    await env.SETTINGS.put("lock", JSON.stringify(lock), { expirationTtl: LOCK_MINUTES * 60 + 60 });
    return json(401, { error: "Wrong PIN." });
  }
  if (lock.fails) await env.SETTINGS.delete("lock");

  const current = await readSettings(env);
  if (body.check) return json(200, current, { "Cache-Control": "no-store" });

  // Only the parts that were sent change; everything else is kept.
  const next = { vacation: current.vacation, message: current.message, returnDate: current.returnDate, prices: { ...current.prices }, shipping: { ...current.shipping } };
  if ("vacation" in body) {
    next.vacation = !!body.vacation;
    next.message = clean(body.message, 300) || DEFAULTS.message;
    next.returnDate = clean(body.returnDate, 40);
  }
  if (body.prices && typeof body.prices === "object") {
    for (const p of CATALOG) {
      const c = body.prices[p.id];
      if (c === undefined) continue;
      if (!Number.isInteger(c) || c < 50 || c > 50000) return json(400, { error: `Check the price for ${p.name}: it must be between $0.50 and $500.` });
      if (c === p.cents) delete next.prices[p.id]; else next.prices[p.id] = c;
    }
  }
  if (body.shipping && typeof body.shipping === "object") {
    const sh = body.shipping;
    if (!Number.isInteger(sh.flatCents) || sh.flatCents < 0 || sh.flatCents > 5000) return json(400, { error: "Shipping must be between $0 and $50." });
    if (!Number.isInteger(sh.freeOverCents) || sh.freeOverCents < 100 || sh.freeOverCents > 100000) return json(400, { error: "The free-shipping amount must be between $1 and $1,000." });
    next.shipping = { flatCents: sh.flatCents, freeEnabled: !!sh.freeEnabled, freeOverCents: sh.freeOverCents };
  }
  next.updatedAt = new Date().toISOString();
  await env.SETTINGS.put("settings", JSON.stringify(next));
  return json(200, await readSettings({ SETTINGS: { get: async () => next } }), { "Cache-Control": "no-store" });
}
