console.log("bd-objection-history.js loaded");

let API_BASE = "";

/* ---------- auth helpers (same as your other pages) ---------- */
function getToken() {
  return localStorage.getItem("token") || "";
}
function redirectLogin() {
  localStorage.clear();
  window.location.href = "login.html";
}
async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    redirectLogin();
    throw new Error("Unauthorized");
  }
  return res;
}

function normalizeApiBase(apiBaseFromServer) {
  let base = (apiBaseFromServer || window.location.origin || "").trim();
  if (base.endsWith("/")) base = base.slice(0, -1);
  return base.toLowerCase().endsWith("/api") ? base : `${base}/api`;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function short(s, n = 160) {
  const t = String(s || "").trim();
  if (!t) return "-";
  return t.length > n ? t.slice(0, n) + "…" : t;
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    API_BASE = normalizeApiBase(data.apiBase);
  } catch {
    API_BASE = normalizeApiBase(null);
  }
}

/* ---------- Preview helpers (default collapsed) ---------- */
function buildPreviewHTML({ path, mime, name }) {
  const m = (mime || "").toLowerCase();
  if (!path) return "";

  if (m.startsWith("image/")) {
    return `<img src="${path}" alt="${esc(name || "Attachment")}" />`;
  }
  if (m === "application/pdf") {
    return `<iframe src="${path}"></iframe>`;
  }
  return `<div class="muted" style="padding:10px;">Preview not available for this file type.</div>`;
}

