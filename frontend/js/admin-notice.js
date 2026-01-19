// admin-notice.js
(function () {
  "use strict";

  function getToken() { return localStorage.getItem("token") || ""; }
  function getRole() { return (localStorage.getItem("role") || "").toLowerCase(); }
  function getUsername() { return localStorage.getItem("username") || "Admin"; }

  function toast(msg, type = "success") {
    if (typeof window.showToast === "function") return window.showToast(msg, type);
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText =
      "position:fixed;top:18px;right:18px;background:#111827;color:#fff;padding:10px 14px;border-radius:12px;z-index:99999;font-weight:900;";
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  function normalizeApiBase(apiBaseFromServer) {
    let base = (apiBaseFromServer || window.location.origin || "").trim();
    if (base.endsWith("/")) base = base.slice(0, -1);
    if (base.toLowerCase().endsWith("/api")) return base;
    return `${base}/api`;
  }

  async function getApiBase() {
    if (window.API_BASE) return window.API_BASE;
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
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      toast("Session expired. Please login again.", "error");
      localStorage.clear();
      setTimeout(() => (window.location.href = "login.html"), 700);
      throw new Error("Unauthorized");
    }
    if (res.status === 403) {
      toast("Access denied (Admin only).", "error");
      throw new Error("Forbidden");
    }
    return res;
  }

  function setPill(active) {
    const pill = document.getElementById("activePill");
    if (!pill) return;
    pill.classList.remove("on", "off");
    if (active) {
      pill.classList.add("on");
      pill.textContent = "ACTIVE";
    } else {
      pill.classList.add("off");
      pill.textContent = "INACTIVE";
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderPreview(n) {
    const box = document.getElementById("previewBox");
    if (!box) return;

    if (!n) {
      box.innerHTML = `<div class="preview-empty">No active notice found.</div>`;
      setPill(false);
      return;
    }

    setPill(true);
    box.innerHTML = `
      <div class="preview-card">
        <div class="preview-title">${escapeHtml(n.title || "Notice")}</div>
        <div class="preview-meta">Type: ${escapeHtml(n.type || "info")} • Version: ${n.version ?? "-"}</div>
        <div class="preview-msg">${escapeHtml(n.message || "")}</div>
      </div>
    `;
  }

  function fillForm(n) {
    document.getElementById("title").value = n?.title || "";
    document.getElementById("message").value = n?.message || "";
    document.getElementById("type").value = (n?.type || "info").toLowerCase();
    document.getElementById("is_active").checked = n ? true : true;
    document.getElementById("updated_by").value = getUsername();
  }

  async function loadActive() {
    const API_BASE = await getApiBase();
    const res = await authFetch(`${API_BASE}/notices/active`);
    const notice = await res.json();
    renderPreview(notice);
    fillForm(notice);
    return notice;
  }

  async function saveNotice(e) {
    e.preventDefault();

    if (getRole() !== "admin") {
      toast("Admin only.", "error");
      return;
    }

    const title = document.getElementById("title").value.trim();
    const message = document.getElementById("message").value.trim();
    const type = document.getElementById("type").value;
    const is_active = document.getElementById("is_active").checked;
    const updated_by = document.getElementById("updated_by").value.trim() || getUsername();

    if (!title || !message) return toast("Title & message required", "error");

    const API_BASE = await getApiBase();
    const res = await authFetch(`${API_BASE}/notices/upsert`, {
      method: "POST",
      body: JSON.stringify({ title, message, type, is_active, updated_by }),
    });

    const out = await res.json();
    if (!res.ok) throw new Error(out?.error || "Failed to save");

    toast("✅ Notice saved");
    document.getElementById("hintText").textContent =
      "Saved. Version updated → all users will see the popup again after login.";
    await loadActive();
  }

  async function deactivate() {
    if (getRole() !== "admin") return toast("Admin only.", "error");

    const API_BASE = await getApiBase();
    const res = await authFetch(`${API_BASE}/notices/deactivate`, { method: "POST" });
    const out = await res.json();
    if (!res.ok) throw new Error(out?.error || "Failed to deactivate");

    toast("✅ Notice deactivated");
    document.getElementById("hintText").textContent = "Deactivated. Popup will stop showing.";
    await loadActive();
  }

  // ✅ Test popup now: show popup immediately (without storing dismiss)
  async function testPopupNow() {
    const title = document.getElementById("title").value.trim() || "Test Notice";
    const message = document.getElementById("message").value.trim() || "This is a test popup.";
    const type = document.getElementById("type").value || "info";

    // use the real popup renderer from notice.js if available
    if (window.NoticePopup && typeof window.NoticePopup.show === "function") {
      window.NoticePopup.show(
        { id: "test", version: 1, title, message, type },
        false // rememberDismiss = false
      );
      return;
    }

    toast("notice.js not loaded (Test popup needs notice.js)", "error");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!getToken()) return (window.location.href = "login.html");

    // admin-only page guard
    if (getRole() !== "admin") {
      toast("Access denied (Admin only).", "error");
      setTimeout(() => (window.location.href = "dashboard.html"), 900);
      return;
    }

    document.getElementById("noticeForm")?.addEventListener("submit", saveNotice);
    document.getElementById("btnDeactivate")?.addEventListener("click", deactivate);
    document.getElementById("btnRefresh")?.addEventListener("click", loadActive);
    document.getElementById("btnTest")?.addEventListener("click", testPopupNow);

    await loadActive();
  });
})();
