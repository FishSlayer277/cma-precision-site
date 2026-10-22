// Returns the details for the order confirmation page.
// The page sends the Stripe checkout session id from the return link; only paid orders are shown,
// and only what the buyer already knows (their items, totals, name and ship-to address).
const Stripe = require("stripe");

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  const id = (event.queryStringParameters && event.queryStringParameters.session_id) || "";
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) return json(400, { error: "Missing order reference." });
  const key = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) return json(500, { error: "Payments aren't set up." });
  const stripe = Stripe(key);

  try {
    const s = await stripe.checkout.sessions.retrieve(id);
    if (s.payment_status !== "paid") return json(409, { error: "This order isn't paid yet." });
    const items = await stripe.checkout.sessions.listLineItems(id, { limit: 100 });
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
    });
  } catch (err) {
    console.error(err);
    return json(404, { error: "Order not found." });
  }
};
