(function () {
  "use strict";
  let isAdmin = false;

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
        const canEdit = !!m.can_edit;
        const canDelete = !!m.can_delete;
        const edited = !!m.is_edited;
        return `
          <article class="pm-item" data-message-id="${Number(m.id || 0)}">
            <div class="pm-meta">
              <span class="pm-author">${escapeHtml(m.author_name || "User")}</span>
              <span class="pm-role">${escapeHtml(m.author_role || "General")}</span>
              <span>${escapeHtml(fmtDate(m.createdAt))}</span>
              ${edited ? `<span class="pm-edited">edited ${escapeHtml(fmtDate(m.updatedAt))}</span>` : ""}
            </div>
            <p class="pm-text">${escapeHtml(m.message || "")}</p>
            ${
              canEdit || canDelete
                ? `
                  <div class="pm-item-actions">
                    ${canEdit ? `<button type="button" class="pm-mini-btn" data-action="edit">Edit</button>` : ""}
                    ${canDelete ? `<button type="button" class="pm-mini-btn danger" data-action="delete">Delete</button>` : ""}
                  </div>
                `
                : ""
            }
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

    isAdmin = !!out.is_admin;
    renderMessages(out.messages || []);
  }

  function renderTraces(list) {
    const traceCard = document.getElementById("traceCard");
    const traceList = document.getElementById("traceList");
    if (!traceCard || !traceList) return;

    if (!isAdmin) {
      traceCard.hidden = true;
      return;
    }

    traceCard.hidden = false;
    const rows = Array.isArray(list) ? list : [];
    if (!rows.length) {
      traceList.innerHTML = '<div class="pm-empty">No trace log yet.</div>';
      return;
    }

    traceList.innerHTML = rows
      .map((t) => {
        const action = String(t.action || "").toLowerCase();
        const actionLabel = action === "delete" ? "Deleted" : "Edited";
        return `
          <article class="pm-item">
            <div class="pm-meta">
              <span class="pm-author">${escapeHtml(t.actor_name || "User")}</span>
              <span class="pm-role">${escapeHtml(t.actor_role || "General")}</span>
              <span>${escapeHtml(actionLabel)} message #${escapeHtml(String(t.message_id || "-"))}</span>
              <span>${escapeHtml(fmtDate(t.createdAt))}</span>
            </div>
            <p class="pm-text"><b>Owner:</b> ${escapeHtml(t.owner_name || "-")}</p>
            <p class="pm-text"><b>Before:</b> ${escapeHtml(t.before_text || "")}</p>
            ${
              action === "edit"
                ? `<p class="pm-text"><b>After:</b> ${escapeHtml(t.after_text || "")}</p>`
                : ""
            }
          </article>
        `;
      })
      .join("");
  }

  async function loadTraces() {
    if (!isAdmin) return;
    const apiBase = await getApiBase();
    const res = await authFetch(`${apiBase}/public-messages/trace/list`);
    const out = await res.json();
    if (!res.ok) {
      throw new Error(out?.error || "Failed to load trace logs");
    }
    renderTraces(out.traces || []);
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
    await loadTraces();
  }

  async function editMessage(messageId, currentText) {
    const nextText = window.prompt("Edit your message:", currentText || "");
    if (nextText === null) return;
    const text = String(nextText || "").trim();
    if (!text) {
      setHint("Message empty রাখা যাবে না।", true);
      return;
    }

    const apiBase = await getApiBase();
    const res = await authFetch(`${apiBase}/public-messages/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify({ message: text }),
    });
    const out = await res.json();
    if (!res.ok) {
      setHint(out?.error || "Edit failed", true);
      return;
    }
    setHint("Message updated.");
    await loadMessages();
    await loadTraces();
  }

  async function deleteMessage(messageId) {
    const ok = window.confirm("Are you sure you want to delete this message?");
    if (!ok) return;

    const apiBase = await getApiBase();
    const res = await authFetch(`${apiBase}/public-messages/${messageId}`, {
      method: "DELETE",
    });
    const out = await res.json();
    if (!res.ok) {
      setHint(out?.error || "Delete failed", true);
      return;
    }
    setHint("Message deleted.");
    await loadMessages();
    await loadTraces();
  }

  async function init() {
    if (!getToken()) {
      window.location.href = "login.html";
      return;
    }

    document.getElementById("messageForm")?.addEventListener("submit", submitMessage);
    document.getElementById("refreshBtn")?.addEventListener("click", loadMessages);
    document.getElementById("traceRefreshBtn")?.addEventListener("click", loadTraces);

    document.getElementById("messageList")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const card = e.target.closest(".pm-item[data-message-id]");
      const id = Number(card?.getAttribute("data-message-id") || 0);
      if (!id) return;

      if (btn.dataset.action === "edit") {
        const text = card.querySelector(".pm-text")?.textContent || "";
        await editMessage(id, text);
      }

      if (btn.dataset.action === "delete") {
        await deleteMessage(id);
      }
    });

    await loadMessages();
    await loadTraces();
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      console.error("public-messages init error:", err);
      setHint("Data load করা যায়নি। পরে আবার try করো।", true);
    });
  });
})();
