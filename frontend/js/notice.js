// notice.js
(function () {
  "use strict";

  function getToken() {
    try { return localStorage.getItem("token") || ""; } catch { return ""; }
  }
  function getUsername() {
    try { return localStorage.getItem("username") || "user"; } catch { return "user"; }
  }

  function showToastSafe(msg, type = "warn") {
    try {
      if (typeof window.showToast === "function") return window.showToast(msg, type);
    } catch {}
  }

  function normalizeApiBase(apiBaseFromServer) {
    let base = (apiBaseFromServer || window.location.origin || "").trim();
    if (base.endsWith("/")) base = base.slice(0, -1);
    if (base.toLowerCase().endsWith("/api")) return base;
    return `${base}/api`;
  }

  async function getApiBase() {
    if (window.API_BASE && typeof window.API_BASE === "string") return window.API_BASE;
    try {
      const data = await fetch("/api/config").then((r) => r.json());
      window.API_BASE = normalizeApiBase(data.apiBase);
      return window.API_BASE;
    } catch {
      window.API_BASE = normalizeApiBase(null);
      return window.API_BASE;
    }
  }

  async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = { ...(options.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      showToastSafe("Session expired. Please login again.", "error");
      try { localStorage.clear(); } catch {}
      setTimeout(() => (window.location.href = "login.html"), 700);
      throw new Error("Unauthorized");
    }
    return res;
  }

  function ensureStyles() {
    if (document.getElementById("notice-modal-styles")) return;
    const s = document.createElement("style");
    s.id = "notice-modal-styles";
    s.textContent = `
      .notice-backdrop{
        position:fixed; inset:0;
        background: rgba(0,0,0,.45);
        display:flex; align-items:center; justify-content:center;
        z-index: 99999;
        padding: 18px;
      }
      .notice-modal{
        width: min(560px, 96vw);
        background:#fff;
        border-radius: 18px;
        box-shadow: 0 18px 50px rgba(0,0,0,.22);
        overflow:hidden;
        border: 1px solid rgba(0,0,0,.06);
      }
      .notice-head{
        display:flex; align-items:center; gap:12px;
        padding: 16px 18px;
        border-bottom: 1px solid #eef2f7;
      }
      .notice-icon{
        width:42px; height:42px;
        border-radius: 14px;
        display:flex; align-items:center; justify-content:center;
        font-size: 20px;
        background: rgba(59,130,246,.12);
        border: 1px solid rgba(59,130,246,.18);
        flex: 0 0 42px;
      }
      .notice-icon.warn{ background: rgba(245,158,11,.14); border-color: rgba(245,158,11,.2); }
      .notice-icon.urgent{ background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.2); }

      .notice-title{ font-weight: 800; font-size: 16px; color:#111827; margin:0; }
      .notice-meta{ font-size: 12px; color:#6b7280; margin-top:2px; }

      .notice-body{ padding: 14px 18px 6px; color:#111827; }
      .notice-message{ white-space: pre-wrap; line-height: 1.45; font-size: 14px; }

      .notice-actions{
        padding: 12px 18px 16px;
        display:flex; justify-content:flex-end; gap:10px;
      }
      .notice-btn{
        border: 1px solid #e5e7eb;
        background:#fff;
        padding: 9px 14px;
        border-radius: 12px;
        font-weight: 800;
        cursor: pointer;
      }
      .notice-btn.primary{
        background:#111827; color:#fff; border-color:#111827;
      }
    `;
    document.head.appendChild(s);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function iconForType(type) {
    const t = (type || "info").toLowerCase();
    if (t === "urgent") return "⚠️";
    if (t === "warn") return "ℹ️";
    return "📢";
  }

  // ✅ export this for admin "Test popup now"
  function showNoticePopup(notice, rememberDismiss = true) {
    ensureStyles();

    const type = (notice.type || "info").toLowerCase();
    const backdrop = document.createElement("div");
    backdrop.className = "notice-backdrop";

    backdrop.innerHTML = `
      <div class="notice-modal" role="dialog" aria-modal="true">
        <div class="notice-head">
          <div class="notice-icon ${type}">${iconForType(type)}</div>
          <div style="min-width:0;">
            <p class="notice-title">${escapeHtml(notice.title || "Notice")}</p>
            <div class="notice-meta">Admin announcement</div>
          </div>
        </div>

        <div class="notice-body">
          <div class="notice-message">${escapeHtml(notice.message || "")}</div>
        </div>

        <div class="notice-actions">
          <button class="notice-btn" data-action="close">Close</button>
          <button class="notice-btn primary" data-action="ok">OK</button>
        </div>
      </div>
    `;

    const dismissKey = `dismissed_notice_${getUsername()}`;
    const sig = `${notice.id || "tmp"}:${notice.version || 1}`;

    function close() {
      if (rememberDismiss) {
        try { localStorage.setItem(dismissKey, sig); } catch {}
      }
      backdrop.remove();
    }

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });

    backdrop.querySelector('[data-action="close"]')?.addEventListener("click", close);
    backdrop.querySelector('[data-action="ok"]')?.addEventListener("click", close);

    window.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") close();
      },
      { once: true }
    );

    document.body.appendChild(backdrop);
  }

  async function run() {
    // login.html এ চলবে না
    const p = (window.location.pathname || "").toLowerCase();
    if (p.endsWith("login.html")) return;

    const token = getToken();
    if (!token) return; // not logged-in

    const apiBase = await getApiBase();
    const res = await authFetch(`${apiBase}/notices/active`);
    const notice = await res.json();

    if (!notice || !notice.id || !notice.version) return;

    const dismissKey = `dismissed_notice_${getUsername()}`;
    let seen = "";
    try { seen = localStorage.getItem(dismissKey) || ""; } catch {}

    const currentSig = `${notice.id}:${notice.version}`;
    if (seen === currentSig) return;

    showNoticePopup(notice, true);
  }

  // expose for admin preview
  window.NoticePopup = { show: showNoticePopup };

  document.addEventListener("DOMContentLoaded", run);
})();
