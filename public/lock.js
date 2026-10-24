/* CMA app lock: fingerprint / face / phone screen-lock sign-in (passkeys).
   Include with <script src="/lock.js"></script> right after <body>. The page's <main> stays hidden until unlocked.
   Pages use cmaAuth.fetch(url, options) for private requests, and listen for the "cma-unlocked" event. */
(function () {
  const RELOCK_MIN = 5;
  const css = `
  body:not(.cma-unlocked) main { display: none !important; }
  .cma-lock { position: fixed; inset: 0; z-index: 100; background: #0b0b0b; color: #f5f3f3; display: grid; place-items: center;
    padding: calc(24px + env(safe-area-inset-top, 0px)) max(20px, env(safe-area-inset-right, 0px)) calc(24px + env(safe-area-inset-bottom, 0px)) max(20px, env(safe-area-inset-left, 0px));
    font: 16px/1.5 "IBM Plex Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .cma-lock[hidden] { display: none !important; }
  .cma-lock .box { width: min(360px, 100%); display: grid; gap: 14px; justify-items: center; text-align: center; }
  .cma-lock .mark { width: 54px; height: 145px; background: #c81818; -webkit-mask: url(/art/skull.png) center / contain no-repeat; mask: url(/art/skull.png) center / contain no-repeat; }
  .cma-lock h1 { margin: 0; font: 400 30px/1.05 "Pirata One", "Old English Text MT", Georgia, serif; text-transform: uppercase; letter-spacing: .04em; }
  .cma-lock p { margin: 0; color: #a49c9c; font-size: 14.5px; }
  .cma-lock button { width: 100%; border: 0; border-radius: 8px; padding: 15px; font: 600 17px inherit; font-family: inherit; background: #8a0b0b; color: #fff; cursor: pointer; }
  .cma-lock button.link { background: none; color: #a49c9c; font-size: 14px; padding: 6px; text-decoration: underline; }
  .cma-lock button:disabled { opacity: .55; }
  .cma-lock input { width: 100%; font: 16px inherit; font-family: inherit; color: #f5f3f3; background: #161313; border: 1px solid #2c2424; border-radius: 8px; padding: 13px 12px; text-align: center; }
  .cma-lock input:focus { outline: 2px solid #c81818; outline-offset: 1px; }
  .cma-lock .err { color: #ff8b8b; font-size: 14px; min-height: 1.2em; }
  .cma-lock .setup { display: grid; gap: 10px; width: 100%; }
  .cma-lockbtn { background: none; border: 1px solid #2c2424; color: #a49c9c; border-radius: 6px; padding: 6px 10px; font: 500 13px inherit; cursor: pointer; }`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const b64u = {
    enc: buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    dec: s => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
  };
  const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) {} } };
  try { localStorage.removeItem("cma-admin-pin"); } catch (e) {}   // the PIN is no longer kept on the phone

  const app = document.title.replace(/^CMA\s*/i, "") || "App";
  const el = document.createElement("div");
  el.className = "cma-lock"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Unlock");
  el.innerHTML = `<div class="box">
    <span class="mark" aria-hidden="true"></span>
    <h1>CMA ${app}</h1>
    <p id="cmaLockText">Locked. Only you can open this.</p>
    <button type="button" id="cmaUnlock">Unlock</button>
    <div class="setup" id="cmaSetup" hidden>
      <p>First time on this phone: type your ADMIN_PIN once to connect your fingerprint or phone PIN. You won't need it again here.</p>
      <input type="password" id="cmaPin" placeholder="ADMIN_PIN" autocomplete="current-password" aria-label="ADMIN_PIN">
      <button type="button" id="cmaConnect">Connect this phone</button>
    </div>
    <button type="button" class="link" id="cmaShowSetup">Set up this phone</button>
    <div class="err" id="cmaErr" role="alert"></div>
  </div>`;
  const $ = id => document.getElementById(id);
  const err = t => { $("cmaErr").textContent = t || ""; };

  function tokenOk() {
    const t = ss.get("cma-token"), exp = Number(ss.get("cma-token-exp") || 0);
    return t && exp > Date.now() ? t : null;
  }
  function unlocked(token, minutes) {
    if (token) { ss.set("cma-token", token); ss.set("cma-token-exp", String(Date.now() + (minutes || 120) * 60000 - 60000)); }
    el.hidden = true; document.body.classList.add("cma-unlocked");
    window.dispatchEvent(new CustomEvent("cma-unlocked"));
  }
  function lock(msg) {
    ss.set("cma-token", null); ss.set("cma-token-exp", null);
    document.body.classList.remove("cma-unlocked"); el.hidden = false;
    $("cmaLockText").textContent = msg || "Locked. Only you can open this.";
    err("");
  }
  async function api(body) {
    const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(d.error || "Something went wrong (" + r.status + ")."); e.data = d; throw e; }
    return d;
  }
  const supported = () => !!(window.PublicKeyCredential && navigator.credentials);

  async function unlock() {
    if (!supported()) return err("This browser can't use fingerprint sign-in. Open the app in Chrome.");
    $("cmaUnlock").disabled = true; err("");
    try {
      const o = await api({ action: "options" });
      if (!o.credentialIds.length) { showSetup(); throw new Error("Set up this phone first."); }
      const cred = await navigator.credentials.get({ publicKey: {
        challenge: b64u.dec(o.challenge), rpId: o.rpId, userVerification: "required", timeout: 60000,
        allowCredentials: o.credentialIds.map(id => ({ type: "public-key", id: b64u.dec(id) }))
      } });
      const r = cred.response;
      const d = await api({ action: "login", challenge: o.challenge, credentialId: b64u.enc(cred.rawId),
        clientDataJSON: b64u.enc(r.clientDataJSON), authenticatorData: b64u.enc(r.authenticatorData), signature: b64u.enc(r.signature) });
      unlocked(d.token, d.minutes);
    } catch (e) {
      if (e.name === "NotAllowedError") err("Unlock didn't finish. Tap Unlock to try again. On a new phone, tap \"Set up this phone\" first.");
      else if (e.data && e.data.unknown) { showSetup(); err(e.message); }
      else if (e.message !== "Set up this phone first.") err(e.message);
    } finally { $("cmaUnlock").disabled = false; }
  }
  function showSetup() { $("cmaSetup").hidden = false; $("cmaShowSetup").hidden = true; $("cmaPin").focus(); }
  async function connect() {
    const pin = $("cmaPin").value.trim();
    if (!pin) return err("Type your ADMIN_PIN.");
    if (!supported()) return err("This browser can't use fingerprint sign-in. Open the app in Chrome.");
    $("cmaConnect").disabled = true; err("");
    try {
      const o = await api({ action: "options" });
      const cred = await navigator.credentials.create({ publicKey: {
        challenge: b64u.dec(o.challenge), rp: { id: o.rpId, name: "CMA Precision" },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "john@cmaprecision", displayName: "CMA Precision (John)" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
        excludeCredentials: o.credentialIds.map(id => ({ type: "public-key", id: b64u.dec(id) })), timeout: 60000, attestation: "none"
      } });
      const r = cred.response;
      const pk = r.getPublicKey && r.getPublicKey();
      if (!pk) throw new Error("This browser is too old for fingerprint sign-in. Update Chrome and try again.");
      const name = (navigator.userAgentData && navigator.userAgentData.platform) || (/Android/.test(navigator.userAgent) ? "Android phone" : "Device");
      const d = await api({ action: "register", pin, challenge: o.challenge, credentialId: b64u.enc(cred.rawId),
        publicKey: b64u.enc(pk), alg: r.getPublicKeyAlgorithm(), clientDataJSON: b64u.enc(r.clientDataJSON), deviceName: name + " · " + new Date().toLocaleDateString() });
      $("cmaPin").value = ""; $("cmaSetup").hidden = true; $("cmaShowSetup").hidden = false;
      unlocked(d.token, d.minutes);
    } catch (e) {
      if (e.name === "InvalidStateError") err("This phone is already connected. Tap Unlock.");
      else if (e.name === "NotAllowedError") err("Setup was cancelled. Try again.");
      else err(e.message);
    } finally { $("cmaConnect").disabled = false; }
  }
  function boot() {
    $("cmaUnlock").addEventListener("click", unlock);
    $("cmaShowSetup").addEventListener("click", showSetup);
    $("cmaConnect").addEventListener("click", connect);
    $("cmaPin").addEventListener("keydown", e => { if (e.key === "Enter") connect(); });
    if (tokenOk()) unlocked(); else lock();
    let hiddenAt = 0;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > RELOCK_MIN * 60000) lock("Locked after 5 minutes away.");
    });
  }

  const mount = () => { if (!document.body) return setTimeout(mount, 0); document.body.appendChild(el); boot(); };

  window.cmaAuth = {
    token: tokenOk,
    lock,
    async fetch(url, opt = {}) {
      const t = tokenOk();
      if (!t) { lock("Your session ended. Unlock again."); throw new Error("Locked."); }
      const r = await fetch(url, { ...opt, headers: { ...(opt.headers || {}), Authorization: "Bearer " + t } });
      if (r.status === 401) { const d = await r.clone().json().catch(() => ({})); if (d.locked) lock(d.error); }
      return r;
    }
  };
  mount();
})();
