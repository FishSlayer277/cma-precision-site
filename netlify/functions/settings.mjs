// Shop settings (vacation mode) that John can change from his phone without a new deploy.
// GET  /api/settings  -> current settings (cached by Netlify for up to a minute)
// POST /api/settings  -> change settings; needs the ADMIN_PIN set in Netlify's environment variables
import { getStore } from "@netlify/blobs";
import { timingSafeEqual, createHash } from "node:crypto";

// Product names and default prices (same as checkout.js). Saved prices from the app override these.
const CATALOG = [
  { id: "4328837116", name: "Classic Die Block", cents: 750 },
  { id: "4509881976", name: "Die Block for Lee Breech-Lock", cents: 750 },
  { id: "4509874233", name: "Die Block for Hornady LNL", cents: 750 },
  { id: "4297972451", name: "Turret Caddy", cents: 750 },
  { id: "4400699248", name: "Die Turret Caddy, New Version", cents: 750 },
  { id: "4459515700", name: "Lee Pro 1000 Turret Caddy", cents: 750 },
  { id: "4395297309", name: "Powder Pedestal, Round Bottles", cents: 650 },
  { id: "4398827077", name: "Powder Pedestal, Accurate / Ramshot / Western", cents: 600 },
  { id: "4398833045", name: "Powder Pedestal, VihtaVuori", cents: 600 },
  { id: "4404334893", name: "4-Hole Die Rack, Standard", cents: 650 },
  { id: "4405548763", name: "4-Hole Die Rack, Lee Breech-Lock", cents: 650 },
  { id: "4469254514", name: "5-Hole Die Rack, Hornady LNL", cents: 650 },
  { id: "4506184298", name: "Revolver Pen Cup, Burnt Titanium", cents: 800 },
  { id: "4472020335", name: "Revolver Pen Cup, Silver", cents: 800 },
  { id: "4334356976", name: "Magnetic Shell Holder Organizer", cents: 750 }
];
const DEFAULT_SHIPPING = { flatCents: 500, freeEnabled: true, freeOverCents: 2500 };

const DEFAULTS = {
  vacation: false,
  message: "The website shop is taking a short break. You can still order everything from our Etsy shop.",
  returnDate: "",
  prices: {},
  shipping: DEFAULT_SHIPPING,
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
  const saved = (await store.get("settings", { type: "json" })) || {};
  const current = { ...DEFAULTS, ...saved, shipping: { ...DEFAULT_SHIPPING, ...(saved.shipping || {}) }, prices: saved.prices || {} };
  // what the app shows: every product with its current price
  current.catalog = CATALOG.map(p => ({ ...p, price: Number.isInteger(current.prices[p.id]) ? current.prices[p.id] : p.cents }));

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

  // Only the parts that were sent are changed; everything else is kept.
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
  await store.setJSON("settings", next);
  const out = { ...next, catalog: CATALOG.map(p => ({ ...p, price: Number.isInteger(next.prices[p.id]) ? next.prices[p.id] : p.cents })) };
  return json(200, out, { "Cache-Control": "no-store" });
};

export const config = { path: "/api/settings" };
