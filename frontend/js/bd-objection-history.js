console.log("bd-objection-history.js loaded");

let API_BASE = "";        // e.g. http://localhost:5000/api
let ME_ROLE = "";         // "general" | "master" | "admin"
let ME_USER = null;

/* ------------------ helpers ------------------ */
function getToken() {
  return localStorage.getItem("token");
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shortText(s, n = 280) {
  const t = String(s || "").trim();
  if (!t) return "-";
  return t.length > n ? t.slice(0, n) + "…" : t;
}

function fmtDateTime(v) {
  if (!v) return "-";
  try { return new Date(v).toLocaleString(); } catch { return "-"; }
}

function showError(msg) {
  const el = document.getElementById("bdSearchError");
  if (!el) return;
  el.textContent = msg || "Something went wrong";
  el.style.display = "block";
}

function hideError() {
  const el = document.getElementById("bdSearchError");
  if (!el) return;
  el.style.display = "none";
}

/* ------------------ api base ------------------ */
function normalizeApiBase(apiBaseFromServer) {
  let base = (apiBaseFromServer || window.location.origin || "").trim();
  if (base.endsWith("/")) base = base.slice(0, -1);
  // If already ends with /api use it, else append
  return base.toLowerCase().endsWith("/api") ? base : `${base}/api`;
}

async function loadConfig() {
  // If /api/config exists -> use it, else fallback to window.location.origin/api
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    API_BASE = normalizeApiBase(data.apiBase);
  } catch {
    API_BASE = normalizeApiBase(null);
  }
}

/* ------------------ auth fetch ------------------ */
async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  return res;
}

async function apiJSON(url, options = {}) {
  const res = await authFetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || "Request failed";
    throw new Error(msg);
  }
  return data;
}

/* ------------------ role detection (safe) ------------------ */
function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function getMeSafe() {
  // Preferred: backend endpoint /api/auth/me
  try {
    const data = await apiJSON(`${API_BASE}/auth/me`);
    return data?.user || data;
  } catch {
    // Fallback: decode token payload (role/username may exist)
    const token = getToken();
    const payload = token ? decodeJwtPayload(token) : null;
    return payload || null;
  }
}

async function ensureAuditAccess() {
  const role = String(ME_ROLE || "").toLowerCase();
  if (!["admin", "master", "general"].includes(role)) {
    showError("You do not have access to this page.");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 900);
    return false;
  }

  return true;
}

/* ------------------ AO Clearance Modal ------------------ */
let AO_CLEARANCE_CTX = { record_id: null, bd_no: null, serial_no: null };

