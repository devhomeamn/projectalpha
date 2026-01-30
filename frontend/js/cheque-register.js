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
  const today = new Date().toISOString().slice(0, 10);
  byId("receivedDate").value = today;
  byId("entryStatus").value = "received";
  openModal("New Cheque Entry");
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
    if (confirm("Mark as returned?")) run();
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

  const run = async () => {
    const res = await fetch(`${API_BASE}/cheque-register/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
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

function monthRange(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end) };
}

function openPrintWindowHtml({ title, subtitleLines, bodyHtml }) {
  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) {
    alert("Pop-up blocked! Please allow pop-ups for printing.");
    return;
  }

  const subtitles = (subtitleLines || []).map((x) => `<div class="muted">${x}</div>`).join("");

  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 18px; color:#111; }
      h1 { margin:0 0 6px; font-size: 20px; }
      .muted { color:#555; margin:2px 0; font-size:12px; }
      .meta { margin: 10px 0 14px; display:flex; gap:12px; flex-wrap:wrap; }
      .chip { border:1px solid #ddd; border-radius:999px; padding:6px 10px; font-size:12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border:1px solid #ddd; padding:8px; font-size:12px; }
      th { background:#f6f7f8; text-align:left; }
      .right { text-align:right; }
      .section-block{ margin-top:16px; }
      .section-title{ font-weight:700; margin-top:14px; }
      .section-sub{ color:#555; font-size:12px; margin-top:2px; }
      @media print { button { display:none; } }
    </style>
  </head>
  <body>
    <button onclick="window.print()">Print</button>
    <h1>${escapeHtml(title)}</h1>
    ${subtitles}
    <div class="muted">Printed at: <b>${escapeHtml(new Date().toLocaleString())}</b></div>
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

    const bodyHtml = `
      <div class="meta">
        <div class="chip">Origin: <b>${escapeHtml(sectionTitle)}</b></div>
        <div class="chip">Entries: <b>${entries.length}</b></div>
        <div class="chip">Total Amount: <b>${escapeHtml(formatMoney(totalAmount))}</b></div>
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
      </table>
    `;

    const rangeLine = (from || to)
      ? `Date Range: <b>${escapeHtml(from || "—")}</b> to <b>${escapeHtml(to || "—")}</b>`
      : `Date Range: <b>All</b>`;

    openPrintWindowHtml({
      title: "Cheque Register — Section-wise",
      subtitleLines: [
        `Origin Section: <b>${escapeHtml(sectionTitle)}</b>`,
        rangeLine,
      ],
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

// ✅ Monthly report grouped by origin section
async function printMonthlyReportGrouped() {
  const month = Number(byId("reportMonth").value);
  const year = Number(byId("reportYear").value);
  const originId = byId("reportOrigin")?.value || "";

  if (!year || year < 2000) return alert("Valid year দিন");

  const { from, to } = monthRange(year, month);

  try {
    const entries = await fetchAllEntriesForPrint({
      origin_section_id: originId || "",
      from,
      to,
    });

    // sort (date, entry)
    entries.sort((a, b) => {
      const da = String(a.received_date || "");
      const db = String(b.received_date || "");
      if (da !== db) return da.localeCompare(db);
      return Number(a.entry_no || 0) - Number(b.entry_no || 0);
    });

    // group by origin section
    const groups = new Map(); // key: origin_section_id, value: rows[]
    for (const r of entries) {
      const key = String(r.origin_section_id || "");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    // build HTML blocks
    let grandAmount = 0;
    let grandCount = 0;

    const blocks = Array.from(groups.entries())
      .sort((a, b) => sectionName(a[0]).localeCompare(sectionName(b[0])))
      .map(([originKey, rows]) => {
        // SL starts at 1 per section (user requirement)
        const sectionTotal = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        grandAmount += sectionTotal;
        grandCount += rows.length;

        const secTitle = sectionName(originKey);

        const tbody = rows
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

        return `
          <div class="section-block">
            <div class="section-title">Origin: ${escapeHtml(secTitle)}</div>
            <div class="section-sub">Entries: <b>${rows.length}</b> • Total Amount: <b>${escapeHtml(formatMoney(sectionTotal))}</b></div>

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
                ${tbody || `<tr><td colspan="8" style="text-align:center;color:#666;">No data</td></tr>`}
              </tbody>
            </table>
          </div>
        `;
      })
      .join("");

    closeMonthlyModal();

    const monthLabel = `${year}-${String(month).padStart(2, "0")}`;
    const scopeLabel = originId ? sectionName(originId) : "All Sections";

    const bodyHtml = `
      <div class="meta">
        <div class="chip">Month: <b>${escapeHtml(monthLabel)}</b></div>
        <div class="chip">Scope: <b>${escapeHtml(scopeLabel)}</b></div>
        <div class="chip">Total Entries: <b>${grandCount}</b></div>
        <div class="chip">Grand Total: <b>${escapeHtml(formatMoney(grandAmount))}</b></div>
      </div>
      ${blocks || `<div class="muted" style="margin-top:12px;">No data</div>`}
    `;

    openPrintWindowHtml({
      title: "Cheque Register — Monthly Report (Section-wise)",
      subtitleLines: [
        `Month: <b>${escapeHtml(monthLabel)}</b>`,
        `Date Range: <b>${escapeHtml(from)}</b> to <b>${escapeHtml(to)}</b>`,
        `Scope: <b>${escapeHtml(scopeLabel)}</b>`,
      ],
      bodyHtml,
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

  // modal close
  byId("btnCancel")?.addEventListener("click", closeModal);
  byId("modalClose")?.addEventListener("click", closeModal);

  // modal close when clicking outside
  const modal = byId("entryModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // monthly modal outside click close
  const mm = byId("monthlyModal");
  if (mm) {
    mm.addEventListener("click", (e) => {
      if (e.target === mm) closeMonthlyModal();
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
