// Shared shop data and helpers for the Cloudflare Pages Functions in /functions.
// Settings live in Cloudflare KV (binding name: SETTINGS). Secrets come from the project's environment variables.

export const CATALOG = [
  { id: "4328837116", name: "Classic Die Block", cents: 750, image: "https://i.etsystatic.com/55332613/r/il/844b0e/7860356574/il_794xN.7860356574_qxzg.jpg" },
  { id: "4509881976", name: "Die Block for Lee Breech-Lock", cents: 750, image: "https://i.etsystatic.com/55332613/r/il/c202b6/8099005817/il_794xN.8099005817_de84.jpg" },
  { id: "4509874233", name: "Die Block for Hornady LNL", cents: 750, image: "https://i.etsystatic.com/55332613/r/il/d7eb93/8051049974/il_794xN.8051049974_nei6.jpg" },
  { id: "4297972451", name: "Turret Caddy", cents: 750, image: "https://i.etsystatic.com/55332613/r/il/102545/7907973235/il_794xN.7907973235_1ll2.jpg" },
  { id: "4400699248", name: "Die Turret Caddy, New Version", cents: 750, image: "https://i.etsystatic.com/55332613/r/il/fba132/7860050976/il_794xN.7860050976_fkd0.jpg" },
  { id: "4459515700", name: "Lee Pro 1000 Turret Caddy", cents: 750, image: "https://i.etsystatic.com/55332613/r/il/5c5af3/7863195892/il_794xN.7863195892_38u0.jpg" },
  { id: "4395297309", name: "Powder Pedestal, Round Bottles", cents: 650, image: "https://i.etsystatic.com/55332613/r/il/338662/7406028031/il_794xN.7406028031_8w63.jpg" },
  { id: "4398827077", name: "Powder Pedestal, Accurate / Ramshot / Western", cents: 600, image: "https://i.etsystatic.com/55332613/r/il/184976/7358137604/il_794xN.7358137604_n5op.jpg" },
  { id: "4398833045", name: "Powder Pedestal, VihtaVuori", cents: 600, image: "https://i.etsystatic.com/55332613/r/il/b375d4/7358186236/il_794xN.7358186236_75tq.jpg" },
  { id: "4404334893", name: "4-Hole Die Rack, Standard", cents: 650, image: "https://i.etsystatic.com/55332613/r/il/dd1476/7440912875/il_794xN.7440912875_n8t6.jpg" },
  { id: "4405548763", name: "4-Hole Die Rack, Lee Breech-Lock", cents: 650, image: "https://i.etsystatic.com/55332613/r/il/22eb35/7448400807/il_794xN.7448400807_618s.jpg" },
  { id: "4469254514", name: "5-Hole Die Rack, Hornady LNL", cents: 650, image: "https://i.etsystatic.com/55332613/r/il/b05f4b/7835470023/il_794xN.7835470023_bn7e.jpg" },
  { id: "4506184298", name: "Revolver Pen Cup, Burnt Titanium", cents: 800, image: "https://i.etsystatic.com/55332613/r/il/3aa2c6/8026477544/il_794xN.8026477544_gaq1.jpg" },
  { id: "4472020335", name: "Revolver Pen Cup, Silver", cents: 800, image: "https://i.etsystatic.com/55332613/r/il/ddb911/7805666296/il_794xN.7805666296_lktk.jpg" },
  { id: "4334356976", name: "Magnetic Shell Holder Organizer", cents: 750, image: "https://i.etsystatic.com/55332613/r/il/25c904/7014514832/il_794xN.7014514832_hlhb.jpg" }
];
export const BY_ID = Object.fromEntries(CATALOG.map(p => [p.id, p]));
export const DEFAULT_SHIPPING = { flatCents: 500, freeEnabled: true, freeOverCents: 2500 };
export const DEFAULTS = {
  vacation: false,
  message: "The website shop is taking a short break. You can still order everything from our Etsy shop.",
  returnDate: "",
  prices: {},
  shipping: DEFAULT_SHIPPING,
  updatedAt: null
};

export const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

/* Settings stored in KV, merged with defaults, plus the catalog with current prices */
export async function readSettings(env) {
  let saved = {};
  try { saved = (await env.SETTINGS.get("settings", "json")) || {}; } catch (e) { /* KV not bound yet: use defaults */ }
  const s = { ...DEFAULTS, ...saved, shipping: { ...DEFAULT_SHIPPING, ...(saved.shipping || {}) }, prices: saved.prices || {} };
  s.catalog = CATALOG.map(p => ({ id: p.id, name: p.name, cents: p.cents, price: Number.isInteger(s.prices[p.id]) ? s.prices[p.id] : p.cents }));
  return s;
}
export const priceOf = (s, id) => (Number.isInteger(s.prices[id]) && s.prices[id] >= 50 ? s.prices[id] : BY_ID[id].cents);

/* ---- Stripe REST API (no SDK needed) ---- */
function formEncode(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") formEncode(v, key, out);
    else out.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(v)));
  }
  return out.join("&");
}
export async function stripe(env, method, path, params) {
  const key = (env.STRIPE_SECRET_KEY || "").trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is missing in Cloudflare.");
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method,
    headers: { "Authorization": "Bearer " + key, ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: params ? formEncode(params) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data.error && data.error.message) || "Stripe error " + res.status);
  return data;
}

/* Stripe webhook signature check (Stripe-Signature: t=...,v1=...) */
export async function verifyStripeSignature(raw, header, secret, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map(x => x.split("=")).filter(x => x.length === 2).map(([a, b]) => [a.trim(), b.trim()]));
  const sigs = header.split(",").filter(x => x.trim().startsWith("v1=")).map(x => x.trim().slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${raw}`)));
  const hex = [...mac].map(b => b.toString(16).padStart(2, "0")).join("");
  return sigs.some(s => safeEqual(s, hex));
}
export function safeEqual(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export async function sha256Hex(s) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s))));
  return [...d].map(b => b.toString(16).padStart(2, "0")).join("");
}
