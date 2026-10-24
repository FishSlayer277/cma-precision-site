// POST /api/checkout -> creates one Stripe Checkout (full page) session for the whole cart.
// Prices come from the server (catalog + saved settings), never from the browser.
import { BY_ID, readSettings, priceOf, stripe, json } from "../../lib/shop.js";

const USE_STRIPE_TAX = false;            // true once Utah is added under Stripe Tax > Registrations
const SHIP_DAYS = { min: 3, max: 9 };    // print/handling + USPS transit, business days

export async function onRequestPost({ request, env }) {
  let items = [];
  try { items = (await request.json()).items || []; } catch (e) {}
  const st = await readSettings(env);
  if (st.vacation) return json(409, { error: "The website shop is on a break right now. Please order from our Etsy shop: etsy.com/shop/CMAprecision" });

  const valid = items.filter(i => BY_ID[i.id] && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= 20);
  if (!valid.length) return json(400, { error: "The cart is empty." });

  const sh = st.shipping;
  const subtotal = valid.reduce((t, i) => t + priceOf(st, i.id) * i.qty, 0);
  const free = sh.flatCents === 0 || (sh.freeEnabled && subtotal >= sh.freeOverCents);
  const site = new URL(request.url).origin;
  const taxB = USE_STRIPE_TAX ? { tax_behavior: "exclusive" } : {};

  const params = {
    mode: "payment",
    line_items: valid.map(i => ({
      quantity: i.qty,
      price_data: { currency: "usd", unit_amount: priceOf(st, i.id), product_data: { name: BY_ID[i.id].name, images: [BY_ID[i.id].image] }, ...taxB }
    })),
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    shipping_address_collection: { allowed_countries: ["US"] },
    shipping_options: [{
      shipping_rate_data: {
        type: "fixed_amount",
        display_name: free ? "Free shipping (USPS)" : "Standard shipping (USPS)",
        fixed_amount: { amount: free ? 0 : sh.flatCents, currency: "usd" },
        delivery_estimate: { minimum: { unit: "business_day", value: SHIP_DAYS.min }, maximum: { unit: "business_day", value: SHIP_DAYS.max } },
        ...taxB
      }
    }],
    ...(USE_STRIPE_TAX ? { automatic_tax: { enabled: true } } : {}),
    custom_text: { submit: { message: "Printed in small batches in Utah. In-stock orders ship in 24–48 hours; printed-to-order items take 2–5 business days." } },
    success_url: site + "/?order=success&session_id={CHECKOUT_SESSION_ID}",
    cancel_url: site + "/"
  };
  try {
    const session = await stripe(env, "POST", "checkout/sessions", params);
    return json(200, { url: session.url });
  } catch (err) {
    return json(500, { error: "Stripe said: " + err.message });
  }
}