/* ---------- Main search ---------- */
async function searchBD(bd) {
  const cards = document.getElementById("cards");
  const info = document.getElementById("resultInfo");

  cards.innerHTML = `<div class="muted">Loading...</div>`;
  info.textContent = "";

  const res = await authFetch(
    `${API_BASE}/records/by-bd?bd_no=${encodeURIComponent(bd)}&only_ao=1&limit=300`
  );
  const data = await res.json();

  if (!res.ok) throw new Error(data?.error || "Failed to load");

  const rows = Array.isArray(data.data) ? data.data : [];
  info.textContent = `Found ${rows.length} objection(s) for BD: ${bd}`;

  if (rows.length === 0) {
    cards.innerHTML = `<div class="muted">No Audit Objection found for this BD.</div>`;
    return;
  }

  // Render modular cards (details + attachment module)
  cards.innerHTML = rows
    .map((r) => {
      const sec = r.Section?.name || "-";
      const sub = r.Subcategory?.name || "-";
      const rack = r.Rack?.name || "-";
      const serial = r.serial_no ?? "-";

      const no = r.objection_no || "-";
      const title = r.objection_title || "(No title)";
      const detailsRaw = (r.objection_details || r.description || "").trim();

      const createdAt = r.createdAt ? new Date(r.createdAt).toLocaleString() : "-";
      const openDate = r.opening_date || "-";

      const hasFile = !!r.attachment_path;
      const fileName = r.attachment_name || "Attachment";
      const mime = (r.attachment_mime || "").toLowerCase();

      const shortText = short(detailsRaw, 220);
      const isLong = detailsRaw.length > 220;

      return `
        <div class="ob-card ob-collapsed ob-preview-collapsed"
             data-ob-card="${r.id}"
             data-attach-path="${hasFile ? esc(r.attachment_path) : ""}"
             data-attach-mime="${esc(mime)}"
             data-attach-name="${esc(fileName)}">

          <div class="ob-head">
            <div style="flex:1;min-width:260px;">
              <div class="ob-title">
                <span class="ob-no">AO • ${esc(no)}</span>
                <span>${esc(title)}</span>
              </div>

              <div class="ob-subtitle">
                BD: <b>${esc(r.bd_no || "")}</b> • Record ID: <b>${esc(r.id)}</b>
              </div>

              <div class="ob-meta">
                <span class="meta-chip">Section: ${esc(sec)}</span>
                <span class="meta-chip">Sub: ${esc(sub)}</span>
                <span class="meta-chip">Rack: ${esc(rack)}</span>
                <span class="meta-chip">Serial: ${esc(serial)}</span>
                <span class="meta-chip">Opening: ${esc(openDate)}</span>
                <span class="meta-chip">Created: ${esc(createdAt)}</span>
              </div>
            </div>

            <div class="ob-actions">
              <a class="ob-btn"
                 href="view-record.html?q=${encodeURIComponent(r.bd_no || "")}"
                 title="Open records list filtered by this BD">
                Open List
              </a>

              ${hasFile ? `
                <a class="ob-btn"
                   href="${r.attachment_path}"
                   target="_blank"
                   rel="noopener"
                   title="Open attachment in new tab">
                  Open File
                </a>
              ` : ""}

              <button class="ob-btn primary" data-toggle="${r.id}">
                ${isLong ? "Details" : "View"}
              </button>
            </div>
          </div>

          <div class="ob-section">
            <div class="ob-sec-title">Details</div>

            <div class="ob-details">
              <div class="ob-details-short">${esc(shortText)}</div>
              <div class="ob-details-full">${esc(detailsRaw || "-")}</div>
            </div>

            ${isLong ? `
              <div style="margin-top:10px;">
                <button class="ob-btn" data-toggle="${r.id}">Show More</button>
              </div>
            ` : ""}
          </div>

          <div class="ob-section">
            <div class="ob-sec-title">Attachment</div>

            <div class="ob-attach">
              <span class="attach-chip">${hasFile ? "📎 " + esc(fileName) : "📎 None"}</span>

              ${hasFile ? `
                <a class="attach-open"
                   href="${r.attachment_path}"
                   target="_blank"
                   rel="noopener">
                  Open Attachment
                </a>
                <button class="ob-btn" data-preview-toggle="${r.id}">
                  Show Preview
                </button>
              ` : ""}
            </div>

            <!-- preview container; empty until user clicks -->
            <div class="attach-preview" data-preview-box="${r.id}"></div>
          </div>
        </div>
      `;
    })
    .join("");

  // Details expand/collapse
  cards.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-toggle");
      const card = cards.querySelector(`[data-ob-card="${id}"]`);
      if (!card) return;

      const isCollapsed = card.classList.contains("ob-collapsed");
      card.classList.toggle("ob-collapsed", !isCollapsed);

      const allToggleBtns = card.querySelectorAll(`[data-toggle="${id}"]`);
      allToggleBtns.forEach((b) => (b.textContent = isCollapsed ? "Hide Details" : "Details"));
    });
  });

  // Preview expand/collapse (default collapsed)
  cards.querySelectorAll("[data-preview-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-preview-toggle");
      const card = cards.querySelector(`[data-ob-card="${id}"]`);
      const box = cards.querySelector(`[data-preview-box="${id}"]`);
      if (!card || !box) return;

      const path = card.getAttribute("data-attach-path") || "";
      const mime = card.getAttribute("data-attach-mime") || "";
      const name = card.getAttribute("data-attach-name") || "Attachment";
      if (!path) return;

      const isCollapsed = card.classList.contains("ob-preview-collapsed");

      if (isCollapsed) {
        box.innerHTML = buildPreviewHTML({ path, mime, name });
        card.classList.remove("ob-preview-collapsed");
        btn.textContent = "Hide Preview";
      } else {
        box.innerHTML = "";
        card.classList.add("ob-preview-collapsed");
        btn.textContent = "Show Preview";
      }
    });
  });
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  await loadConfig();

  const bdInput = document.getElementById("bdInput");
  const btnSearch = document.getElementById("btnSearch");
  const btnClear = document.getElementById("btnClear");

  // if user comes with ?bd_no=...
  const params = new URLSearchParams(window.location.search);
  const bdFromUrl = (params.get("bd_no") || "").trim();
  if (bdFromUrl) {
    bdInput.value = bdFromUrl;
    searchBD(bdFromUrl).catch((err) => {
      document.getElementById("cards").innerHTML = `<div class="muted">${esc(err.message)}</div>`;
    });
  }

  btnSearch.addEventListener("click", () => {
    const bd = bdInput.value.trim();
    if (!bd) return;

    history.replaceState(null, "", `bd-objection-history.html?bd_no=${encodeURIComponent(bd)}`);
    searchBD(bd).catch((err) => {
      document.getElementById("cards").innerHTML = `<div class="muted">${esc(err.message)}</div>`;
    });
  });

  bdInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnSearch.click();
  });

  btnClear.addEventListener("click", () => {
    bdInput.value = "";
    document.getElementById("cards").innerHTML = "";
    document.getElementById("resultInfo").textContent = "";
    history.replaceState(null, "", "bd-objection-history.html");
  });
});