function openAOClearanceModal({ record_id, bd_no, serial_no }) {
  AO_CLEARANCE_CTX = { record_id, bd_no, serial_no };

  const modal = document.getElementById("aoClearanceModal");
  if (!modal) return;

  document.getElementById("aoClearanceBdNo").textContent = bd_no ?? "-";
  document.getElementById("aoClearanceSerial").textContent = serial_no ?? "-";
  document.getElementById("aoClearanceRecordId").textContent = record_id ?? "-";

  document.getElementById("aoClearanceNote").value = "";
  document.getElementById("aoClearanceAttachment").value = "";

  const err = document.getElementById("aoClearanceError");
  const ok = document.getElementById("aoClearanceSuccess");
  if (err) err.style.display = "none";
  if (ok) ok.style.display = "none";

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function closeAOClearanceModal() {
  const modal = document.getElementById("aoClearanceModal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

function bindModalCloseBehavior() {
  const modal = document.getElementById("aoClearanceModal");
  if (!modal) return;

  // click outside content
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeAOClearanceModal();
  });

  // ESC key
  document.addEventListener("keydown", (e) => {
    const opened = modal.classList.contains("is-open");
    if (opened && e.key === "Escape") closeAOClearanceModal();
  });

  // buttons
  const closeBtn = document.getElementById("aoClearanceCloseBtn");
  const cancelBtn = document.getElementById("aoClearanceCancelBtn");
  if (closeBtn) closeBtn.addEventListener("click", closeAOClearanceModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeAOClearanceModal);
}

async function submitClearanceRequest() {
  const errBox = document.getElementById("aoClearanceError");
  const okBox = document.getElementById("aoClearanceSuccess");
  const submitBtn = document.getElementById("aoClearanceSubmitBtn");

  if (errBox) errBox.style.display = "none";
  if (okBox) okBox.style.display = "none";

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    const note = document.getElementById("aoClearanceNote").value.trim();
    const fileInput = document.getElementById("aoClearanceAttachment");
    const file = fileInput?.files?.[0] || null;

    const form = new FormData();
    form.append("record_id", AO_CLEARANCE_CTX.record_id);
    if (note) form.append("request_note", note);
    if (file) form.append("attachment", file);

    // IMPORTANT: do not set content-type for FormData
    await apiJSON(`${API_BASE}/ao-clearance-requests`, {
      method: "POST",
      body: form,
    });

    if (okBox) {
      okBox.textContent = "Request submitted successfully.";
      okBox.style.display = "block";
    }

    setTimeout(() => window.location.reload(), 500);
  } catch (e) {
    if (errBox) {
      errBox.textContent = e.message || "Failed to submit request.";
      errBox.style.display = "block";
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Request";
  }
}

/* ------------------ Preview builder ------------------ */
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

/* ------------------ status ------------------ */
function getStatus(ao_status) {
  const s = String(ao_status || "open").toLowerCase();
  if (s === "cleared") return { text: "CLEARED", cls: "cleared" };
  if (s === "requested") return { text: "REQUESTED", cls: "requested" };
  return { text: "OPEN", cls: "open" };
}

/* ------------------ render ------------------ */
function renderCards(rows, bdNo) {
  const cards = document.getElementById("cards");
  const info = document.getElementById("resultInfo");

  if (info) info.textContent = `Found ${rows.length} objection(s) for BD: ${bdNo}`;

  if (!rows.length) {
    cards.innerHTML = `<div class="muted">No Audit Objection found for this BD.</div>`;
    return;
  }

  cards.innerHTML = rows.map((r) => {
    const st = getStatus(r.ao_status);

    // Core
    const serial = r.serial_no ?? "-";
    const no = r.objection_no || "-";
    const title = r.objection_title || "Audit Objection";

    // Details
    const detailsRaw = (r.objection_details || r.description || "").trim() || "-";
    const detailsShort = shortText(detailsRaw, 280);

    // Others
    const sec = r.Section?.name || "-";
    const sub = r.Subcategory?.name || "-";
    const rack = r.Rack?.name || "-";
    const openDate = r.opening_date || "-";
    const createdAt = fmtDateTime(r.createdAt);

    // Attachment
    const hasFile = !!r.attachment_path;
    const fileName = r.attachment_name || "Attachment";
    const mime = (r.attachment_mime || "").toLowerCase();

    // Clearance button (general/master)
    const canRequest = (ME_ROLE === "general" || ME_ROLE === "master") && st.cls !== "cleared";
    const reqDisabled = st.cls === "requested";

    return `
      <div class="ob-card"
        data-ob-card="${esc(r.id)}"
        data-attach-path="${hasFile ? esc(r.attachment_path) : ""}"
        data-attach-mime="${esc(mime)}"
        data-attach-name="${esc(fileName)}">

        <!-- TITLE -->
        <div class="ob-head">
          <div class="ob-head-left">
            <div class="ob-title">
              <span class="ob-no">AO • ${esc(no)}</span>
              <span class="ob-title-text">${esc(title)}</span>
            </div>
            <div class="ob-subtitle">
              BD: <b>${esc(r.bd_no || "")}</b> • Serial: <b>${esc(serial)}</b> • Record: <b>${esc(r.id)}</b>
            </div>
          </div>

          <div class="ob-head-right">
            <span class="status-pill ${st.cls}">${esc(st.text)}</span>

            <div class="ob-actions">
              ${
                canRequest
                  ? `<button
                        class="ob-btn ${reqDisabled ? "" : "primary"} js-ao-clear-btn"
                        data-record-id="${esc(r.id)}"
                        data-bd-no="${esc(r.bd_no || "")}"
                        data-serial="${esc(serial)}"
                        ${reqDisabled ? "disabled" : ""}>
                        ${reqDisabled ? "Clearance Requested" : "Request Clearance"}
                    </button>`
                  : ""
              }
            </div>
          </div>
        </div>

        <!-- DETAILS (always visible) -->
        <div class="ob-section">
          <div class="ob-sec-title">Details</div>
          <div class="ob-details">
            <div class="ob-details-short">${esc(detailsShort)}</div>
          </div>
        </div>

        <!-- OTHERS (expand) -->
        <details class="ob-more">
          <summary>More (Full details • Location • Dates • Attachment • Clearance)</summary>

          <div class="ob-more-body">

            <div class="ob-sec-title">Full Details</div>
            <div class="ob-details-full">${esc(detailsRaw)}</div>

            <div class="ob-sec-title" style="margin-top:12px;">Location</div>
            <ul class="ob-list">
              <li><b>Section:</b> ${esc(sec)}</li>
              <li><b>Subcategory:</b> ${esc(sub)}</li>
              <li><b>Rack:</b> ${esc(rack)}</li>
            </ul>

            <div class="ob-sec-title" style="margin-top:12px;">Dates</div>
            <ul class="ob-list">
              <li><b>Opening:</b> ${esc(openDate)}</li>
              <li><b>Created:</b> ${esc(createdAt)}</li>
            </ul>

            <div class="ob-sec-title" style="margin-top:12px;">Attachment</div>
            <div class="ob-attach">
              <span class="attach-chip">${hasFile ? "📎 " + esc(fileName) : "📎 None"}</span>

              ${
                hasFile
                  ? `<a class="attach-open" href="${r.attachment_path}" target="_blank" rel="noopener">Open Attachment</a>
                     <button class="ob-btn" type="button" data-preview-toggle="${esc(r.id)}">Show Preview</button>`
                  : ""
              }
            </div>

            <div class="attach-preview ob-preview-collapsed" data-preview-box="${esc(r.id)}"></div>

            <div class="ob-sec-title" style="margin-top:12px;">Clearance</div>
            <ul class="ob-list">
              <li><b>Status:</b> ${esc(st.text)}</li>
              ${st.cls === "cleared" && r.ao_cleared_at ? `<li><b>Cleared at:</b> ${esc(fmtDateTime(r.ao_cleared_at))}</li>` : ""}
              ${st.cls === "cleared" && r.ao_cleared_by ? `<li><b>Cleared by:</b> ${esc(r.ao_cleared_by)}</li>` : ""}
            </ul>

          </div>
        </details>
      </div>
    `;
  }).join("");

  // bind clearance request buttons
  cards.querySelectorAll(".js-ao-clear-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const record_id = Number(btn.getAttribute("data-record-id"));
      const bd_no = btn.getAttribute("data-bd-no") || "";
      const serial_no = btn.getAttribute("data-serial") || "";
      openAOClearanceModal({ record_id, bd_no, serial_no });
    });
  });

  // bind preview toggle
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

      const hidden = box.classList.contains("ob-preview-collapsed");
      if (hidden) {
        box.innerHTML = buildPreviewHTML({ path, mime, name });
        box.classList.remove("ob-preview-collapsed");
        btn.textContent = "Hide Preview";
      } else {
        box.innerHTML = "";
        box.classList.add("ob-preview-collapsed");
        btn.textContent = "Show Preview";
      }
    });
  });
}

