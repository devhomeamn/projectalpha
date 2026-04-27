import {
  byId,
  createMonthOptionsHtml,
  ensureArray,
  escapeHtml,
  formatMoney,
  imprestFetch,
  showToast,
  toNumber,
} from "./imprest-common.js";

const REPORT_CONFIG = {
  base_yearly: {
    title: "Base-wise Yearly Summary",
    columns: [
      { key: "base_name", label: "Base" },
      { key: "budget_amount", label: "Budget", money: true, right: true },
      { key: "total_issued", label: "Total Issued", money: true, right: true },
      { key: "total_adjusted", label: "Total Adjusted", money: true, right: true },
      { key: "pending_adjustment", label: "Pending Adjustment", money: true, right: true },
      { key: "budget_remaining", label: "Budget Remaining", money: true, right: true },
    ],
    kpi: { budget: "budget_amount", issued: "total_issued", adjusted: "total_adjusted", pending: "pending_adjustment" },
  },
  code_yearly: {
    title: "Code-wise Yearly Summary",
    columns: [
      { key: "code", label: "Code" },
      { key: "khat_name_bn", label: "Khat" },
      { key: "budget_amount", label: "Budget", money: true, right: true },
      { key: "total_issued", label: "Total Issued", money: true, right: true },
      { key: "total_adjusted", label: "Total Adjusted", money: true, right: true },
      { key: "pending_adjustment", label: "Pending Adjustment", money: true, right: true },
      { key: "budget_remaining", label: "Budget Remaining", money: true, right: true },
    ],
    kpi: { budget: "budget_amount", issued: "total_issued", adjusted: "total_adjusted", pending: "pending_adjustment" },
  },
  monthly_pakkhik: {
    title: "Monthly Pakkhik Report",
    columns: [
      { key: "base_name", label: "Base" },
      { key: "month_name", label: "Month" },
      { key: "first_half_issued", label: "1st Pakkhik Issued", money: true, right: true },
      { key: "second_half_issued", label: "2nd Pakkhik Issued", money: true, right: true },
      { key: "complementary_issued", label: "Complementary Issued", money: true, right: true },
      { key: "total_issued", label: "Total Issued", money: true, right: true },
      { key: "adjusted_amount", label: "Adjusted", money: true, right: true },
      { key: "pending_adjustment", label: "Pending", money: true, right: true },
    ],
    kpi: { budget: null, issued: "total_issued", adjusted: "adjusted_amount", pending: "pending_adjustment" },
  },
  dispatch_note_adjustment: {
    title: "Dispatch/Note-wise Adjustment Report",
    columns: [
      { key: "note_no", label: "Note No" },
      { key: "dispatch_no", label: "Dispatch No" },
      { key: "base_name", label: "Base" },
      { key: "month_name", label: "Month" },
      { key: "demand_type", label: "Demand Type" },
      { key: "code", label: "Code" },
      { key: "issued_amount", label: "Issued Amount", money: true, right: true },
      { key: "adjusted_amount", label: "Adjusted Expense", money: true, right: true },
      { key: "pending_adjustment", label: "Pending Adjustment", money: true, right: true },
    ],
    kpi: { budget: null, issued: "issued_amount", adjusted: "adjusted_amount", pending: "pending_adjustment" },
  },
  budget_utilization: {
    title: "Budget Utilization Report",
    columns: [
      { key: "base_name", label: "Base" },
      { key: "code", label: "Code" },
      { key: "budget_amount", label: "Budget", money: true, right: true },
      { key: "cumulative_issued", label: "Cumulative Issued", money: true, right: true },
      { key: "cumulative_adjusted", label: "Cumulative Adjusted", money: true, right: true },
      { key: "pending_adjustment", label: "Pending Adjustment", money: true, right: true },
      { key: "remaining_budget", label: "Remaining Budget", money: true, right: true },
    ],
    kpi: { budget: "budget_amount", issued: "cumulative_issued", adjusted: "cumulative_adjusted", pending: "pending_adjustment" },
  },
};

const state = {
  bases: [],
  fiscalYears: [],
  type: "base_yearly",
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
}

function getConfig() {
  return REPORT_CONFIG[state.type] || REPORT_CONFIG.base_yearly;
}

