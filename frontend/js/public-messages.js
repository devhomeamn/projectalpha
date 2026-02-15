(function () {
  "use strict";

  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
    if (token) headers.Authorization = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      localStorage.clear();
      window.location.href = "login.html";
      throw new Error("Unauthorized");
    }
    return res;
  }

  function fmtDate(v) {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  }

  function setHint(text, isError = false) {
    const el = document.getElementById("formHint");
    if (!el) return;
    el.textContent = text || "";
    el.style.color = isError ? "#b91c1c" : "#4b5563";
  }

  function renderMessages(list) {
    const box = document.getElementById("messageList");
    const count = document.getElementById("messageCount");
    if (!box || !count) return;

    const rows = Array.isArray(list) ? list : [];
    count.textContent = String(rows.length);

    if (!rows.length) {
      box.innerHTML = '<div class="pm-empty">No messages yet. Be the first one to post.</div>';
      return;
    }

    box.innerHTML = rows
      .map((m) => {
        return `
          <article class="pm-item">
            <div class="pm-meta">
              <span class="pm-author">${escapeHtml(m.author_name || "User")}</span>
              <span class="pm-role">${escapeHtml(m.author_role || "General")}</span>
              <span>${escapeHtml(fmtDate(m.createdAt))}</span>
            </div>
            <p class="pm-text">${escapeHtml(m.message || "")}</p>
          </article>
        `;
      })
      .join("");
  }

  async function loadMessages() {
    const apiBase = await getApiBase();
    const res = await authFetch(`${apiBase}/public-messages`);
    const out = await res.json();

    if (!res.ok) {
      throw new Error(out?.error || "Failed to load messages");
    }

    renderMessages(out.messages || []);
  }

  async function submitMessage(e) {
    e.preventDefault();

    const input = document.getElementById("messageInput");
    const text = String(input?.value || "").trim();
    if (!text) {
      setHint("Message empty রাখা যাবে না।", true);
      return;
    }

    const apiBase = await getApiBase();
    const res = await authFetch(`${apiBase}/public-messages`, {
      method: "POST",
      body: JSON.stringify({ message: text }),
    });
    const out = await res.json();

    if (!res.ok) {
      setHint(out?.error || "Message post failed", true);
      return;
    }

    if (input) input.value = "";
    setHint("Message posted.");
    await loadMessages();
  }

  async function init() {
    if (!getToken()) {
      window.location.href = "login.html";
      return;
    }

    document.getElementById("messageForm")?.addEventListener("submit", submitMessage);
    document.getElementById("refreshBtn")?.addEventListener("click", loadMessages);

    await loadMessages();
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      console.error("public-messages init error:", err);
      setHint("Data load করা যায়নি। পরে আবার try করো।", true);
    });
  });
})();
