// POST /api/auth
//   { action: "options" }                       -> challenge + which passkeys exist (for the lock screen)
//   { action: "register", pin, ... }             -> connect this phone's passkey (needs ADMIN_PIN once)
//   { action: "login", ... }                     -> fingerprint / phone PIN check -> session token
//   { action: "devices" } (signed in)            -> list connected devices
//   { action: "remove", id } (signed in)         -> disconnect a device
import { json } from "../../lib/shop.js";
import { newChallenge, registerPasskey, loginPasskey, requireSession, rpIdFor } from "../../lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.SETTINGS) return json(500, { error: "Settings storage isn't connected yet." });
  let body = {};
  try { body = await request.json(); } catch (e) {}
  const creds = (await env.SETTINGS.get("passkeys", "json")) || [];
  switch (body.action) {
    case "options":
      return json(200, { challenge: await newChallenge(env), rpId: rpIdFor(request), credentialIds: creds.map(c => c.id) }, { "Cache-Control": "no-store" });
    case "register": return registerPasskey(env, request, body);
    case "login": return loginPasskey(env, request, body);
    case "devices": {
      const bad = await requireSession(env, request); if (bad) return bad;
      return json(200, { devices: creds.map(c => ({ id: c.id, name: c.name, added: c.added })) }, { "Cache-Control": "no-store" });
    }
    case "remove": {
      const bad = await requireSession(env, request); if (bad) return bad;
      const next = creds.filter(c => c.id !== body.id);
      if (next.length === creds.length) return json(404, { error: "Device not found." });
      await env.SETTINGS.put("passkeys", JSON.stringify(next));
      return json(200, { ok: true });
    }
  }
  return json(400, { error: "Unknown action." });
}
