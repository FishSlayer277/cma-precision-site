// POST /api/sales  (private: needs ADMIN_PIN)
//   { pin, action: "list" }                 -> website orders (read from Stripe) + Etsy/other sales you entered
//   { pin, action: "add", sale: {...} }     -> save an Etsy or other sale
//   { pin, action: "delete", id }           -> remove a sale you entered
// Only order details needed for profit are kept: dates, items, amounts. No customer names or addresses.
import { CATALOG, stripe, json, checkPin } from "../../lib/shop.js";

const ID_BY_NAME = Object.fromEntries(CATALOG.map(p => [p.name.toLowerCase(), p.id]));
const clean = (s, n) => String(s == null ? "" : s).replace(/[<>]/g, "").trim().slice(0, n);
const cents = v => Math.max(0, Math.round(Number(v) || 0));

async function stripeOrders(env) {
  const out = [];
  let after = null;
  for (let page = 0; page < 5; page++) {            // up to 500 orders
    const q = "checkout/sessions?status=complete&limit=100&expand[]=data.line_items&expand[]=data.payment_intent.latest_charge" + (after ? "&starting_after=" + after : "");
    const res = await stripe(env, "GET", q);
    for (const s of res.data) {
      if (s.payment_status !== "paid") continue;
      let lines = (s.line_items && s.line_items.data) || [];
      if (s.line_items && s.line_items.has_more) lines = (await stripe(env, "GET", `checkout/sessions/${s.id}/line_items?limit=100`)).data;
      const ch = s.payment_intent && s.payment_intent.latest_charge;
      const refundedCents = ch && typeof ch === "object" ? ch.amount_refunded || 0 : 0;
      const t = s.total_details || {};
      out.push({
        id: s.id.slice(-8).toUpperCase(),
        channel: "website",
        date: new Date(s.created * 1000).toISOString().slice(0, 10),
        items: lines.map(li => ({ pid: ID_BY_NAME[(li.description || "").toLowerCase()] || null, name: li.description, qty: li.quantity, unit: li.quantity ? Math.round(li.amount_subtotal / li.quantity) : 0 })),
        shipping: (s.shipping_cost && s.shipping_cost.amount_total) || t.amount_shipping || 0,
        discount: t.amount_discount || 0,
        tax: t.amount_tax || 0,
        total: s.amount_total || 0,
        refunded: refundedCents >= (s.amount_total || 0) && refundedCents > 0,
        refundedCents
      });
    }
    if (!res.has_more || !res.data.length) break;
    after = res.data[res.data.length - 1].id;
  }
  return out;
}

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch (e) {}
  const bad = await checkPin(env, body.pin);
  if (bad) return bad;

  const manual = (await env.SETTINGS.get("manualSales", "json")) || [];

  if (body.action === "add") {
    const s = body.sale || {};
    const items = (Array.isArray(s.items) ? s.items : [])
      .filter(i => CATALOG.some(p => p.id === i.pid) && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= 999)
      .map(i => ({ pid: i.pid, name: CATALOG.find(p => p.id === i.pid).name, qty: i.qty, unit: cents(i.unit) }));
    if (!items.length) return json(400, { error: "Add at least one item to the sale." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date || "")) return json(400, { error: "Pick the date of the sale." });
    const sale = {
      id: "M" + Date.now().toString(36).toUpperCase(),
      channel: s.channel === "other" ? "other" : "etsy",
      date: s.date, items,
      shipping: cents(s.shipping), discount: cents(s.discount),
      offsiteAds: !!s.offsiteAds, note: clean(s.note, 120)
    };
    if (manual.length >= 5000) return json(400, { error: "The sales log is full (5,000 entries)." });
    manual.push(sale);
    await env.SETTINGS.put("manualSales", JSON.stringify(manual));
    return json(200, { ok: true, sale }, { "Cache-Control": "no-store" });
  }

  if (body.action === "delete") {
    const next = manual.filter(s => s.id !== body.id);
    if (next.length === manual.length) return json(404, { error: "That sale wasn't found." });
    await env.SETTINGS.put("manualSales", JSON.stringify(next));
    return json(200, { ok: true }, { "Cache-Control": "no-store" });
  }

  // list
  let website = [], stripeError = null;
  try { website = await stripeOrders(env); } catch (e) { stripeError = e.message; }
  return json(200, { website, manual, stripeError }, { "Cache-Control": "no-store" });
}
