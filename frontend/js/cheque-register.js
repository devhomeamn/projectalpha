// frontend/js/cheque-register.js
// Cheque Register module UI (Serial + AddedBy + Admin Delete + Print Menu + Monthly Grouped Report)

let API_BASE = "/api";

function getToken() {
  return localStorage.getItem("token") || "";
}

function authHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
    ...extra,
  };
}

async function initApiBase() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return;
    const data = await res.json();
    if (data?.apiBase) {
      API_BASE = data.apiBase.endsWith("/api")
        ? data.apiBase
        : `${data.apiBase.replace(/\/+$/, "")}/api`;
    }
  } catch {
    // ignore
  }
}

function byId(id) {
  return document.getElementById(id);
}

// ✅ Local date (YYYY-MM-DD) so Bangladesh timezone e 1 din age/pore hobena
function toLocalISODate(d) {
  try {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

function formatDate(v) {
  if (!v) return "-";
  return String(v).slice(0, 10);
}

function formatMoney(v) {
  if (v === undefined || v === null || v === "") return "-";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(2);
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getRole() {
  return (localStorage.getItem("role") || "").toLowerCase();
}

function isAdmin() {
  return getRole() === "admin";
}

function isMaster() {
  return getRole() === "master";
}

function canViewLogs() {
  return isAdmin() || isMaster();
}

// ------------------ clock ------------------
function startClock() {
  const dateEl = byId("currentDate");
  const timeEl = byId("currentTime");
  const tick = () => {
    const now = new Date();
    if (dateEl) dateEl.textContent = now.toLocaleDateString();
    if (timeEl) timeEl.textContent = now.toLocaleTimeString();
  };
  tick();
  setInterval(tick, 1000);
}

// ------------------ sections ------------------
let sections = [];

async function loadSections() {
  const res = await fetch(`${API_BASE}/cheque-register/origin-sections`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json();
  sections = Array.isArray(data) ? data : (data.data || data.sections || []);

  const filter = byId("originFilter");
  const originSel = byId("originSection");

  const opts = [`<option value="">All Origin Sections</option>`]
    .concat(sections.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`))
    .join("");
  if (filter) filter.innerHTML = opts;

  const opts2 = [`<option value="">Select origin section</option>`]
    .concat(sections.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`))
    .join("");
  if (originSel) originSel.innerHTML = opts2;

  // monthly modal origin dropdown
  const reportOrigin = byId("reportOrigin");
  if (reportOrigin) {
    reportOrigin.innerHTML = [`<option value="">All Sections</option>`]
      .concat(sections.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`))
      .join("");
  }
}

function sectionName(id) {
  const s = sections.find((x) => Number(x.id) === Number(id));
  return s ? s.name : (id ? `#${id}` : "-");
}

function getAddedByName(r) {
  // accept multiple backend shapes
  return (
    r.added_by_name ||
    r.created_by_name ||
    r.creator?.name ||
    r.creator?.username ||
    r.addedBy?.name ||
    r.addedBy?.username ||
    (r.created_by ? `User#${r.created_by}` : "-")
  );
}

// ------------------ paging/state ------------------
let currentPage = 1;
let currentLimit = 20;

function getFilters() {
  return {
    status: byId("statusFilter")?.value || "all",
    origin_section_id: byId("originFilter")?.value || "",
    q: byId("searchBox")?.value?.trim() || "",
    from: byId("fromDate")?.value || "",
    to: byId("toDate")?.value || "",
  };
}

// ------------------ data fetch ------------------
async function fetchEntries(page = currentPage) {
  const f = getFilters();
  const params = new URLSearchParams();
  if (f.status && f.status !== "all") params.set("status", f.status);
  if (f.origin_section_id) params.set("origin_section_id", f.origin_section_id);
  if (f.q) params.set("q", f.q);
  if (f.from) params.set("from", f.from);
  if (f.to) params.set("to", f.to);

  params.set("page", String(page));
  params.set("limit", String(currentLimit));

  const url = `${API_BASE}/cheque-register?${params.toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
  const data = await res.json();

  if (!res.ok) {
    console.error("List failed:", res.status, data);
    throw new Error(data?.message || "Failed to load entries");
  }

  const rows = Array.isArray(data) ? data : (data.data || data.rows || data.items || []);
  const total = Number(data?.total ?? rows.length ?? 0);

  return Array.isArray(data)
    ? { data: rows, page, limit: currentLimit, total }
    : { ...data, data: rows, page: Number(data.page || page), limit: Number(data.limit || currentLimit), total };
}

// ------------------ render ------------------
function renderEntries(payload) {
  const tbody = byId("rows");
  const info = byId("resultInfo");
  const pageInfo = byId("pageInfo");

  const rows = payload?.data || [];
  const total = Number(payload?.total || 0);
  const page = Number(payload?.page || 1);

  if (info) info.textContent = `Total: ${total}`;
  if (pageInfo) pageInfo.textContent = `Page ${page}`;

  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="padding:14px;text-align:center;color:#6b7280;">No entries found</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((r, idx) => {
      const sl = (currentPage - 1) * currentLimit + (idx + 1);
      const canReturn = r.status !== "returned";

      const delBtn = isAdmin()
        ? `
          <button class="bdh-btn bdh-btn-sm" data-action="delete" data-id="${r.id}"
            style="padding:6px 10px;background:#dc2626;color:#fff;border-color:#dc2626;">
            <span class="material-symbols-rounded" style="font-size:18px;">delete</span>
          </button>`
        : "";

      return `
      <tr>
        <td style="padding:10px;">${sl}</td>
        <td style="padding:10px;">${escapeHtml(r.entry_no ?? "")}</td>
        <td style="padding:10px;">${escapeHtml(r.bill_ref_no || "-")}</td>
        <td style="padding:10px;">${escapeHtml(sectionName(r.origin_section_id))}</td>
        <td style="padding:10px;">${escapeHtml(formatDate(r.received_date))}</td>
        <td style="padding:10px;">${escapeHtml(r.token_no || "-")}</td>
        <td style="padding:10px;text-align:right;">${escapeHtml(formatMoney(r.amount))}</td>
        <td style="padding:10px;">${escapeHtml(getAddedByName(r))}</td>
        <td style="padding:10px;">
          <span class="badge" style="display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid #e5e7eb;">
            ${escapeHtml(r.status || "-")}
          </span>
        </td>
        <td style="padding:10px;white-space:nowrap;text-align:right;">
          <button class="bdh-btn bdh-btn-sm" data-action="edit" data-id="${r.id}" style="padding:6px 10px;">
            <span class="material-symbols-rounded" style="font-size:18px;">edit</span>
          </button>

          <button class="bdh-btn bdh-btn-sm" data-action="return" data-id="${r.id}" ${canReturn ? "" : "disabled"}
            style="padding:6px 10px;${canReturn ? "" : "opacity:.5;cursor:not-allowed;"}">
            <span class="material-symbols-rounded" style="font-size:18px;">assignment_turned_in</span>
          </button>
          <button class="bdh-btn bdh-btn-sm" data-action="logs" data-id="${r.id}"
            data-entry-no="${escapeHtml(r.entry_no ?? "")}" data-token-no="${escapeHtml(r.token_no || "-")}"
            style="padding:6px 10px;background:#111827;color:#fff;border-color:#111827;">
            <span class="material-symbols-rounded" style="font-size:18px;">history</span>
          </button>

          ${delBtn}
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const act = btn.getAttribute("data-action");
      if (!id) return;
      if (act === "edit") openEditModal(id);
      if (act === "return") doReturn(id);
      if (act === "logs") openLogs(id, btn.getAttribute("data-entry-no"), btn.getAttribute("data-token-no"));
      if (act === "delete") doDelete(id);
    });
  });
}

async function refresh(page = currentPage) {
  try {
    const payload = await fetchEntries(page);
    currentPage = Number(payload.page || page || 1);
    renderEntries(payload);
  } catch (err) {
    console.error(err);
    alert(err.message || "Failed");
  }
}

// ------------------ modal ------------------
function openModal(title) {
  byId("modalTitle").textContent = title;
  const m = byId("entryModal");
  m.style.display = "flex";
}

function closeModal() {
  const m = byId("entryModal");
  m.style.display = "none";
}

function resetForm() {
  byId("entryForm").reset();
  byId("entryId").value = "";
}

function fillForm(row) {
  byId("entryId").value = row.id;
  byId("billRefNo").value = row.bill_ref_no || "";
  byId("originSection").value = row.origin_section_id || "";
  byId("receivedDate").value = formatDate(row.received_date) !== "-" ? formatDate(row.received_date) : "";
  byId("tokenNo").value = row.token_no || "";
  byId("amount").value = row.amount != null ? String(row.amount) : "";
  byId("entryStatus").value = row.status || "received";
  byId("remarks").value = row.remarks || "";
}

async function openEditModal(id) {
  try {
    const res = await fetch(`${API_BASE}/cheque-register/${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to load entry");

    const row = data.data;
    resetForm();
    fillForm(row);
    openModal(`Edit Entry #${row.entry_no}`);
  } catch (err) {
    console.error(err);
    alert(err.message || "Failed");
  }
}

function openAddModal() {
  resetForm();
  // ✅ was: new Date().toISOString().slice(0,10) (UTC issue)
  const today = toLocalISODate(new Date());
  byId("receivedDate").value = today;
  byId("entryStatus").value = "received";
  openModal("New Cheque Entry");
}

// ------------------ logs modal (Admin/Master) ------------------
function openLogsModal() {
  const m = byId("logsModal");
  if (!m) return;
  m.style.display = "flex";
}
function closeLogsModal() {
  const m = byId("logsModal");
  if (!m) return;
  m.style.display = "none";
}

function safeJsonParse(s) {
  try {
    if (!s) return null;
    if (typeof s === "object") return s;
    return JSON.parse(String(s));
  } catch {
    return null;
  }
}

function labelForField(k) {
  const map = {
    entry_no: "Entry No",
    bill_ref_no: "Bill Ref",
    origin_section_id: "Origin",
    received_date: "Received",
    token_no: "Token",
    amount: "Amount",
    remarks: "Remarks",
    status: "Status",
    returned_to_section_id: "Returned To",
    returned_date: "Returned Date",
    delete_reason: "Delete Reason",
    deleted_at: "Deleted At",
    deleted_by: "Deleted By",
  };
  return map[k] || k;
}

function valueForField(k, v) {
  if (v === undefined || v === null || v === "") return "-";
  if (k === "amount") return formatMoney(v);
  if (k === "received_date" || k === "returned_date") return formatDate(v);
  if (k === "origin_section_id" || k === "returned_to_section_id") return sectionName(v);
  return String(v);
}

function diffObjects(oldObj, newObj) {
  const o = oldObj || {};
  const n = newObj || {};
  const keys = new Set([...Object.keys(o), ...Object.keys(n)]);
  const ignore = new Set(["id", "created_by", "updated_by", "deleted_at", "deleted_by", "createdAt", "updatedAt"]);

  const importantOrder = [
    "bill_ref_no",
    "origin_section_id",
    "received_date",
    "token_no",
    "amount",
    "status",
    "returned_to_section_id",
    "returned_date",
    "remarks",
    "delete_reason",
  ];

  const ordered = [
    ...importantOrder.filter((k) => keys.has(k)),
    ...Array.from(keys).filter((k) => !importantOrder.includes(k)),
  ];

  const out = [];
  for (const k of ordered) {
    if (ignore.has(k)) continue;
    const ov = valueForField(k, o[k]);
    const nv = valueForField(k, n[k]);
    if (ov === nv) continue;
    out.push({ k, ov, nv });
  }
  return out;
}

function actionBadge(action) {
  const a = String(action || "").toLowerCase();
  if (a === "create") return { text: "CREATED", cls: "create" };
  if (a === "update") return { text: "UPDATED", cls: "update" };
  if (a === "return") return { text: "RETURNED", cls: "return" };
  if (a === "delete") return { text: "DELETED", cls: "delete" };
  return { text: a.toUpperCase() || "LOG", cls: "update" };
}

function actorName(log) {
  return log.actor?.name || log.actor?.username || log.actor_name || (log.actor_id ? `User#${log.actor_id}` : "System");
}

function formatDateTime(v) {
  try {
    if (!v) return "-";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString();
  } catch {
    return String(v || "-");
  }
}

async function openLogs(id, entryNo, tokenNo) {
  if (!canViewLogs()) return alert("Admin/Master only");

  byId("logsEntryNo").textContent = entryNo || "-";
  byId("logsTokenNo").textContent = tokenNo || "-";

  const body = byId("logsBody");
  if (body) body.innerHTML = `<div class="muted">Loading...</div>`;

  openLogsModal();

  try {
    const res = await fetch(`${API_BASE}/cheque-register/${id}/logs`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to load logs");

    const logs = Array.isArray(data?.data) ? data.data : [];
    if (!logs.length) {
      if (body) body.innerHTML = `<div class="logs-empty">No logs found for this entry.</div>`;
      return;
    }

    const cards = logs
      .map((log) => {
        const badge = actionBadge(log.action);
        const oldObj = safeJsonParse(log.old_data);
        const newObj = safeJsonParse(log.new_data);
        const diffs = diffObjects(oldObj, newObj);

        const diffsHtml = diffs.length
          ? `<div class="diff-wrap">
              ${diffs
                .map(
                  (d) => `
                  <div class="diff-line">
                    <span class="diff-field">${escapeHtml(labelForField(d.k))}</span>:
                    <span class="diff-old">${escapeHtml(d.ov)}</span>
                    &rarr;
                    <span class="diff-new">${escapeHtml(d.nv)}</span>
                  </div>`
                )
                .join("")}
            </div>`
          : `<div class="muted small">No field changes captured.</div>`;

        const note = (log.note || "").trim();
        const noteHtml = note ? `<div class="log-note">${escapeHtml(note)}</div>` : "";

        return `
          <div class="log-card">
            <div class="log-top">
              <span class="log-badge ${badge.cls}">${escapeHtml(badge.text)}</span>
              <div class="log-meta">
                <span>${escapeHtml(actorName(log))}</span>
                <span class="dot"></span>
                <span>${escapeHtml(formatDateTime(log.created_at))}</span>
              </div>
            </div>
            <div class="log-body">
              ${diffsHtml}
              ${noteHtml}
            </div>
          </div>
        `;
      })
      .join("");

    if (body) body.innerHTML = `<div class="logs-timeline">${cards}</div>`;
  } catch (err) {
    console.error(err);
    if (body) body.innerHTML = `<div class="msg msg-error">${escapeHtml(err.message || "Failed")}</div>`;
  }
}

// ------------------ submit ------------------
async function submitForm(e) {
  e.preventDefault();

  const payload = {
    bill_ref_no: byId("billRefNo").value.trim() || null,
    origin_section_id: byId("originSection").value,
    received_date: byId("receivedDate").value,
    token_no: byId("tokenNo").value.trim(),
    amount: byId("amount").value,
    status: byId("entryStatus").value,
    remarks: byId("remarks").value.trim() || null,
  };

  if (!payload.origin_section_id) return alert("Origin section is required");
  if (!payload.received_date) return alert("Received date is required");
  if (!payload.token_no) return alert("Token no is required");
  if (payload.amount === "" || payload.amount === null || payload.amount === undefined) return alert("Amount is required");

  const isEdit = Boolean(byId("entryId").value);
  const url = isEdit ? `${API_BASE}/cheque-register/${byId("entryId").value}` : `${API_BASE}/cheque-register`;
  const method = isEdit ? "PUT" : "POST";

  const btn = byId("btnSave");
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "Saving...";

  try {
    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Save failed");

    closeModal();

    // Ensure user can see the new item
    const statusFilter = byId("statusFilter");
    if (statusFilter && statusFilter.value === "processing") statusFilter.value = "all";

    await refresh(1);
  } catch (err) {
    console.error(err);
    alert(err.message || "Save failed");
  } finally {
    btn.disabled = false;
    btn.innerHTML = old;
  }
}

// ------------------ return action ------------------
async function doReturn(id) {
  const run = () => doReturnConfirmed(id);

  if (typeof window.showConfirm === "function") {
    window.showConfirm({
      title: "Return Entry",
      message: "Mark this entry as RETURNED to origin section?",
      onConfirm: run,
    });
  } else {
    if (confirm("Mark as Issued?")) run();
  }
}

async function doReturnConfirmed(id) {
  try {
    const res = await fetch(`${API_BASE}/cheque-register/${id}/return`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Return failed");
    await refresh(currentPage);
  } catch (err) {
    console.error(err);
    alert(err.message || "Return failed");
  }
}

// ------------------ ✅ Admin delete ------------------
async function doDelete(id) {
  if (!isAdmin()) return alert("Admin only");

  const reason = (prompt("Delete reason (optional):") || "").trim();

  const run = async () => {
    const res = await fetch(`${API_BASE}/cheque-register/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
      body: JSON.stringify({ reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.message || "Delete failed");
    await refresh(currentPage);
  };

  if (typeof window.showConfirm === "function") {
    window.showConfirm({
      title: "Delete Entry",
      message: "এই entry টি স্থায়ীভাবে delete হবে. Continue?",
      onConfirm: run,
    });
  } else {
    if (confirm("Delete this entry?")) run();
  }
}

// ------------------ PRINT HELPERS ------------------
async function fetchAllEntriesForPrint({ origin_section_id, from, to }) {
  const params = new URLSearchParams();
  params.set("limit", "200");
  params.set("page", "1");
  if (origin_section_id) params.set("origin_section_id", origin_section_id);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  let page = 1;
  let all = [];
  let total = 0;

  while (true) {
    params.set("page", String(page));
    const url = `${API_BASE}/cheque-register?${params.toString()}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to load for print");

    const rows = Array.isArray(data) ? data : (data.data || []);
    total = Number(data?.total ?? rows.length ?? 0);

    all = all.concat(rows);

    if (rows.length === 0) break;
    if (total && all.length >= total) break;
    if (page > 200) break;

    page += 1;
  }

  return all;
}

// ✅ FIXED monthRange: Local timezone based (no UTC shift)
function monthRange(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { from: toLocalISODate(start), to: toLocalISODate(end) };
}

function monthLabelText(year, month) {
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const m = names[Math.max(0, Math.min(11, month - 1))];
  return `${m}-${year}`;
}

function officeHeaderHtml(title) {
  return `
    <div class="head">
      <div class="head-line head-1">Office of the Senior Finance Controller (Air Force)</div>
      <div class="head-line head-2">Dhaka Cantonment, Dhaka-1206</div>
      <div class="head-line head-3">Cheque (D) Section</div>
      <div class="head-gap"></div>
      <div class="report-title">${escapeHtml(title || "")}</div>
    </div>
  `;
}

/**
 * ✅ Print window: bodyHtml can contain MULTIPLE PAGES.
 * Each page must include its own header inside bodyHtml (to repeat per page).
 */
function openPrintWindowHtml({ bodyHtml, docTitle }) {
  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) {
    alert("Pop-up blocked! Please allow pop-ups for printing.");
    return;
  }

  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>${escapeHtml(docTitle || "Print")}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 18px; color:#111; }
      .print-btn { margin-bottom: 12px; }
      @media print { .print-btn { display:none; } body { padding: 12px; } }

      .head { text-align:center; margin-bottom: 10px; }
      .head-line { line-height: 1.2; }
      .head-1 { font-size: 13px; font-weight: 700; }
      .head-2 { font-size: 12px; font-weight: 600; margin-top: 10px; }
      .head-3 { font-size: 12px; font-weight: 700; margin-top: 10px; }
      .head-gap { height: 10px; }
      .report-title { font-size: 12px; font-weight: 800; text-decoration: underline; margin-top: 2px; }

      .meta { margin-top: 14px; font-size: 11px; line-height: 1.9; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border:1px solid #d9d9d9; padding:8px; font-size:11px; }
      th { background:#fff; font-weight:700; text-align:left; }
      .right { text-align:right; }
      .signature { margin-top: 20px; text-align:right; font-size: 11px; font-weight: 600; }

      .page { page-break-after: always; }
      .page:last-child { page-break-after: auto; }
      @media print {
        .page { page-break-after: always; }
        .page:last-child { page-break-after: auto; }
      }
    </style>
  </head>
  <body>
    <button class="print-btn" onclick="window.print()">Print</button>
    ${bodyHtml}
    <script> setTimeout(() => window.print(), 300); </script>
  </body>
  </html>
  `;

  w.document.open();
  w.document.write(html);
  w.document.close();
}

// Section-wise print (single section)
async function printSectionWise() {
  const originId = byId("originFilter")?.value || "";
  if (!originId) {
    alert("প্রথমে Origin Section select করুন, তারপর Print > Section-wise Print দিন।");
    return;
  }
  const from = byId("fromDate")?.value || "";
  const to = byId("toDate")?.value || "";
  const sectionTitle = sectionName(originId);

  try {
    const entries = await fetchAllEntriesForPrint({ origin_section_id: originId, from, to });

    entries.sort((a, b) => {
      const da = String(a.received_date || "");
      const db = String(b.received_date || "");
      if (da !== db) return da.localeCompare(db);
      return Number(a.entry_no || 0) - Number(b.entry_no || 0);
    });

    const totalAmount = entries.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    const rowsHtml = entries
      .map((r, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(r.entry_no ?? "")}</td>
          <td>${escapeHtml(r.bill_ref_no || "-")}</td>
          <td>${escapeHtml(formatDate(r.received_date))}</td>
          <td>${escapeHtml(r.token_no || "-")}</td>
          <td class="right">${escapeHtml(formatMoney(r.amount))}</td>
          <td>${escapeHtml(getAddedByName(r))}</td>
          <td>${escapeHtml(r.status || "-")}</td>
        </tr>
      `)
      .join("");

    const rangeLine = (from || to)
      ? `${escapeHtml(from || "—")} to ${escapeHtml(to || "—")}`
      : "All";

    const bodyHtml = `
      <div class="page">
        ${officeHeaderHtml("Section-wise Issued Report")}

        <div class="meta">
          <div>Section Origin: <b>${escapeHtml(sectionTitle)}</b></div>
          <div>Date Range: <b>${rangeLine}</b></div>
          <div>Printed at: <b>${escapeHtml(new Date().toLocaleString())}</b></div>
          <div>Total Bill : <b>${entries.length}</b></div>
          <div>Grand Total: <b>${escapeHtml(formatMoney(totalAmount))}</b></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:50px;">SL</th>
              <th>Entry No</th>
              <th>Bill Ref</th>
              <th>Received</th>
              <th>Token</th>
              <th class="right">Amount</th>
              <th>Added By</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="8" style="text-align:center;color:#666;">No data</td></tr>`}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5"></td>
              <td class="right" style="font-weight:700;">Total: ${escapeHtml(formatMoney(totalAmount))}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>

        <div class="signature">Signature</div>
      </div>
    `;

    openPrintWindowHtml({
      docTitle: "Cheque(D) Section — Section-wise Print",
      bodyHtml,
    });
  } catch (err) {
    console.error(err);
    alert(err.message || "Print failed");
  }
}

// Monthly Report modal
function openMonthlyModal() {
  const now = new Date();
  byId("reportMonth").value = String(now.getMonth() + 1);
  byId("reportYear").value = String(now.getFullYear());
  byId("monthlyModal").style.display = "flex";
}

function closeMonthlyModal() {
  byId("monthlyModal").style.display = "none";
}

// ✅ Monthly report: if All => section-wise separate pages, if single => single page
async function printMonthlyReportGrouped() {
  const month = Number(byId("reportMonth").value);
  const year = Number(byId("reportYear").value);
  const originId = byId("reportOrigin")?.value || "";

  if (!year || year < 2000) return alert("Valid year দিন");

  const { from, to } = monthRange(year, month);
  const monthLabel = monthLabelText(year, month);
  const dateRangeText = `${from} to ${to}`;

  try {
    const entries = await fetchAllEntriesForPrint({
      origin_section_id: originId || "",
      from,
      to,
    });

    entries.sort((a, b) => {
      const da = String(a.received_date || "");
      const db = String(b.received_date || "");
      if (da !== db) return da.localeCompare(db);
      return Number(a.entry_no || 0) - Number(b.entry_no || 0);
    });

    closeMonthlyModal();

    // ---------------- single section => single page ----------------
    if (originId) {
      const secTitle = sectionName(originId);
      const totalAmount = entries.reduce((s, r) => s + (Number(r.amount) || 0), 0);

      const rowsHtml = entries
        .map((r, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(r.bill_ref_no || "-")}</td>
            <td>${escapeHtml(formatDate(r.received_date))}</td>
            <td>${escapeHtml(r.token_no || "-")}</td>
            <td class="right">${escapeHtml(formatMoney(r.amount))}</td>
            <td>${escapeHtml(r.status || "-")}</td>
          </tr>
        `)
        .join("");

      const bodyHtml = `
        <div class="page">
          ${officeHeaderHtml("Monthly Individual Cheque Issued Report")}

          <div class="meta">
            <div>Month: <b>${escapeHtml(monthLabel)}</b></div>
            <div>Date Range: <b>${escapeHtml(dateRangeText)}</b></div>
            <div>Section Origin: <b>${escapeHtml(secTitle)}</b></div>
            <div>Printed at: <b>${escapeHtml(new Date().toLocaleString())}</b></div>
            <div>Total Bill : <b>${entries.length}</b></div>
            <div>Grand Total: <b>${escapeHtml(formatMoney(totalAmount))}</b></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:50px;">SL</th>
                <th>Bill Ref</th>
                <th>Received</th>
                <th>Token</th>
                <th class="right">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="6" style="text-align:center;color:#666;">No data</td></tr>`}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4"></td>
                <td class="right" style="font-weight:700;">Total: ${escapeHtml(formatMoney(totalAmount))}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          <div class="signature">Signature</div>
        </div>
      `;

      openPrintWindowHtml({
        docTitle: "Cheque(D) Section — Monthly Issued Report",
        bodyHtml,
      });
      return;
    }

    // ---------------- all sections => each section a page ----------------
    const groups = new Map();
    for (const r of entries) {
      const key = String(r.origin_section_id || "");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    const sortedGroups = Array.from(groups.entries()).sort((a, b) =>
      sectionName(a[0]).localeCompare(sectionName(b[0]))
    );

    const pages = sortedGroups.map(([originKey, rows]) => {
      const secTitle = sectionName(originKey);
      const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

      const tbody = rows
        .map((r, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(r.bill_ref_no || "-")}</td>
            <td>${escapeHtml(formatDate(r.received_date))}</td>
            <td>${escapeHtml(r.token_no || "-")}</td>
            <td class="right">${escapeHtml(formatMoney(r.amount))}</td>
            <td>${escapeHtml(r.status || "-")}</td>
          </tr>
        `)
        .join("");

      return `
        <div class="page">
          ${officeHeaderHtml("Monthly Individual Cheque Issued Report")}

          <div class="meta">
            <div>Month: <b>${escapeHtml(monthLabel)}</b></div>
            <div>Date Range: <b>${escapeHtml(dateRangeText)}</b></div>
            <div>Section Origin: <b>${escapeHtml(secTitle)}</b></div>
            <div>Printed at: <b>${escapeHtml(new Date().toLocaleString())}</b></div>
            <div>Total Bill : <b>${rows.length}</b></div>
            <div>Grand Total: <b>${escapeHtml(formatMoney(totalAmount))}</b></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:50px;">SL</th>
                <th>Bill Ref</th>
                <th>Received</th>
                <th>Token</th>
                <th class="right">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tbody || `<tr><td colspan="6" style="text-align:center;color:#666;">No data</td></tr>`}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4"></td>
                <td class="right" style="font-weight:700;">Total: ${escapeHtml(formatMoney(totalAmount))}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          <div class="signature">Signature</div>
        </div>
      `;
    }).join("");

    openPrintWindowHtml({
      docTitle: "Cheque(D) Section — Monthly Issued Report (All Sections)",
      bodyHtml: pages || `<div class="page">${officeHeaderHtml("Monthly Individual Cheque Issued Report")}<div class="meta">No data</div></div>`,
    });

  } catch (err) {
    console.error(err);
    alert(err.message || "Monthly report failed");
  }
}

