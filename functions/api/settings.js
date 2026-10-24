// GET  /api/settings  -> current shop settings (public: prices, shipping, vacation mode)
// POST /api/settings  -> change settings from the CMA Settings app; needs a passkey session (/api/auth)
import { CATALOG, DEFAULTS, readSettings, json } from "../../lib/shop.js";
import { requireSession } from "../../lib/auth.js";

const clean = (s, n) => String(s == null ? "" : s).replace(/[<>]/g, "").trim().slice(0, n);

export async function onRequestGet({ env }) {
  return json(200, await readSettings(env), { "Cache-Control": "no-cache" });
}

export async function onRequestPost({ request, env }) {
  const locked = await requireSession(env, request);
  if (locked) return locked;
  let body = {};
  try { body = await request.json(); } catch (e) {}

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
