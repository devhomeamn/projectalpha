import {
  byId,
  createMonthOptionsHtml,
  ensureArray,
  escapeHtml,
  formatMoney,
  getPakkhikLabel,
  imprestFetch,
  normalizeStatusClass,
  showToast,
} from "./imprest-common.js";

const state = {
  bases: [],
  fiscalYears: [],
  rows: [],
};

function setFilterOptions() {
  byId("repBase").innerHTML =
    '<option value="">All</option>' +
    state.bases.map((r) => `<option value="${Number(r.id)}">${escapeHtml(r.base_name)} (${escapeHtml(r.base_code)})</option>`).join("");

  byId("repFy").innerHTML =
    '<option value="">All</option>' +
    state.fiscalYears.map((r) => `<option value="${Number(r.id)}">${escapeHtml(r.name)}</option>`).join("");

  byId("repMonth").innerHTML = '<option value="">All</option>' + createMonthOptionsHtml();
  byId("repPakkhik").innerHTML = `
    <option value="">All</option>
    <option value="FIRST_HALF">1st Half</option>
    <option value="SECOND_HALF">2nd Half</option>
    <option value="SUPPLEMENTARY">Supplementary</option>
  `;
}

function readFilters() {
  return {
    base_id: byId("repBase")?.value || "",
    fiscal_year_id: byId("repFy")?.value || "",
    month: byId("repMonth")?.value || "",
    pakkhik: byId("repPakkhik")?.value || "",
    status: byId("repStatus")?.value || "",
    q: String(byId("repSearch")?.value || "").trim(),
  };
}

function aggregate(rows) {
  return rows.reduce(
    (acc, row) => {
      acc.notes += 1;
      acc.budget += Number(row.total_budget || 0);
      acc.claim += Number(row.total_current_claim || 0);
      acc.remaining += Number(row.total_remaining || 0);
      return acc;
    },
    { notes: 0, budget: 0, claim: 0, remaining: 0 }
  );
}

function renderKpis() {
  const ag = aggregate(state.rows);
  byId("repKpiNotes").textContent = String(ag.notes);
  byId("repKpiBudget").textContent = formatMoney(ag.budget);
  byId("repKpiClaim").textContent = formatMoney(ag.claim);
  byId("repKpiRemaining").textContent = formatMoney(ag.remaining);
}

function renderRows() {
  const tbody = byId("repRows");
  if (!tbody) return;

  if (!state.rows.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="imp-empty">No report data found</td></tr>';
    return;
  }

  tbody.innerHTML = state.rows
    .map((row, idx) => {
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(row.note_no || "-")}</td>
          <td>${escapeHtml(row.base?.base_name || "-")}</td>
          <td>${escapeHtml(row.fiscal_year?.name || "-")}</td>
          <td>${escapeHtml(row.month_name || "-")} (${escapeHtml(getPakkhikLabel(row.pakkhik))})</td>
          <td><span class="imp-status ${normalizeStatusClass(row.status)}">${escapeHtml(row.status || "-")}</span></td>
          <td class="imp-right">${formatMoney(row.total_budget)}</td>
          <td class="imp-right">${formatMoney(row.total_previous_expense)}</td>
          <td class="imp-right">${formatMoney(row.total_current_claim)}</td>
          <td class="imp-right">${formatMoney(row.total_remaining)}</td>
        </tr>
      `;
    })
    .join("");
}

async function fetchAllRows() {
  const filters = readFilters();
  const all = [];

  let page = 1;
  const limit = 100;
  let total = 0;

  while (page <= 20) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    ["base_id", "fiscal_year_id", "month", "pakkhik", "status", "q"].forEach((key) => {
      if (filters[key]) params.set(key, String(filters[key]));
    });

    const out = await imprestFetch(`/notes?${params.toString()}`);
    const rows = ensureArray(out.data);
    total = Number(out.total || rows.length);

    all.push(...rows);
    if (all.length >= total || !rows.length) break;
    page += 1;
  }

  state.rows = all;
}

async function loadReport() {
  await fetchAllRows();
  renderRows();
  renderKpis();
}

function buildPrintHtml() {
  const ag = aggregate(state.rows);
  const rowsHtml = (state.rows || [])
    .map((row, idx) => {
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(row.note_no || "-")}</td>
          <td>${escapeHtml(row.base?.base_name || "-")}</td>
          <td>${escapeHtml(row.fiscal_year?.name || "-")}</td>
          <td>${escapeHtml(row.month_name || "-")} (${escapeHtml(getPakkhikLabel(row.pakkhik))})</td>
          <td>${escapeHtml(row.status || "-")}</td>
          <td style="text-align:right;">${formatMoney(row.total_budget)}</td>
          <td style="text-align:right;">${formatMoney(row.total_previous_expense)}</td>
          <td style="text-align:right;">${formatMoney(row.total_current_claim)}</td>
          <td style="text-align:right;">${formatMoney(row.total_remaining)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @font-face { font-family: "SiyamRupaliBN"; src: url("/fonts/Siyamrupali.ttf") format("truetype"); }
          @page { size: A4 landscape; margin: 10mm; }
          body { margin: 0; font-family: "SiyamRupaliBN", Arial, sans-serif; color: #000; }
          h2 { margin: 0 0 8px; }
          .meta { margin-bottom: 8px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 5px 6px; font-size: 12px; }
          th { text-align: center; background: #f1f5f9; }
          tfoot td { font-weight: 700; }
        </style>
      </head>
      <body>
        <h2>Imprest Report Summary</h2>
        <div class="meta">Total Notes: ${ag.notes} | Budget: ${formatMoney(ag.budget)} | Claim: ${formatMoney(ag.claim)} | Remaining: ${formatMoney(ag.remaining)}</div>
        <table>
          <thead>
            <tr>
              <th>SL</th>
              <th>Note No</th>
              <th>Base</th>
              <th>Fiscal Year</th>
              <th>Period</th>
              <th>Status</th>
              <th>Budget</th>
              <th>Previous</th>
              <th>Claim</th>
              <th>Remaining</th>
            </tr>
          </thead>
          <tbody>${rowsHtml || '<tr><td colspan="10" style="text-align:center;">No data</td></tr>'}</tbody>
        </table>
      </body>
    </html>
  `;
}

function printReport() {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(buildPrintHtml());
  doc.close();

  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 1000);
  }, 280);
}

async function loadMasters() {
  const [basesOut, fyOut] = await Promise.all([imprestFetch("/bases"), imprestFetch("/fiscal-years")]);
  state.bases = ensureArray(basesOut.data);
  state.fiscalYears = ensureArray(fyOut.data);
  setFilterOptions();
}

function bindEvents() {
  byId("repLoadBtn")?.addEventListener("click", () => loadReport().catch((err) => showToast(err.message, "error")));
  byId("repClearBtn")?.addEventListener("click", () => {
    byId("repBase").value = "";
    byId("repFy").value = "";
    byId("repMonth").value = "";
    byId("repPakkhik").value = "";
    byId("repStatus").value = "";
    byId("repSearch").value = "";
    loadReport().catch((err) => showToast(err.message, "error"));
  });

  byId("repPrintBtn")?.addEventListener("click", printReport);
  byId("repSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadReport().catch((err) => showToast(err.message, "error"));
  });
}

async function init() {
  bindEvents();
  await loadMasters();
  await loadReport();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message || "Failed to initialize imprest report", "error"));
});