/* ------------------ search ------------------ */
async function searchBD() {
  hideError();

  const bdInput = document.getElementById("bdInput");
  const bdNo = (bdInput?.value || "").trim();
  const cards = document.getElementById("cards");
  const info = document.getElementById("resultInfo");

  if (!bdNo) {
    showError("Please enter BD No");
    return;
  }

  cards.innerHTML = `<div class="muted">Loading...</div>`;
  if (info) info.textContent = "";

  // ✅ তোমার project এ working endpoint এটাই:
  const url = `${API_BASE}/records/by-bd?bd_no=${encodeURIComponent(bdNo)}&only_ao=1&limit=300`;

  try {
    const res = await authFetch(url);

    // JSON parse safe
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Better error message
      const msg =
        data?.message ||
        data?.error ||
        `Request failed (HTTP ${res.status})`;
      throw new Error(msg);
    }

    let rows = Array.isArray(data?.data) ? data.data : [];

    // ✅ Serial-wise ASC
    rows.sort((a, b) => {
      const sa = a?.serial_no ?? Number.POSITIVE_INFINITY;
      const sb = b?.serial_no ?? Number.POSITIVE_INFINITY;
      if (sa !== sb) return sa - sb;

      const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });

    renderCards(rows, bdNo);
  } catch (e) {
    cards.innerHTML = "";
    showError(e.message || "Failed to load objection history");
  }
}

