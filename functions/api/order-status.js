// GET /api/order-status?session_id=cs_... -> details for the order confirmation page (paid orders only)
import { stripe, json } from "../../lib/shop.js";

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("session_id") || "";
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) return json(400, { error: "Missing order reference." });
  try {
    const s = await stripe(env, "GET", "checkout/sessions/" + id);
    if (s.payment_status !== "paid") return json(409, { error: "This order isn't paid yet." });
    const items = await stripe(env, "GET", "checkout/sessions/" + id + "/line_items?limit=100");
    const ship = (s.collected_information && s.collected_information.shipping_details) || s.shipping_details || {};
    const a = ship.address || {};
    const t = s.total_details || {};
    return json(200, {
      orderNo: s.id.slice(-8).toUpperCase(),
      created: s.created,
      email: (s.customer_details && s.customer_details.email) || "",
      name: ship.name || (s.customer_details && s.customer_details.name) || "",
      shipTo: [ship.name, a.line1, a.line2, [a.city, a.state].filter(Boolean).join(", ") + (a.postal_code ? " " + a.postal_code : "")].filter(Boolean),
      items: items.data.map(li => ({ name: li.description, qty: li.quantity, total: li.amount_total })),
      subtotal: s.amount_subtotal,
      shipping: (s.shipping_cost && s.shipping_cost.amount_total) || t.amount_shipping || 0,
      discount: t.amount_discount || 0,
      tax: t.amount_tax || 0,
      total: s.amount_total
    }, { "Cache-Control": "no-store" });
  } catch (err) {
    return json(404, { error: "Order not found." });
  }
}