function readFilters() {
  return {
    type: String(byId("repType")?.value || "base_yearly"),
    base_id: byId("repBase")?.value || "",
    fiscal_year_id: byId("repFy")?.value || "",
    month: byId("repMonth")?.value || "",
    demand_type: byId("repDemandType")?.value || "",
    pakkhik: byId("repPakkhik")?.value || "",
  };
}

function aggregateKpis(rows, config) {
  const sumOf = (key) => {
    if (!key) return 0;
    return rows.reduce((sum, row) => sum + toNumber(row[key]), 0);
  };

  return {
    count: rows.length,
    budget: sumOf(config.kpi.budget),
    issued: sumOf(config.kpi.issued),
    adjusted: sumOf(config.kpi.adjusted),
    pending: sumOf(config.kpi.pending),
  };
}

function renderKpis() {
  const config = getConfig();
  const ag = aggregateKpis(state.rows, config);
  byId("repKpiRows").textContent = String(ag.count);
  byId("repKpiBudget").textContent = formatMoney(ag.budget);
  byId("repKpiIssued").textContent = formatMoney(ag.issued);
  byId("repKpiAdjusted").textContent = formatMoney(ag.adjusted);
  byId("repKpiPending").textContent = formatMoney(ag.pending);
}

function renderTable() {
  const config = getConfig();
  byId("repTableTitle").textContent = config.title;

  byId("repHead").innerHTML = `
    <tr>
      <th style="width:60px;">SL</th>
      ${config.columns
        .map((col) => `<th class="${col.right ? "imp-right" : ""}">${escapeHtml(col.label)}</th>`)
        .join("")}
    </tr>
  `;

  const tbody = byId("repRows");
  if (!state.rows.length) {
    tbody.innerHTML = `<tr><td colspan="${config.columns.length + 1}" class="imp-empty">No report data found</td></tr>`;
    return;
  }

  tbody.innerHTML = state.rows
    .map((row, idx) => {
      const cells = config.columns
        .map((col) => {
          const value = row[col.key];
          const text = col.money ? formatMoney(value) : escapeHtml(value ?? "-");
          return `<td class="${col.right ? "imp-right" : ""}">${text}</td>`;
        })
        .join("");

      return `<tr><td>${idx + 1}</td>${cells}</tr>`;
    })
    .join("");
}

async function loadReport() {
  const filters = readFilters();
  state.type = filters.type;

  const params = new URLSearchParams({ type: filters.type });
  ["base_id", "fiscal_year_id", "month", "demand_type", "pakkhik"].forEach((key) => {
    if (filters[key]) params.set(key, String(filters[key]));
  });

  const out = await imprestFetch(`/reports?${params.toString()}`);
  state.rows = ensureArray(out.data);

  renderTable();
  renderKpis();
}

function buildPrintHtml() {
  const config = getConfig();
  const ag = aggregateKpis(state.rows, config);

  const rowsHtml = state.rows
    .map((row, idx) => {
      const cells = config.columns
        .map((col) => {
          const value = row[col.key];
          const text = col.money ? formatMoney(value) : escapeHtml(value ?? "-");
          const align = col.right ? "text-align:right;" : "";
          return `<td style="${align}">${text}</td>`;
        })
        .join("");
      return `<tr><td>${idx + 1}</td>${cells}</tr>`;
    })
    .join("");

  const headerCells = config.columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join("");

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
        </style>
      </head>
      <body>
        <h2>${escapeHtml(config.title)}</h2>
        <div class="meta">
          Rows: ${ag.count} | Budget: ${formatMoney(ag.budget)} | Issued: ${formatMoney(ag.issued)} | Adjusted: ${formatMoney(ag.adjusted)} | Pending: ${formatMoney(ag.pending)}
        </div>
        <table>
          <thead>
            <tr>
              <th>SL</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>${rowsHtml || `<tr><td colspan="${config.columns.length + 1}" style="text-align:center;">No data</td></tr>`}</tbody>
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
    byId("repType").value = "base_yearly";
    byId("repBase").value = "";
    byId("repFy").value = "";
    byId("repMonth").value = "";
    byId("repDemandType").value = "";
    byId("repPakkhik").value = "";
    loadReport().catch((err) => showToast(err.message, "error"));
  });

  byId("repType")?.addEventListener("change", () => loadReport().catch((err) => showToast(err.message, "error")));
  byId("repPrintBtn")?.addEventListener("click", printReport);
}

async function init() {
  bindEvents();
  await loadMasters();
  await loadReport();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message || "Failed to initialize imprest report", "error"));
});
