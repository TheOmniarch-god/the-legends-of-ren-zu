(function () {
  const STYLE_ID = "renzu-auth-dropin-style";
  const ROOT_ID = "renzu-auth-dropin-root";
  const MODAL_ID = "rz-auth-modal-root";

  const FATE_SPIDER_SVG = `
    <svg class="rz-fate-spider" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="rzSpiderGlow" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stop-color="#fff4d6"/>
          <stop offset="48%" stop-color="#d8a34d"/>
          <stop offset="100%" stop-color="#7b5522"/>
        </radialGradient>
      </defs>
      <path class="rz-spider-web" d="M32 6 C32 16 32 22 32 27 M16 10 C23 17 27 22 29 27 M48 10 C41 17 37 22 35 27" />
      <circle class="rz-spider-head" cx="32" cy="25" r="6" />
      <ellipse class="rz-spider-body" cx="32" cy="39" rx="9" ry="12" />
      <path class="rz-spider-legs" d="M26 30 C17 26 11 22 6 16 M38 30 C47 26 53 22 58 16" />
      <path class="rz-spider-legs" d="M24 36 C15 35 9 36 3 39 M40 36 C49 35 55 36 61 39" />
      <path class="rz-spider-legs" d="M25 43 C17 48 12 53 8 59 M39 43 C47 48 52 53 56 59" />
      <path class="rz-spider-mark" d="M32 31 L35 38 L32 48 L29 38 Z" />
    </svg>
  `;

  let supabaseClient = null;
  let session = null;
  let currentUser = null;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .rz-auth-root {
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 99997;
        font-family: Georgia, serif;
      }

      .rz-auth-button {
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(12,10,8,0.88);
        color: #f7ead0;
        border-radius: 999px;
        padding: 10px 14px;
        font-size: 12px;
        letter-spacing: 0.08em;
        cursor: pointer;
        box-shadow: 0 8px 32px rgba(0,0,0,0.35);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
      }

      .rz-auth-button:hover {
        background: rgba(22,18,12,0.96);
        border-color: rgba(255,220,150,0.32);
        transform: translateY(-1px);
      }

      .rz-auth-button-bound {
        width: 44px;
        height: 44px;
        padding: 0;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background:
          radial-gradient(circle at 50% 30%, rgba(255,244,214,0.20), rgba(216,163,77,0.10) 42%, rgba(12,10,8,0.90) 100%);
        border-color: rgba(255,220,150,0.28);
        box-shadow:
          0 8px 32px rgba(0,0,0,0.38),
          0 0 22px rgba(216,163,77,0.22),
          inset 0 1px 0 rgba(255,255,255,0.08);
      }

      .rz-auth-button-bound:hover {
        background:
          radial-gradient(circle at 50% 30%, rgba(255,244,214,0.28), rgba(216,163,77,0.16) 45%, rgba(12,10,8,0.95) 100%);
        box-shadow:
          0 10px 36px rgba(0,0,0,0.45),
          0 0 30px rgba(216,163,77,0.32),
          inset 0 1px 0 rgba(255,255,255,0.10);
      }

      .rz-fate-spider {
        width: 24px;
        height: 24px;
        overflow: visible;
        filter: drop-shadow(0 0 7px rgba(216,163,77,0.55));
      }

      .rz-fate-spider .rz-spider-head,
      .rz-fate-spider .rz-spider-body,
      .rz-fate-spider .rz-spider-mark {
        fill: url(#rzSpiderGlow);
      }

      .rz-fate-spider .rz-spider-web,
      .rz-fate-spider .rz-spider-legs {
        fill: none;
        stroke: #d8a34d;
        stroke-width: 3.2;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: 0.92;
      }

      .rz-fate-spider .rz-spider-web {
        stroke-width: 2;
        opacity: 0.55;
      }

      .rz-fate-spider .rz-spider-mark {
        opacity: 0.9;
        filter: drop-shadow(0 0 4px rgba(255,244,214,0.6));
      }

      .rz-auth-backdrop {
        position: fixed;
        right: 14px;
        bottom: 64px;
        z-index: 99998;
        width: min(420px, calc(100vw - 24px));
        background: transparent;
        display: block;
        padding: 0;
        font-family: Georgia, serif;
      }

      .rz-auth-modal {
        width: 100%;
        border-radius: 24px;
        border: 1px solid rgba(255,220,150,0.24);
        background:
          radial-gradient(circle at 50% 0%, rgba(255,220,150,0.12), transparent 34%),
          linear-gradient(180deg, rgba(18,14,10,0.98), rgba(7,6,5,0.98));
        color: #f7ead0;
        box-shadow: 0 22px 80px rgba(0,0,0,0.65);
        overflow: hidden;
        animation: rzAuthRise 0.18s ease both;
      }

      @keyframes rzAuthRise {
        from {
          opacity: 0;
          transform: translateY(10px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes rzAuthSheetRise {
        from {
          opacity: 0;
          transform: translateY(26px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .rz-auth-head {
        padding: 22px 24px 14px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }

      .rz-auth-kicker {
        font-size: 9px;
        letter-spacing: 0.24em;
        text-transform: uppercase;
        color: rgba(255,230,180,0.58);
        margin-bottom: 8px;
      }

      .rz-auth-title {
        font-size: 22px;
        line-height: 1.15;
        font-weight: 700;
        color: #fff4d6;
      }

      .rz-auth-body {
        padding: 20px 24px 24px;
      }

      .rz-auth-text {
        font-size: 13px;
        line-height: 1.65;
        color: rgba(247,234,208,0.72);
        margin-bottom: 16px;
      }

      .rz-auth-input {
        width: 100%;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 14px;
        background: rgba(0,0,0,0.35);
        color: #fff7e6;
        padding: 12px 14px;
        outline: none;
        font-size: 14px;
        margin-bottom: 10px;
        box-sizing: border-box;
      }

      .rz-auth-input::placeholder {
        color: rgba(247,234,208,0.36);
      }

      .rz-auth-input:focus {
        border-color: rgba(255,220,150,0.45);
      }

      .rz-auth-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .rz-auth-primary,
      .rz-auth-secondary {
        border-radius: 12px;
        padding: 11px 14px;
        font-size: 12px;
        cursor: pointer;
        border: 1px solid rgba(255,255,255,0.12);
        font-family: Georgia, serif;
      }

      .rz-auth-primary {
        flex: 1;
        background: rgba(255,220,150,0.16);
        color: #fff4d6;
      }

      .rz-auth-primary:hover {
        background: rgba(255,220,150,0.24);
      }

      .rz-auth-secondary {
        background: transparent;
        color: rgba(247,234,208,0.68);
      }

      .rz-auth-secondary:hover {
        background: rgba(255,255,255,0.06);
      }

      .rz-auth-status {
        margin-top: 12px;
        font-size: 12px;
        line-height: 1.5;
        color: rgba(255,230,180,0.68);
      }

      .rz-auth-profile-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
        padding: 10px 0;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }

      .rz-auth-profile-row span:first-child {
        color: rgba(247,234,208,0.55);
      }

      .rz-auth-profile-row span:last-child {
        color: #fff4d6;
        text-align: right;
        overflow-wrap: anywhere;
      }

      .rz-auth-code-wrap {
        display: none;
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid rgba(255,255,255,0.08);
      }

      @media (max-width: 640px) {
        .rz-auth-root {
          right: 12px;
          bottom: max(12px, env(safe-area-inset-bottom, 12px));
        }

        .rz-auth-button {
          padding: 9px 12px;
          font-size: 11px;
        }

        .rz-auth-button-bound {
          width: 42px;
          height: 42px;
          padding: 0;
        }

        .rz-auth-backdrop {
          left: 0;
          right: 0;
          bottom: 0;
          width: auto;
          padding: 0 10px max(10px, env(safe-area-inset-bottom, 10px));
          pointer-events: none;
        }

        .rz-auth-modal {
          pointer-events: auto;
          border-radius: 24px 24px 18px 18px;
          max-height: min(78vh, 560px);
          overflow-y: auto;
          animation: rzAuthSheetRise 0.22s cubic-bezier(.2,.8,.25,1) both;
        }

        .rz-auth-head {
          padding: 18px 20px 12px;
        }

        .rz-auth-body {
          padding: 16px 20px 20px;
        }

        .rz-auth-title {
          font-size: 20px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getDeviceId() {
    try {
      let id = localStorage.getItem("renzu_device_id");

      if (!id) {
        id =
          "d-" +
          Math.random().toString(36).slice(2, 10) +
          "-" +
          Date.now().toString(36);

        localStorage.setItem("renzu_device_id", id);
      }

      return id;
    } catch (_) {
      return "d-" + Math.random().toString(36).slice(2) + Date.now();
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.supabase) return resolve();

      const existing = document.querySelector(`script[src="${src}"]`);

      if (existing) {
        existing.addEventListener("load", resolve);
        existing.addEventListener("error", reject);
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function initSupabase() {
    if (supabaseClient) return supabaseClient;

    await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");

    const res = await fetch("/api/public-config");
    const cfg = await res.json();

    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      throw new Error("Missing Supabase public config");
    }

    supabaseClient = window.supabase.createClient(
      cfg.supabaseUrl,
      cfg.supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    const { data } = await supabaseClient.auth.getSession();

    session = data.session || null;
    currentUser = session ? session.user : null;

    supabaseClient.auth.onAuthStateChange(async (_event, newSession) => {
      session = newSession || null;
      currentUser = session ? session.user : null;

      if (session) {
        await linkDevice();
      }

      renderButton();

      window.dispatchEvent(
        new CustomEvent("renzu-auth-change", {
          detail: {
            session,
            user: currentUser
          }
        })
      );
    });

    if (session) {
      await linkDevice();
    }

    return supabaseClient;
  }

  async function linkDevice() {
    if (!session || !session.access_token) return;

    const deviceId = getDeviceId();

    try {
      const res = await fetch("/api/link-device", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token
        },
        body: JSON.stringify({
          deviceId
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn("Device link failed:", data.error || res.status);
      }
    } catch (err) {
      console.warn("Device link failed:", err);
    }
  }

  function closeModal() {
    const modal = document.getElementById(MODAL_ID);

    if (modal) modal.remove();
  }

  function toggleModal() {
    const modal = document.getElementById(MODAL_ID);

    if (modal) {
      closeModal();
    } else {
      openModal();
    }
  }

  function openModal() {
    closeModal();

    const root = document.createElement("div");
    root.id = MODAL_ID;
    root.className = "rz-auth-backdrop";

    const loggedIn = !!currentUser;

    root.innerHTML = `
      <div class="rz-auth-modal">
        <div class="rz-auth-head">
          <div class="rz-auth-kicker">The Legends of Ren Zu</div>
          <div class="rz-auth-title">${
            loggedIn ? "Bound by Fate" : "Open the Archive"
          }</div>
        </div>

        <div class="rz-auth-body">
          ${
            loggedIn
              ? `
                <div class="rz-auth-text">
                  Your soul mark is now woven into The Omniarch. Your realm, essence, Gu collection, bookmarks, and progress can follow you across devices.
                </div>

                <div class="rz-auth-profile-row">
                  <span>Email</span>
                  <span>${escapeHtml(currentUser.email || "Unknown")}</span>
                </div>

                <div class="rz-auth-profile-row">
                  <span>User ID</span>
                  <span>${escapeHtml(currentUser.id.slice(0, 8))}…</span>
                </div>

                <div class="rz-auth-actions" style="margin-top:16px;">
                  <button class="rz-auth-secondary" id="rz-auth-close">Close</button>
                  <button class="rz-auth-primary" id="rz-auth-signout">Sign out</button>
                </div>

                <div class="rz-auth-status" id="rz-auth-status"></div>
              `
              : `
                <div class="rz-auth-text">
                  Enter your email. No password needed. The Omniarch will send your sacred code.
                </div>

                <input class="rz-auth-input" id="rz-auth-email" type="email" placeholder="you@example.com" />

                <div class="rz-auth-actions">
                  <button class="rz-auth-secondary" id="rz-auth-close">Cancel</button>
                  <button class="rz-auth-primary" id="rz-auth-send">Send code</button>
                </div>

                <div class="rz-auth-code-wrap" id="rz-auth-code-wrap">
                  <input class="rz-auth-input" id="rz-auth-code" type="text" inputmode="numeric" maxlength="8" placeholder="Enter sacred code" />

                  <div class="rz-auth-actions">
                    <button class="rz-auth-secondary" id="rz-auth-resend">Resend</button>
                    <button class="rz-auth-primary" id="rz-auth-verify">Open Archive</button>
                  </div>
                </div>

                <div class="rz-auth-status" id="rz-auth-status"></div>
              `
          }
        </div>
      </div>
    `;

    document.body.appendChild(root);

    const closeBtn = document.getElementById("rz-auth-close");

    if (closeBtn) {
      closeBtn.onclick = closeModal;
    }

    const signoutBtn = document.getElementById("rz-auth-signout");

    if (signoutBtn) {
      signoutBtn.onclick = signOut;
    }

    const sendBtn = document.getElementById("rz-auth-send");

    if (sendBtn) {
      sendBtn.onclick = sendLoginCode;
    }

    const resendBtn = document.getElementById("rz-auth-resend");

    if (resendBtn) {
      resendBtn.onclick = sendLoginCode;
    }

    const verifyBtn = document.getElementById("rz-auth-verify");

    if (verifyBtn) {
      verifyBtn.onclick = verifyLoginCode;
    }

    const codeInput = document.getElementById("rz-auth-code");

    if (codeInput) {
      codeInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          verifyLoginCode();
        }
      });
    }

    const emailInput = document.getElementById("rz-auth-email");

    if (emailInput) {
      emailInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          sendLoginCode();
        }
      });

      setTimeout(() => {
        try {
          emailInput.focus();
        } catch (_) {}
      }, 50);
    }
  }

  function setStatus(text) {
    const status = document.getElementById("rz-auth-status");

    if (status) {
      status.textContent = text || "";
    }
  }

  async function sendLoginCode() {
    const emailInput = document.getElementById("rz-auth-email");
    const email = emailInput ? emailInput.value.trim() : "";

    if (!email) {
      setStatus("Enter your email first.");
      return;
    }

    setStatus("The Omniarch is sending your code…");

    try {
      const client = await initSupabase();

      const redirectTo = window.location.origin + "/";

      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true
        }
      });

      if (error) throw error;

      const codeWrap = document.getElementById("rz-auth-code-wrap");

      if (codeWrap) {
        codeWrap.style.display = "block";
      }

      const codeInput = document.getElementById("rz-auth-code");

      if (codeInput) {
        setTimeout(() => {
          try {
            codeInput.focus();
          } catch (_) {}
        }, 50);
      }

      setStatus("Code sent by The Omniarch. Check your email.");
    } catch (err) {
      setStatus(err.message || "Could not send login code.");
    }
  }

  async function verifyLoginCode() {
    const emailInput = document.getElementById("rz-auth-email");
    const codeInput = document.getElementById("rz-auth-code");

    const email = emailInput ? emailInput.value.trim() : "";
    const token = codeInput ? codeInput.value.trim().replace(/\s+/g, "") : "";

    if (!email) {
      setStatus("Enter your email first.");
      return;
    }

    if (!token || token.length < 6) {
      setStatus("Enter the sacred code.");
      return;
    }

    setStatus("Opening the archive…");

    try {
      const client = await initSupabase();

      const { data, error } = await client.auth.verifyOtp({
        email,
        token,
        type: "email"
      });

      if (error) throw error;

      session = data.session || null;
      currentUser = data.user || (session ? session.user : null);

      if (session) {
        await linkDevice();
      }

      closeModal();
      renderButton();

      window.dispatchEvent(
        new CustomEvent("renzu-auth-change", {
          detail: {
            session,
            user: currentUser
          }
        })
      );
    } catch (err) {
      setStatus(err.message || "Invalid or expired code.");
    }
  }

  async function signOut() {
    setStatus("Severing the soul mark…");

    try {
      const client = await initSupabase();

      await client.auth.signOut({
        scope: "local"
      });

      session = null;
      currentUser = null;

      closeModal();
      renderButton();

      window.dispatchEvent(
        new CustomEvent("renzu-auth-change", {
          detail: {
            session: null,
            user: null
          }
        })
      );

      setTimeout(() => {
        renderButton();
      }, 100);
    } catch (err) {
      setStatus(err.message || "Could not sign out.");
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderButton() {
    injectStyle();

    let root = document.getElementById(ROOT_ID);

    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      root.className = "rz-auth-root";
      document.body.appendChild(root);
    }

    const isBound = !!currentUser;

    root.innerHTML = `
      <button
        class="rz-auth-button ${isBound ? "rz-auth-button-bound" : ""}"
        id="rz-auth-open"
        aria-label="${isBound ? "Soul Bound account" : "Login"}"
        title="${isBound ? "Soul Bound" : "Login"}"
      >
        ${isBound ? FATE_SPIDER_SVG : "Login"}
      </button>
    `;

    document.getElementById("rz-auth-open").onclick = toggleModal;
  }

  window.RenZuAuth = {
    init: initSupabase,

    getSession: function () {
      return session;
    },

    getUser: function () {
      return currentUser;
    },

    getAccessToken: async function () {
      await initSupabase();

      const { data } = await supabaseClient.auth.getSession();

      return data.session ? data.session.access_token : null;
    },

    signOut
  };

  document.addEventListener("click", function (e) {
    const modal = document.getElementById(MODAL_ID);
    const root = document.getElementById(ROOT_ID);

    if (!modal) return;

    if (modal.contains(e.target)) return;
    if (root && root.contains(e.target)) return;

    closeModal();
  });

  document.addEventListener("DOMContentLoaded", async function () {
    renderButton();

    try {
      await initSupabase();
      renderButton();
    } catch (err) {
      console.warn("RenZuAuth init failed:", err);
    }
  });
})();