// ------------------ Print menu (submenu) ------------------
function togglePrintMenu() {
  const m = byId("printMenu");
  if (!m) return;
  m.style.display = (m.style.display === "block") ? "none" : "block";
}

function closePrintMenu() {
  const m = byId("printMenu");
  if (m) m.style.display = "none";
}

// ------------------ UI bindings ------------------
function bindUi() {
  byId("btnNew")?.addEventListener("click", openAddModal);

  byId("btnSearch")?.addEventListener("click", () => refresh(1));
  byId("btnClear")?.addEventListener("click", () => {
    byId("statusFilter").value = "all";
    byId("originFilter").value = "";
    byId("fromDate").value = "";
    byId("toDate").value = "";
    byId("searchBox").value = "";
    refresh(1);
  });

  byId("statusFilter")?.addEventListener("change", () => refresh(1));
  byId("originFilter")?.addEventListener("change", () => refresh(1));

  byId("searchBox")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") refresh(1);
  });

  // ✅ print submenu
  byId("btnPrintMenu")?.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePrintMenu();
  });

  byId("btnPrintSection")?.addEventListener("click", () => {
    closePrintMenu();
    printSectionWise();
  });

  byId("btnPrintMonthly")?.addEventListener("click", () => {
    closePrintMenu();
    openMonthlyModal();
  });

  // close menu on outside click
  document.addEventListener("click", () => closePrintMenu());

  // monthly modal events
  byId("monthlyClose")?.addEventListener("click", closeMonthlyModal);
  byId("monthlyCancel")?.addEventListener("click", closeMonthlyModal);
  byId("monthlyPrint")?.addEventListener("click", printMonthlyReportGrouped);

  // logs modal events
  byId("logsClose")?.addEventListener("click", closeLogsModal);

  // modal close
  byId("btnCancel")?.addEventListener("click", closeModal);
  byId("modalClose")?.addEventListener("click", closeModal);

  // monthly modal outside click close
  const mm = byId("monthlyModal");
  if (mm) {
    mm.addEventListener("click", (e) => {
      if (e.target === mm) closeMonthlyModal();
    });
  }

  // logs modal outside click close
  const lm = byId("logsModal");
  if (lm) {
    lm.addEventListener("click", (e) => {
      if (e.target === lm) closeLogsModal();
    });
  }

  byId("entryForm")?.addEventListener("submit", submitForm);

  // pagination
  byId("prevBtn")?.addEventListener("click", () => {
    if (currentPage > 1) refresh(currentPage - 1);
  });
  byId("nextBtn")?.addEventListener("click", () => {
    refresh(currentPage + 1);
  });
}

// ------------------ guard ------------------
async function guardChequeUser() {
  const role = getRole();
  if (role === "admin" || role === "master") return true;

  const userSectionId = Number(localStorage.getItem("section_id") || 0);
  const cachedChequeId = Number(localStorage.getItem("cheque_section_id") || 0);
  if (cachedChequeId && userSectionId === cachedChequeId) return true;

  try {
    const res = await fetch(`${API_BASE}/sections`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    const rows = Array.isArray(data) ? data : (data.sections || data.data || []);
    const norm = (s) => String(s || "").toLowerCase();
    const found = rows.find((r) => norm(r.name).includes("cheque")) || rows.find((r) => norm(r.name).startsWith("d"));
    if (found?.id) {
      localStorage.setItem("cheque_section_id", String(found.id));
      return userSectionId === Number(found.id);
    }
  } catch {
    // ignore
  }

  return true;
}

// ------------------ init ------------------
async function init() {
  await initApiBase();
  startClock();

  const ok = await guardChequeUser();
  if (!ok) {
    alert("Forbidden: Cheque section users only");
    window.location.href = "dashboard.html";
    return;
  }

  bindUi();
  await loadSections();
  await refresh(1);
}

document.addEventListener("DOMContentLoaded", init);
