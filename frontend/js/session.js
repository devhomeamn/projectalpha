/* session.js
   Drop-in session manager for Project Alpha (vanilla JS).
   Features:
   - Idle logout (default 30 min)
   - ✅ Idle warning toast before logout (default 5 min before)
   - JWT expiry logout (if token has exp)
   - ✅ JWT expiry warning toast (default 5 min before expiry)
   - Cross-tab sync (logout in one tab logs out others)
   - Uses window.showToast if available (silent fallback)
*/

(function () {
  "use strict";

  // ====== CONFIG (edit as you like) ======
  const DEFAULTS = {
    idleTimeoutMs: 30 * 60 * 1000,     // 30 minutes
    idleWarnBeforeMs: 5 * 60 * 1000,   // ✅ warn 5 minutes before idle logout

    warnBeforeMs: 5 * 60 * 1000,       // ✅ warn 5 minutes before token expiry (if possible)

    logoutUrl: "login.html",
    storageTokenKey: "token",
    storageLastActiveKey: "last_active_ts",
    storageLogoutSignalKey: "logout_signal_ts",
    activityEvents: ["mousemove", "keydown", "click", "scroll", "touchstart"],
  };

  // ====== HELPERS ======
  function now() {
    return Date.now();
  }

  function safeShowToast(msg, type = "warn") {
    try {
      if (typeof window.showToast === "function") return window.showToast(msg, type);
    } catch {}
    // fallback (quiet): no alert, no console spam
  }

  function redirectToLogin(logoutUrl) {
    try {
      localStorage.clear();
    } catch {}
    window.location.href = logoutUrl || DEFAULTS.logoutUrl;
  }

  function parseJwt(token) {
    try {
      const part = token.split(".")[1];
      if (!part) return null;
      // base64url -> base64
      const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(b64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function getToken(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function setLS(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {}
  }

  function getLSNumber(key, fallback = 0) {
    try {
      const v = localStorage.getItem(key);
      const n = v ? Number(v) : fallback;
      return Number.isFinite(n) ? n : fallback;
    } catch {
      return fallback;
    }
  }

  // ====== CORE ======
  function startSession(options = {}) {
    const cfg = { ...DEFAULTS, ...options };

    let idleTimer = null;
    let idleWarnTimer = null;

    let expiryTimer = null;
    let warnTimer = null;

    function signalLogout(reason = "logout") {
      // notify other tabs
      setLS(cfg.storageLogoutSignalKey, now());
      doLogout(reason);
    }

    function doLogout(reason = "logout") {
      safeShowToast(
        reason === "idle"
          ? "⏳ Session expired due to inactivity"
          : "⏳ Session expired. Please login again.",
        "warn"
      );
      // small delay so toast can render if available
      setTimeout(() => redirectToLogin(cfg.logoutUrl), 700);
    }

    // ✅ schedule warning before idle logout
    function scheduleIdleWarning() {
      if (idleWarnTimer) clearTimeout(idleWarnTimer);

      const warnIn = cfg.idleTimeoutMs - cfg.idleWarnBeforeMs;
      // if timeout smaller than warn window, don't warn
      if (!Number.isFinite(warnIn) || warnIn <= 0) return;

      idleWarnTimer = setTimeout(() => {
        safeShowToast("⚠️ You will be logged out in 5 minutes due to inactivity. Move mouse / press any key to stay logged in.", "warn");
      }, warnIn);
    }

    function resetIdleTimer() {
      if (idleTimer) clearTimeout(idleTimer);

      setLS(cfg.storageLastActiveKey, now());

      // ✅ re-arm idle warning every time activity happens
      scheduleIdleWarning();

      idleTimer = setTimeout(() => {
        signalLogout("idle");
      }, cfg.idleTimeoutMs);
    }

    function setupIdleTracking() {
      cfg.activityEvents.forEach((evt) => {
        document.addEventListener(evt, resetIdleTimer, { passive: true });
      });

      // If user reopens a tab after long time, enforce immediately
      const lastActive = getLSNumber(cfg.storageLastActiveKey, now());
      const elapsed = now() - lastActive;
      if (elapsed >= cfg.idleTimeoutMs) {
        // immediate logout
        signalLogout("idle");
        return;
      }

      resetIdleTimer();
    }

    function setupTokenExpiryWatcher() {
      const token = getToken(cfg.storageTokenKey);
      if (!token) return;

      const payload = parseJwt(token);
      const expSec = payload && payload.exp ? Number(payload.exp) : 0;
      if (!expSec || !Number.isFinite(expSec)) return;

      const expMs = expSec * 1000;
      const remaining = expMs - now();

      if (remaining <= 0) {
        signalLogout("expired");
        return;
      }

      // Clear previous timers
      if (expiryTimer) clearTimeout(expiryTimer);
      if (warnTimer) clearTimeout(warnTimer);

      // Optional warning before expiry
      const warnAt = remaining - cfg.warnBeforeMs;
      if (warnAt > 0) {
        warnTimer = setTimeout(() => {
          safeShowToast("⚠️ Session will expire in 5 minutes. Save your work.", "warn");
        }, warnAt);
      }

      // Logout at expiry
      expiryTimer = setTimeout(() => {
        signalLogout("expired");
      }, remaining);
    }

    function setupCrossTabSync() {
      window.addEventListener("storage", (e) => {
        if (!e) return;

        // Another tab triggered logout
        if (e.key === cfg.storageLogoutSignalKey && e.newValue) {
          doLogout("expired");
        }

        // Another tab refreshed token: re-arm expiry timer
        if (e.key === cfg.storageTokenKey) {
          setupTokenExpiryWatcher();
        }

        // Another tab activity: keep idle aligned
        if (e.key === cfg.storageLastActiveKey) {
          const lastActive = getLSNumber(cfg.storageLastActiveKey, now());
          const elapsed = now() - lastActive;
          if (elapsed >= cfg.idleTimeoutMs) signalLogout("idle");
          else resetIdleTimer();
        }
      });
    }

    // Don’t start if already on login page (optional)
    const page = (window.location.pathname || "").toLowerCase();
    if (page.endsWith("/login.html") || page.endsWith("login.html")) return;

    // Start
    setupCrossTabSync();
    setupIdleTracking();
    setupTokenExpiryWatcher();

    // Expose minimal API (optional)
    window.Session = {
      refresh: () => {
        resetIdleTimer();
        setupTokenExpiryWatcher();
      },
      logout: () => signalLogout("manual"),
      config: cfg,
    };
  }

  // Auto-start with defaults
  startSession();

  // If you want manual start instead, comment the auto-start above and call:
  // window.startSession = startSession;
})();
