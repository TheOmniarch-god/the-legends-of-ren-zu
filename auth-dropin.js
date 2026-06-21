(function () {
  const STYLE_ID = "renzu-auth-dropin-style";
  const ROOT_ID = "renzu-auth-dropin-root";

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
      }

      .rz-auth-button:hover {
        background: rgba(22,18,12,0.96);
      }

      .rz-auth-backdrop {
        position: fixed;
        inset: 0;
        z-index: 99998;
        background: rgba(0,0,0,0.58);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
      }

      .rz-auth-modal {
        width: min(420px, 94vw);
        border-radius: 24px;
        border: 1px solid rgba(255,220,150,0.24);
        background:
          radial-gradient(circle at 50% 0%, rgba(255,220,150,0.12), transparent 34%),
          linear-gradient(180deg, rgba(18,14,10,0.98), rgba(7,6,5,0.98));
        color: #f7ead0;
        box-shadow: 0 22px 80px rgba(0,0,0,0.65);
        overflow: hidden;
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
      }

      .rz-auth-primary {
        flex: 1;
        background: rgba(255,220,150,0.16);
        color: #fff4d6;
      }

      .rz-auth-secondary {
        background: transparent;
        color: rgba(247,234,208,0.68);
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
      }

      @media (max-width: 520px) {
        .rz-auth-root {
          right: 10px;
          bottom: 10px;
        }

        .rz-auth-button {
          padding: 9px 12px;
          font-size: 11px;
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
      await fetch("/api/link-device", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token
        },
        body: JSON.stringify({
          deviceId
        })
      });
    } catch (err) {
      console.warn("Device link failed:", err);
    }
  }

  function closeModal() {
    const modal = document.getElementById("rz-auth-modal-root");

    if (modal) modal.remove();
  }

  function openModal() {
    closeModal();

    const root = document.createElement("div");
    root.id = "rz-auth-modal-root";
    root.className = "rz-auth-backdrop";

    root.addEventListener("click", function (e) {
      if (e.target === root) closeModal();
    });

    const loggedIn = !!currentUser;

    root.innerHTML = `
      <div class="rz-auth-modal">
        <div class="rz-auth-head">
          <div class="rz-auth-kicker">The Legends of Ren Zu</div>
          <div class="rz-auth-title">${
            loggedIn ? "Your Account" : "Enter the aperture"
          }</div>
        </div>

        <div class="rz-auth-body">
          ${
            loggedIn
              ? `
                <div class="rz-auth-text">
Your soul mark is now bound to The Omniarch. Your essence, realm, Gu collection, bookmarks, and progress can follow you across devices.                </div>

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
                  Enter your email. No password needed. The Omniarch will send you a sacred login link.
                </div>

                <input class="rz-auth-input" id="rz-auth-email" type="email" placeholder="you@example.com" />

                <div class="rz-auth-actions">
                  <button class="rz-auth-secondary" id="rz-auth-close">Cancel</button>
                  <button class="rz-auth-primary" id="rz-auth-send">Send magic link</button>
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

    const sendBtn = document.getElementById("rz-auth-send");

    if (sendBtn) {
      sendBtn.onclick = sendMagicLink;
    }

    const signoutBtn = document.getElementById("rz-auth-signout");

    if (signoutBtn) {
      signoutBtn.onclick = signOut;
    }
  }

  function setStatus(text) {
    const status = document.getElementById("rz-auth-status");

    if (status) {
      status.textContent = text || "";
    }
  }

  async function sendMagicLink() {
    const emailInput = document.getElementById("rz-auth-email");
    const email = emailInput ? emailInput.value.trim() : "";

    if (!email) {
      setStatus("Enter your email first.");
      return;
    }

    setStatus("Sending magic link…");

    try {
      const client = await initSupabase();

      const redirectTo =
        window.location.origin +
        window.location.pathname +
        window.location.hash;

      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true
        }
      });

      if (error) throw error;

      setStatus("Magic link sent. Check your email.");
    } catch (err) {
      setStatus(err.message || "Could not send magic link.");
    }
  }

  async function signOut() {
    setStatus("Signing out…");

    try {
      const client = await initSupabase();

      await client.auth.signOut();

      session = null;
      currentUser = null;

      closeModal();
      renderButton();
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

    root.innerHTML = `
      <button class="rz-auth-button" id="rz-auth-open">
        ${currentUser ? "Account ✓" : "Login"}
      </button>
    `;

    document.getElementById("rz-auth-open").onclick = openModal;
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