function clearUI() {
  hideError();
  const bdInput = document.getElementById("bdInput");
  const cards = document.getElementById("cards");
  const info = document.getElementById("resultInfo");
  if (bdInput) bdInput.value = "";
  if (cards) cards.innerHTML = "";
  if (info) info.textContent = "";
}

/* ------------------ init ------------------ */
document.addEventListener("DOMContentLoaded", async () => {
  // 1) Load config (API base)
  await loadConfig();

  // 2) Detect logged-in user role (safe)
  try {
    ME_USER = await getMeSafe();
    const role =
      ME_USER?.role ||
      ME_USER?.Role ||
      ME_USER?.user?.role ||
      "";
    ME_ROLE = String(role).toLowerCase();
  } catch {
    ME_ROLE = "";
  }

  const accessOk = await ensureAuditAccess();
  if (!accessOk) return;

  // 3) Bind modal close + submit
  bindModalCloseBehavior();
  const submitBtn = document.getElementById("aoClearanceSubmitBtn");
  if (submitBtn) submitBtn.addEventListener("click", submitClearanceRequest);

  // 4) Inputs & buttons
  const bdInput = document.getElementById("bdInput");
  const btnSearch = document.getElementById("btnSearch");
  const btnClear = document.getElementById("btnClear");

  // 5) 🔹 If user comes via clickable link (?bd_no=...)
  const params = new URLSearchParams(window.location.search);
  const bdFromUrl = (params.get("bd_no") || "").trim();

  if (bdFromUrl) {
    bdInput.value = bdFromUrl;

    // auto-search
    searchBD(bdFromUrl).catch((err) => {
      document.getElementById("cards").innerHTML =
        `<div class="muted">${esc(err.message)}</div>`;
    });
  }

  // 6) 🔹 Search button click
  if (btnSearch) {
    btnSearch.addEventListener("click", () => {
      const bd = bdInput.value.trim();
      if (!bd) return;

      // keep URL in sync
      history.replaceState(
        null,
        "",
        `bd-objection-history.html?bd_no=${encodeURIComponent(bd)}`
      );

      searchBD(bd).catch((err) => {
        document.getElementById("cards").innerHTML =
          `<div class="muted">${esc(err.message)}</div>`;
      });
    });
  }

  // 7) 🔹 Enter key = Search
  if (bdInput) {
    bdInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btnSearch.click();
    });
  }

  // 8) 🔹 Clear button
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      bdInput.value = "";
      document.getElementById("cards").innerHTML = "";
      document.getElementById("resultInfo").textContent = "";
      hideError();

      // clean URL
      history.replaceState(null, "", "bd-objection-history.html");
    });
  }
});
