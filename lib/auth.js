// Passkey (fingerprint / face / phone screen lock) sign-in for the CMA apps.
// ADMIN_PIN is only used once per device to connect a new passkey. After that, private
// endpoints need a short-lived session token that is issued after a passkey check.
import { json, checkPin } from "./shop.js";

const enc = new TextEncoder();
export const b64u = {
  enc: buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: s => { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
};
const sha256 = async data => new Uint8Array(await crypto.subtle.digest("SHA-256", typeof data === "string" ? enc.encode(data) : data));
const SESSION_MINUTES = 120;

export function rpIdFor(request) {
  const host = new URL(request.url).hostname;
  return host === "cmaprecision.com" || host.endsWith(".cmaprecision.com") ? "cmaprecision.com" : host;
}
const originOf = request => new URL(request.url).origin;

async function hmacKey(env) {
  let salt = await env.SETTINGS.get("authSalt");
  if (!salt) { salt = b64u.enc(crypto.getRandomValues(new Uint8Array(32))); await env.SETTINGS.put("authSalt", salt); }
  const raw = await sha256((env.ADMIN_PIN || "") + "|" + salt);
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function issueToken(env, credId) {
  const payload = b64u.enc(enc.encode(JSON.stringify({ exp: Date.now() + SESSION_MINUTES * 60000, cid: credId })));
  const sig = b64u.enc(await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(payload)));
  return payload + "." + sig;
}
/* Returns null when the request carries a valid session for a still-registered passkey, otherwise an error Response */
export async function requireSession(env, request) {
  if (!env.SETTINGS) return json(500, { error: "Settings storage isn't connected yet." });
  const h = request.headers.get("Authorization") || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [payload, sig] = tok.split(".");
  if (!payload || !sig) return json(401, { error: "Locked. Unlock the app with your fingerprint or phone PIN.", locked: true });
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", await hmacKey(env), b64u.dec(sig), enc.encode(payload)); } catch (e) {}
  if (!ok) return json(401, { error: "Locked. Unlock the app again.", locked: true });
  const data = JSON.parse(new TextDecoder().decode(b64u.dec(payload)));
  if (!data.exp || data.exp < Date.now()) return json(401, { error: "Your session ended. Unlock the app again.", locked: true });
  const creds = (await env.SETTINGS.get("passkeys", "json")) || [];
  if (!creds.some(c => c.id === data.cid)) return json(401, { error: "This device was removed. Set it up again.", locked: true });
  return null;
}

/* ---- challenges ---- */
export async function newChallenge(env) {
  const c = b64u.enc(crypto.getRandomValues(new Uint8Array(32)));
  await env.SETTINGS.put("chal:" + c, "1", { expirationTtl: 300 });
  return c;
}
async function useChallenge(env, c) {
  if (!c || !(await env.SETTINGS.get("chal:" + c))) return false;
  await env.SETTINGS.delete("chal:" + c);
  return true;
}
function checkClientData(clientDataB64, type, request) {
  const cd = JSON.parse(new TextDecoder().decode(b64u.dec(clientDataB64)));
  if (cd.type !== type) throw new Error("Wrong passkey step.");
  if (cd.origin !== originOf(request)) throw new Error("Passkey was made for a different website address.");
  return cd;
}

/* ECDSA signatures from authenticators are DER encoded; WebCrypto wants raw r||s */
function derToRaw(der) {
  let i = 2; if (der[1] & 0x80) i += der[1] & 0x7f;
  const read = () => { i++; let len = der[i++]; let v = der.slice(i, i + len); i += len; while (v.length > 32 && v[0] === 0) v = v.slice(1); const out = new Uint8Array(32); out.set(v, 32 - v.length); return out; };
  const r = read(), s = read(); const raw = new Uint8Array(64); raw.set(r, 0); raw.set(s, 32); return raw;
}
const ALGS = {
  "-7": { import: { name: "ECDSA", namedCurve: "P-256" }, verify: { name: "ECDSA", hash: "SHA-256" }, der: true },
  "-257": { import: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, verify: { name: "RSASSA-PKCS1-v1_5" } },
  "-8": { import: { name: "Ed25519" }, verify: { name: "Ed25519" } }
};

export async function registerPasskey(env, request, body) {
  const bad = await checkPin(env, body.pin);
  if (bad) return bad;
  if (!(await useChallenge(env, body.challenge))) return json(400, { error: "That took too long. Try again." });
  try {
    const cd = checkClientData(body.clientDataJSON, "webauthn.create", request);
    if (cd.challenge !== body.challenge) throw new Error("Challenge mismatch.");
    const alg = String(body.alg);
    if (!ALGS[alg]) throw new Error("This phone's passkey type isn't supported.");
    await crypto.subtle.importKey("spki", b64u.dec(body.publicKey), ALGS[alg].import, false, ["verify"]); // must be a valid key
    if (!/^[A-Za-z0-9_-]{16,1400}$/.test(body.credentialId || "")) throw new Error("Bad passkey id.");
  } catch (e) { return json(400, { error: e.message }); }
  const creds = (await env.SETTINGS.get("passkeys", "json")) || [];
  if (creds.length >= 10) return json(400, { error: "Too many devices. Remove one in CMA Settings first." });
  const name = String(body.deviceName || "Phone").replace(/[<>]/g, "").slice(0, 40);
  creds.push({ id: body.credentialId, spki: body.publicKey, alg: String(body.alg), count: 0, name, added: new Date().toISOString() });
  await env.SETTINGS.put("passkeys", JSON.stringify(creds));
  return json(200, { token: await issueToken(env, body.credentialId), minutes: SESSION_MINUTES }, { "Cache-Control": "no-store" });
}

export async function loginPasskey(env, request, body) {
  if (!(await useChallenge(env, body.challenge))) return json(400, { error: "That took too long. Try again." });
  const creds = (await env.SETTINGS.get("passkeys", "json")) || [];
  const cred = creds.find(c => c.id === body.credentialId);
  if (!cred) return json(401, { error: "This passkey isn't set up for the CMA apps. Set it up with your PIN.", unknown: true });
  try {
    const cd = checkClientData(body.clientDataJSON, "webauthn.get", request);
    if (cd.challenge !== body.challenge) throw new Error("Challenge mismatch.");
    const auth = b64u.dec(body.authenticatorData);
    const rpHash = await sha256(rpIdFor(request));
    if (!auth.slice(0, 32).every((b, i) => b === rpHash[i])) throw new Error("Passkey belongs to a different website.");
    const flags = auth[32];
    if (!(flags & 0x01) || !(flags & 0x04)) throw new Error("Your fingerprint or phone PIN wasn't confirmed.");
    const count = new DataView(auth.buffer, auth.byteOffset).getUint32(33);
    const signed = new Uint8Array(auth.length + 32); signed.set(auth, 0); signed.set(await sha256(b64u.dec(body.clientDataJSON)), auth.length);
    const a = ALGS[cred.alg];
    const key = await crypto.subtle.importKey("spki", b64u.dec(cred.spki), a.import, false, ["verify"]);
    let sig = b64u.dec(body.signature); if (a.der) sig = derToRaw(sig);
    if (!(await crypto.subtle.verify(a.verify, key, sig, signed))) throw new Error("Passkey check failed.");
    if (count !== 0 || cred.count !== 0) {
      if (count <= cred.count) throw new Error("This passkey looks copied. Remove it in CMA Settings and set it up again.");
      cred.count = count; await env.SETTINGS.put("passkeys", JSON.stringify(creds));
    }
  } catch (e) { return json(401, { error: e.message }); }
  return json(200, { token: await issueToken(env, cred.id), minutes: SESSION_MINUTES }, { "Cache-Control": "no-store" });
}
