// POST /api/order-email -> Stripe calls this after each paid checkout (event: checkout.session.completed)
// and it emails John the full order details through Resend.
// Cloudflare variables needed: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY (ORDER_EMAIL optional)
import { stripe, verifyStripeSignature } from "../../lib/shop.js";

const money = c => "$" + ((c || 0) / 100).toFixed(2);
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildEmail(session, lineItems) {
  const cust = session.customer_details || {};
  const ship = (session.collected_information && session.collected_information.shipping_details) || session.shipping_details || {};
  const a = ship.address || cust.address || {};
  const totals = session.total_details || {};
  const shipping = (session.shipping_cost && session.shipping_cost.amount_total) || totals.amount_shipping || 0;
  const discount = totals.amount_discount || 0;
  const tax = totals.amount_tax || 0;
  const orderNo = session.id.slice(-8).toUpperCase();
  const when = new Date(session.created * 1000).toLocaleString("en-US", { timeZone: "America/Denver", dateStyle: "medium", timeStyle: "short" });
  const count = lineItems.reduce((n, li) => n + li.quantity, 0);
  const shipLines = [ship.name || cust.name, a.line1, a.line2, [a.city, a.state].filter(Boolean).join(", ") + (a.postal_code ? " " + a.postal_code : ""), a.country].filter(Boolean);
  const dash = session.payment_intent ? `https://dashboard.stripe.com/payments/${session.payment_intent}` : "https://dashboard.stripe.com/payments";

  const rows = lineItems.map(li => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #e2dede;font-size:15px"><b>${li.quantity} ×</b> ${esc(li.description)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e2dede;text-align:right;font-size:15px">${money(li.amount_total)}</td>
    </tr>`).join("");
  const sumRow = (label, val, bold) => `<tr><td style="padding:4px 0;font-size:14px;${bold ? "font-weight:700;font-size:16px" : "color:#5c5757"}">${label}</td><td style="padding:4px 0;text-align:right;${bold ? "font-weight:700;font-size:16px" : "font-size:14px"}">${val}</td></tr>`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0b0b0b">
    <div style="background:#8a0b0b;color:#fff;padding:16px 20px;border-radius:6px 6px 0 0">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">New order · CMA Precision</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px">Order ${orderNo} · ${money(session.amount_total)}</div>
      <div style="font-size:13px;margin-top:4px;opacity:.9">${esc(when)} · ${count} item${count === 1 ? "" : "s"}</div>
    </div>
    <div style="border:1px solid #e2dede;border-top:0;padding:20px;border-radius:0 0 6px 6px">
      <h3 style="margin:0 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#5c5757">Ship to</h3>
      <div style="font-size:16px;line-height:1.45;background:#f6e1e1;padding:12px 14px;border-radius:4px">${shipLines.map(esc).join("<br>")}</div>

      <h3 style="margin:20px 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#5c5757">Items to print and pack</h3>
      <table style="width:100%;border-collapse:collapse">${rows}</table>

      <table style="width:100%;border-collapse:collapse;margin-top:10px">
        ${sumRow("Items subtotal", money(session.amount_subtotal))}
        ${sumRow("Shipping", shipping ? money(shipping) : "Free")}
        ${discount ? sumRow("Discount" + (session.discounts && session.discounts.length ? " (promo code)" : ""), "−" + money(discount)) : ""}
        ${tax ? sumRow("Sales tax", money(tax)) : ""}
        ${sumRow("Total paid", money(session.amount_total), true)}
      </table>

      <h3 style="margin:20px 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#5c5757">Customer</h3>
      <div style="font-size:15px;line-height:1.5">
        ${esc(cust.name || ship.name || "")}<br>
        ${esc(cust.email || "")}${cust.phone ? "<br>" + esc(cust.phone) : ""}
      </div>

      <p style="margin:22px 0 0"><a href="${dash}" style="background:#0b0b0b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:4px;font-size:14px;display:inline-block">View payment in Stripe</a></p>
      <p style="font-size:12px;color:#5c5757;margin:16px 0 0">Reply to this email to write to the customer directly. Stripe reference: ${esc(session.id)}</p>
    </div>
  </div>`;

  const text = [
    `NEW ORDER ${orderNo} — ${money(session.amount_total)} (${when})`, "",
    "SHIP TO:", ...shipLines, "",
    "ITEMS:", ...lineItems.map(li => `  ${li.quantity} x ${li.description}  ${money(li.amount_total)}`), "",
    `Subtotal: ${money(session.amount_subtotal)}`, `Shipping: ${shipping ? money(shipping) : "Free"}`,
    ...(discount ? [`Discount: -${money(discount)}`] : []), ...(tax ? [`Sales tax: ${money(tax)}`] : []),
    `TOTAL PAID: ${money(session.amount_total)}`, "",
    `Customer: ${cust.name || ""} <${cust.email || ""}>${cust.phone ? " " + cust.phone : ""}`,
    `Stripe: ${dash}`
  ].join("\n");

  return {
    subject: `New order ${orderNo}: ${count} item${count === 1 ? "" : "s"}, ${money(session.amount_total)} to ${(ship.name || cust.name || "customer")}${a.state ? ", " + a.state : ""}`,
    html, text, replyTo: cust.email
  };
}


async function sendEmail(env, msg) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "CMA Precision Orders <onboarding@resend.dev>",
      to: [env.ORDER_EMAIL || "cmaprecision27@gmail.com"],
      subject: msg.subject, html: msg.html, text: msg.text,
      ...(msg.replyTo ? { reply_to: msg.replyTo } : {})
    })
  });
  if (!res.ok) throw new Error("Email failed: " + res.status + " " + (await res.text()));
}

export async function onRequestPost({ request, env }) {
  const raw = await request.text();
  const ok = await verifyStripeSignature(raw, request.headers.get("stripe-signature"), (env.STRIPE_WEBHOOK_SECRET || "").trim());
  if (!ok) return new Response("Bad signature", { status: 400 });
  let evt; try { evt = JSON.parse(raw); } catch (e) { return new Response("Bad body", { status: 400 }); }
  if (evt.type !== "checkout.session.completed") return new Response("ignored");
  const session = evt.data.object;
  if (session.payment_status !== "paid") return new Response("not paid yet");
  try {
    const items = await stripe(env, "GET", "checkout/sessions/" + session.id + "/line_items?limit=100");
    await sendEmail(env, buildEmail(session, items.data));
    return new Response("sent");
  } catch (err) {
    console.error(err);
    return new Response("Could not send order email", { status: 500 }); // Stripe retries
  }
}

export { buildEmail };
