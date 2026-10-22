// Creates one Stripe Checkout (full page) session for the whole cart.
// Prices live here on the server, so a customer can't change them in the browser.
// Setup: in Netlify, add the environment variable STRIPE_SECRET_KEY. No Stripe products are needed:
// each item's name and price are sent from the list below.
const Stripe = require("stripe");

// ---- Shop settings (amounts are in cents) ----
const SHIPPING_CENTS = 500;        // flat shipping charge: 500 = $5.00
const FREE_SHIPPING_OVER = 2500;   // free shipping when items total this much: 2500 = $25.00 (0 = never free)
const USE_STRIPE_TAX = false;      // true once Utah is added under Stripe Tax > Registrations
const SHIP_DAYS = { min: 3, max: 9 }; // print/handling + USPS Ground Advantage transit, in business days

// Product list: the website's product id -> name, price in cents, and photo shown at checkout.
// Change a price here AND on the website (index.html) so they match.
const PRODUCTS = {
  "4328837116": { name: "Classic Die Block", cents: 750, image: "https://i.etsystatic.com/55332613/r/il/844b0e/7860356574/il_794xN.7860356574_qxzg.jpg" },
  "4509881976": { name: "Die Block for Lee Breech-Lock", cents: 750, image: "https://i.etsystatic.com/55332613/r/il/c202b6/8099005817/il_794xN.8099005817_de84.jpg" },
  "4509874233": { name: "Die Block for Hornady LNL", cents: 750, image: "https://i.etsystatic.com/55332613/r/il/d7eb93/8051049974/il_794xN.8051049974_nei6.jpg" },
  "4297972451": { name: "Turret Caddy", cents: 750, image: "https://i.etsystatic.com/55332613/r/il/102545/7907973235/il_794xN.7907973235_1ll2.jpg" },
  "4400699248": { name: "Die Turret Caddy, New Version", cents: 750, image: "https://i.etsystatic.com/55332613/r/il/fba132/7860050976/il_794xN.7860050976_fkd0.jpg" },
  "4459515700": { name: "Lee Pro 1000 Turret Caddy", cents: 750, image: "https://i.etsystatic.com/55332613/r/il/5c5af3/7863195892/il_794xN.7863195892_38u0.jpg" },
  "4395297309": { name: "Powder Pedestal, Round Bottles", cents: 650, image: "https://i.etsystatic.com/55332613/r/il/338662/7406028031/il_794xN.7406028031_8w63.jpg" },
  "4398827077": { name: "Powder Pedestal, Accurate / Ramshot / Western", cents: 600, image: "https://i.etsystatic.com/55332613/r/il/184976/7358137604/il_794xN.7358137604_n5op.jpg" },
  "4398833045": { name: "Powder Pedestal, VihtaVuori", cents: 600, image: "https://i.etsystatic.com/55332613/r/il/b375d4/7358186236/il_794xN.7358186236_75tq.jpg" },
  "4404334893": { name: "4-Hole Die Rack, Standard", cents: 650, image: "https://i.etsystatic.com/55332613/r/il/dd1476/7440912875/il_794xN.7440912875_n8t6.jpg" },
  "4405548763": { name: "4-Hole Die Rack, Lee Breech-Lock", cents: 650, image: "https://i.etsystatic.com/55332613/r/il/22eb35/7448400807/il_794xN.7448400807_618s.jpg" },
  "4469254514": { name: "5-Hole Die Rack, Hornady LNL", cents: 650, image: "https://i.etsystatic.com/55332613/r/il/b05f4b/7835470023/il_794xN.7835470023_bn7e.jpg" },
  "4506184298": { name: "Revolver Pen Cup, Burnt Titanium", cents: 800, image: "https://i.etsystatic.com/55332613/r/il/3aa2c6/8026477544/il_794xN.8026477544_gaq1.jpg" },
  "4472020335": { name: "Revolver Pen Cup, Silver", cents: 800, image: "https://i.etsystatic.com/55332613/r/il/ddb911/7805666296/il_794xN.7805666296_lktk.jpg" },
  "4334356976": { name: "Magnetic Shell Holder Organizer", cents: 750, image: "https://i.etsystatic.com/55332613/r/il/25c904/7014514832/il_794xN.7014514832_hlhb.jpg" }
};

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Use POST" });
  const key = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) return json(500, { error: "Payments aren't set up: STRIPE_SECRET_KEY is missing in Netlify." });
  if (!/^(sk|rk)_(live|test)_/.test(key)) return json(500, { error: "Payments aren't set up: STRIPE_SECRET_KEY should start with sk_live_ (or rk_live_)." });
  const stripe = Stripe(key);
  let items = [];
  try { items = JSON.parse(event.body || "{}").items || []; } catch (e) {}

  const valid = items.filter(i => PRODUCTS[i.id] && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= 20);
  if (!valid.length) return json(400, { error: "The cart is empty." });

  const line_items = valid.map(i => ({
    quantity: i.qty,
    price_data: {
      currency: "usd",
      unit_amount: PRODUCTS[i.id].cents,
      product_data: { name: PRODUCTS[i.id].name, images: [PRODUCTS[i.id].image] },
      ...(USE_STRIPE_TAX ? { tax_behavior: "exclusive" } : {})
    }
  }));
  const subtotal = valid.reduce((t, i) => t + PRODUCTS[i.id].cents * i.qty, 0);
  const free = FREE_SHIPPING_OVER > 0 && subtotal >= FREE_SHIPPING_OVER;

  const site = process.env.URL || event.headers.origin;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: free ? "Free shipping (USPS)" : "Standard shipping (USPS)",
          fixed_amount: { amount: free ? 0 : SHIPPING_CENTS, currency: "usd" },
          delivery_estimate: {
            minimum: { unit: "business_day", value: SHIP_DAYS.min },
            maximum: { unit: "business_day", value: SHIP_DAYS.max }
          },
          ...(USE_STRIPE_TAX ? { tax_behavior: "exclusive" } : {})
        }
      }],
      ...(USE_STRIPE_TAX ? { automatic_tax: { enabled: true } } : {}),
      custom_text: {
        submit: { message: "Printed in small batches in Utah. In-stock orders ship in 24–48 hours; printed-to-order items take 2–5 business days." }
      },
      success_url: site + "/?order=success&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: site + "/"
    });
    return json(200, { url: session.url });
  } catch (err) {
    console.error(err);
    // Stripe's message explains the problem (it never contains your key)
    return json(500, { error: "Stripe said: " + (err && err.message ? err.message : "unknown error") });
  }
};
