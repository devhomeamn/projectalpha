import {
  byId,
  createMonthOptionsHtml,
  ensureArray,
  escapeHtml,
  formatMoney,
  getFiscalMonthSortIndex,
  getFiscalStartMonth,
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
      { key: "selected_note_nos", label: "Selected Notes" },
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
  adjustment_by_base_summary: {
    title: "Adjustment Report by Base",
    columns: [
      { key: "base_name", label: "Base" },
      { key: "base_code", label: "Base Code" },
      { key: "given_amount", label: "Given (Issued)", money: true, right: true },
      { key: "adjusted_amount", label: "Adjusted", money: true, right: true },
      { key: "unadjusted_amount", label: "Unadjusted", money: true, right: true },
    ],
    kpi: { budget: null, issued: "given_amount", adjusted: "adjusted_amount", pending: "unadjusted_amount" },
  },
  adjustment_by_base_detail: {
    title: "Adjustment Report by Base (Code-wise)",
    columns: [
      { key: "base_name", label: "Base" },
      { key: "code", label: "Code" },
      { key: "khat_name_bn", label: "Khat" },
      { key: "given_amount", label: "Given (Issued)", money: true, right: true },
      { key: "adjusted_amount", label: "Adjusted", money: true, right: true },
      { key: "unadjusted_amount", label: "Unadjusted", money: true, right: true },
    ],
    kpi: { budget: null, issued: "given_amount", adjusted: "adjusted_amount", pending: "unadjusted_amount" },
  },
  adjustment_period_detail: {
    title: "Adjustment Period Detail",
    columns: [
      { key: "adjustment_date", label: "Adjustment Date" },
      { key: "adjustment_ref_no", label: "Ref No" },
      { key: "selected_periods", label: "Adjusted Against (Periods)" },
      { key: "selected_pakkhiks", label: "Pakkhik Scope" },
      { key: "code", label: "Code" },
      { key: "khat_name_bn", label: "Khat" },
      { key: "given_amount", label: "Given (Issued)", money: true, right: true },
      { key: "adjusted_amount", label: "Adjusted", money: true, right: true },
      { key: "unadjusted_amount", label: "Unadjusted", money: true, right: true },
      { key: "selected_note_nos", label: "Selected Notes" },
    ],
    kpi: { budget: null, issued: "given_amount", adjusted: "adjusted_amount", pending: "unadjusted_amount" },
  },
  code_wise_details: {
    title: "Code-wise Monthly Issue Report",
    columns: [
      { key: "period_label", label: "Period" },
      { key: "budget_amount", label: "Budget", money: true, right: true, skipTotal: true },
      { key: "issued_amount", label: "Issued", money: true, right: true },
      { key: "cumulative_issued", label: "Till now Issued", money: true, right: true, skipTotal: true },
      { key: "adjusted_amount", label: "Adjusted", money: true, right: true },
      { key: "pending_adjusted", label: "Pending Adjusted", money: true, right: true },
    ],
    kpi: { budget: null, issued: "issued_amount", adjusted: "adjusted_amount", pending: "pending_adjusted" },
  },
};

const state = {
  bases: [],
  fiscalYears: [],
  financialCodes: [],
  type: "base_yearly",
  view: "default",
  meta: null,
  rows: [],
  hasLoaded: false,
};

const REPORT_OFFICE_TITLE = "Office of the SFC Air";
const REPORT_SECTION_TITLE = "Imprest Section";

function getSelectedFiscalYearStartMonth() {
  const fiscalYearId = Number(byId("repFy")?.value || 0);
  if (!Number.isFinite(fiscalYearId) || fiscalYearId <= 0) return 7;
  const fiscalYear = ensureArray(state.fiscalYears).find((row) => Number(row?.id) === fiscalYearId);
  return getFiscalStartMonth(fiscalYear, 7);
}

function setMonthFilterOptions(selected = null) {
  const monthSelect = byId("repMonth");
  if (!monthSelect) return;
  const selectedMonth = Number(selected ?? monthSelect.value);
  const safeSelectedMonth = Number.isFinite(selectedMonth) && selectedMonth >= 1 && selectedMonth <= 12 ? selectedMonth : null;
  monthSelect.innerHTML =
    '<option value="">All</option>' + createMonthOptionsHtml(safeSelectedMonth, getSelectedFiscalYearStartMonth());
  monthSelect.value = safeSelectedMonth ? String(safeSelectedMonth) : "";
}

function setFilterOptions() {
  byId("repBase").innerHTML =
    '<option value="">All</option>' +
    state.bases.map((r) => `<option value="${Number(r.id)}">${escapeHtml(r.base_name)} (${escapeHtml(r.base_code)})</option>`).join("");

  byId("repCode").innerHTML =
    '<option value="">All</option>' +
    state.financialCodes.map((r) => `<option value="${Number(r.id)}">${escapeHtml(r.code)} - ${escapeHtml(r.khat_name_bn || r.khat_name_en || "-")}</option>`).join("");

  byId("repFy").innerHTML =
    '<option value="">All</option>' +
    state.fiscalYears.map((r) => `<option value="${Number(r.id)}">${escapeHtml(r.name)}</option>`).join("");

  setMonthFilterOptions();
}

function getConfig() {
  if (state.type === "adjustment_by_base") {
    return state.view === "base_summary"
      ? REPORT_CONFIG.adjustment_by_base_summary
      : REPORT_CONFIG.adjustment_by_base_detail;
  }
  return REPORT_CONFIG[state.type] || REPORT_CONFIG.base_yearly;
}

function compactList(values, max = 6) {
  const rows = ensureArray(values).map((x) => String(x || "").trim()).filter(Boolean);
  if (rows.length <= max) return rows.join(", ");
  return `${rows.slice(0, max).join(", ")} ... +${rows.length - max}`;
}

function getSelectedOptionText(id) {
  const el = byId(id);
  if (!el) return "";
  const option = el.options?.[el.selectedIndex] || null;
  return String(option?.textContent || "").trim();
}

function normalizeFilterLabel(text) {
  const value = String(text || "").trim();
  if (!value || value.toLowerCase() === "all") return "";
  return value;
}

function resolveReportTitle(config) {
  if (state.type !== "code_yearly") return config.title;
  const baseName = normalizeFilterLabel(state.meta?.base_name || getSelectedOptionText("repBase"));
  if (!baseName) return config.title;
  return `${config.title} - ${baseName}`;
}

function buildReportContextText() {
  const meta = state.meta || {};
  const parts = [];

  if (state.type === "adjustment_period_detail") {
    if (meta.base_name) parts.push(`Base: ${meta.base_name}`);
    if (meta.fiscal_year_name) parts.push(`FY: ${meta.fiscal_year_name}`);
    if (meta.requested_month) parts.push(`Requested Month: ${meta.requested_month}`);
    if (meta.requested_pakkhik) parts.push(`Requested Pakkhik: ${meta.requested_pakkhik}`);
    if (ensureArray(meta.scope_pakkhiks).length) {
      parts.push(`Adjusted Against Pakkhik: ${compactList(meta.scope_pakkhiks, 8)}`);
    }
    if (ensureArray(meta.scope_periods).length) {
      parts.push(`Periods: ${compactList(meta.scope_periods, 6)}`);
    }
    return parts.join(" | ");
  }

  if (state.type === "code_yearly") {
    const baseName = normalizeFilterLabel(meta.base_name || getSelectedOptionText("repBase"));
    const fiscalYearName = normalizeFilterLabel(meta.fiscal_year_name || getSelectedOptionText("repFy"));
    if (baseName) parts.push(`Base: ${baseName}`);
    if (fiscalYearName) parts.push(`FY: ${fiscalYearName}`);
    return parts.join(" | ");
  }

  if (state.type === "code_wise_details") {
    const baseName = normalizeFilterLabel(getSelectedOptionText("repBase"));
    const fiscalYearName = normalizeFilterLabel(getSelectedOptionText("repFy"));
    const codeLabel = normalizeFilterLabel(getSelectedOptionText("repCode"));
    const monthName = normalizeFilterLabel(getSelectedOptionText("repMonth"));
    const pakkhikLabel = normalizeFilterLabel(getSelectedOptionText("repPakkhik"));
    const demandTypeLabel = normalizeFilterLabel(getSelectedOptionText("repDemandType"));
    if (baseName) parts.push(`Base: ${baseName}`);
    if (fiscalYearName) parts.push(`FY: ${fiscalYearName}`);
    if (codeLabel) parts.push(`Code: ${codeLabel}`);
    if (monthName) parts.push(`Month: ${monthName}`);
    if (pakkhikLabel) parts.push(`Pakkhik: ${pakkhikLabel}`);
    if (demandTypeLabel) parts.push(`Demand Type: ${demandTypeLabel}`);
    return parts.join(" | ");
  }

  return "";
}

function formatMoneyByColumn(value, colKey) {
  const n = toNumber(value);
  if (state.type === "code_yearly" && colKey === "pending_adjustment" && n < 0) {
    return `(${formatMoney(Math.abs(n))})`;
  }
  if (state.type === "code_wise_details" && colKey === "pending_adjusted" && n < 0) {
    return `(${formatMoney(Math.abs(n))})`;
  }
  return formatMoney(n);
}

function codeWiseBraceSvg(role) {
  if (role === "start") {
    return `<svg viewBox="0 0 16 24" aria-hidden="true" focusable="false"><path d="M13 2 C7 2 7 6 7 10 L7 24" /></svg>`;
  }
  if (role === "mid") {
    return `<svg viewBox="0 0 16 24" aria-hidden="true" focusable="false"><path d="M7 0 L7 24" /></svg>`;
  }
  if (role === "end") {
    return `<svg viewBox="0 0 16 24" aria-hidden="true" focusable="false"><path d="M7 0 L7 14 C7 18 7 22 13 22" /></svg>`;
  }
  return "";
}

function renderCodeWisePeriodCell(row) {
  const label = escapeHtml(row?.period_label ?? "-");
  const role = String(row?.brace_role || "none").toLowerCase();
  const svg = codeWiseBraceSvg(role);
  if (!svg) return label;
  return `<span class="imp-period-cell"><span class="imp-period-brace">${svg}</span><span class="imp-period-text">${label}</span></span>`;
}

function formatReportCell(row, col) {
  const value = row?.[col.key];
  if (state.type === "code_wise_details" && col.key === "period_label") {
    return renderCodeWisePeriodCell(row);
  }
  if (!col.money) return escapeHtml(value ?? "-");
  if (value === null || value === undefined || String(value).trim() === "") return "-";
  return formatMoneyByColumn(value, col.key);
}

function getColumnTotals(rows, config) {
  const totals = {};
  config.columns.forEach((col) => {
    if (!col.money || col.skipTotal) return;
    const sum = rows.reduce((acc, row) => acc + toNumber(row?.[col.key]), 0);
    totals[col.key] = Number(sum.toFixed(2));
  });
  return totals;
}

function normalizeRowsByReportType(rows, type) {
  const list = ensureArray(rows);
  if (type !== "code_yearly") return list;
  return list.map((row) => {
    const issued = toNumber(row?.total_issued, 0);
    const adjusted = toNumber(row?.total_adjusted, 0);
    return {
      ...(row || {}),
      pending_adjustment: Number((issued - adjusted).toFixed(2)),
    };
  });
}

function renderFooter(config) {
  const tfoot = byId("repFoot");
  if (!tfoot) return;

  const hasMoneyColumn = config.columns.some((col) => col.money);
  if (!state.rows.length || !hasMoneyColumn) {
    tfoot.innerHTML = "";
    return;
  }

  const totals = getColumnTotals(state.rows, config);
  const cells = config.columns
    .map((col) => {
      if (!col.money) return `<td class="imp-total-empty">-</td>`;
      if (col.skipTotal) return `<td class="imp-total-empty">-</td>`;
      const totalValue = toNumber(totals[col.key]);
      const isNegativeMoney = totalValue < 0;
      const className = `${col.right ? "imp-right" : ""}${isNegativeMoney ? " imp-negative" : ""}`.trim();
      return `<td class="${className}">${formatMoneyByColumn(totalValue, col.key)}</td>`;
    })
    .join("");

  tfoot.innerHTML = `<tr><td class="imp-total-label">Total</td>${cells}</tr>`;
}

function readFilters() {
  return {
    type: String(byId("repType")?.value || "base_yearly"),
    base_id: byId("repBase")?.value || "",
    financial_code_id: byId("repCode")?.value || "",
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

  const budgetValue =
    state.type === "code_wise_details"
      ? toNumber(state.meta?.budget_amount, 0)
      : sumOf(config.kpi.budget);

  return {
    count: rows.length,
    budget: budgetValue,
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
  byId("repTableTitle").textContent = resolveReportTitle(config);
  const contextEl = byId("repContext");
  if (contextEl) {
    contextEl.textContent = buildReportContextText();
  }

  byId("repHead").innerHTML = `
    <tr>
      <th style="width:60px;">SL</th>
      ${config.columns
        .map((col) => `<th class="${col.right ? "imp-right" : ""}">${escapeHtml(col.label)}</th>`)
        .join("")}
    </tr>
  `;

  const tbody = byId("repRows");
  const tfoot = byId("repFoot");
  if (!state.rows.length) {
    const emptyMessage = state.hasLoaded
      ? "No report data found"
      : "Select filters and click Load to view report data";
    tbody.innerHTML = `<tr><td colspan="${config.columns.length + 1}" class="imp-empty">${emptyMessage}</td></tr>`;
    if (tfoot) tfoot.innerHTML = "";
    return;
  }

  tbody.innerHTML = state.rows
    .map((row, idx) => {
      const cells = config.columns
        .map((col) => {
          const value = row[col.key];
          const text = formatReportCell(row, col);
          const isNegativeMoney = col.money && toNumber(value) < 0;
          const className = `${col.right ? "imp-right" : ""}${isNegativeMoney ? " imp-negative" : ""}`;
          return `<td class="${className.trim()}">${text}</td>`;
        })
        .join("");
      const isBaseSummaryRow =
        state.type === "adjustment_by_base" &&
        state.view === "base_summary" &&
        Number(row.base_id || 0) > 0;
      const attrs = isBaseSummaryRow
        ? ` data-base-id="${Number(row.base_id)}" title="Click to view code-wise adjustment"`
        : "";
      const style = isBaseSummaryRow ? ` style="cursor:pointer;"` : "";

      return `<tr${attrs}${style}><td>${idx + 1}</td>${cells}</tr>`;
    })
    .join("");

  renderFooter(config);
}

async function loadReport() {
  const filters = readFilters();
  state.type = filters.type;

  if (state.type === "code_wise_details" && (!filters.fiscal_year_id || !filters.financial_code_id)) {
    state.hasLoaded = false;
    state.view = "default";
    state.meta = null;
    state.rows = [];
    renderTable();
    renderKpis();
    showToast("Select Fiscal Year and Code for monthly code-wise issue report", "warn");
    return;
  }

  const params = new URLSearchParams({ type: filters.type });
  ["base_id", "fiscal_year_id", "financial_code_id", "month", "demand_type", "pakkhik"].forEach((key) => {
    if (filters[key]) params.set(key, String(filters[key]));
  });

  state.hasLoaded = true;
  const out = await imprestFetch(`/reports?${params.toString()}`);
  state.view = String(out.view || "default").trim().toLowerCase() || "default";
  state.meta = out.meta || null;
  state.rows = normalizeRowsByReportType(out.data, state.type);

  if (state.type === "monthly_pakkhik") {
    const fiscalStartMonth = getSelectedFiscalYearStartMonth();
    state.rows.sort((a, b) => {
      if (a.base_name !== b.base_name) return String(a.base_name || "").localeCompare(String(b.base_name || ""));
      return getFiscalMonthSortIndex(a.month, fiscalStartMonth) - getFiscalMonthSortIndex(b.month, fiscalStartMonth);
    });
  }

  renderTable();
  renderKpis();
}

function buildPrintHtml() {
  const config = getConfig();
  const contextText = buildReportContextText();
  const totals = getColumnTotals(state.rows, config);
  const hasMoneyColumn = config.columns.some((col) => col.money);

  const rowsHtml = state.rows
    .map((row, idx) => {
      const cells = config.columns
        .map((col) => {
          const text = formatReportCell(row, col);
          const align = col.right ? "text-align:right;" : "";
          return `<td style="${align}">${text}</td>`;
        })
        .join("");
      return `<tr><td>${idx + 1}</td>${cells}</tr>`;
    })
    .join("");

  const totalRowHtml = hasMoneyColumn && state.rows.length
    ? `<tr class="print-total-row">
         <td><strong>Total</strong></td>
          ${config.columns
            .map((col) => {
              if (col.skipTotal) return "<td>-</td>";
              if (!col.money) return "<td>-</td>";
              const value = toNumber(totals[col.key]);
              const align = col.right ? "text-align:right;" : "";
              const color = value < 0 ? "color:#b91c1c;font-weight:700;" : "";
              return `<td style="${align}${color}">${formatMoneyByColumn(value, col.key)}</td>`;
            })
            .join("")}
       </tr>`
    : "";

  const tbodyHtml = state.rows.length
    ? `${rowsHtml}${totalRowHtml}`
    : `<tr><td colspan="${config.columns.length + 1}" style="text-align:center;">No data</td></tr>`;

  const headerCells = config.columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join("");

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @font-face { font-family: "SiyamRupaliBN"; src: url("/fonts/Siyamrupali.ttf") format("truetype"); }
          @page { size: A4 landscape; margin: 10mm; }
          body { margin: 0; font-family: "SiyamRupaliBN", Arial, sans-serif; color: #000; }
          .report-head { text-align: center; margin-bottom: 8px; }
          .report-head .office { margin: 0; font-size: 28px; font-weight: 900; }
          .report-head .section { margin: 2px 0 0; font-size: 18px; font-weight: 800; }
          .report-head .title { margin: 4px 0 0; font-size: 22px; font-weight: 900; }
          .report-head .context { margin: 4px 0 0; font-size: 14px; font-weight: 700; }
          .meta { margin-bottom: 8px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 5px 6px; font-size: 12px; }
          th { text-align: center; background: #f1f5f9; }
          .print-total-row td { background: #eef3fb; font-weight: 800; }
          .imp-period-cell { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
          .imp-period-brace { display: inline-flex; width: 10px; min-width: 10px; height: 18px; overflow: hidden; }
          .imp-period-brace svg { display: block; width: 10px !important; height: 18px !important; }
          .imp-period-brace path {
            fill: none;
            stroke: #334155;
            stroke-width: 1.6;
            stroke-linecap: round;
            stroke-linejoin: round;
            vector-effect: non-scaling-stroke;
          }
          .imp-period-text { display: inline-block; }
        </style>
      </head>
      <body>
        <div class="report-head">
          <p class="office">${escapeHtml(REPORT_OFFICE_TITLE)}</p>
          <p class="section">${escapeHtml(REPORT_SECTION_TITLE)}</p>
          <p class="title">${escapeHtml(resolveReportTitle(config))}</p>
          ${contextText ? `<p class="context">${escapeHtml(contextText)}</p>` : ""}
        </div>
        <table>
          <thead>
            <tr>
              <th>SL</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>${tbodyHtml}</tbody>
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
  const [basesOut, fyOut, codesOut] = await Promise.all([
    imprestFetch("/bases"),
    imprestFetch("/fiscal-years"),
    imprestFetch("/financial-codes"),
  ]);
  state.bases = ensureArray(basesOut.data);
  state.fiscalYears = ensureArray(fyOut.data);
  state.financialCodes = ensureArray(codesOut.data);
  setFilterOptions();
}

function bindEvents() {
  byId("repLoadBtn")?.addEventListener("click", () => loadReport().catch((err) => showToast(err.message, "error")));

  byId("repClearBtn")?.addEventListener("click", () => {
    byId("repType").value = "base_yearly";
    byId("repBase").value = "";
    byId("repCode").value = "";
    byId("repFy").value = "";
    setMonthFilterOptions("");
    byId("repDemandType").value = "";
    byId("repPakkhik").value = "";
    state.type = "base_yearly";
    state.hasLoaded = false;
    state.view = "default";
    state.meta = null;
    state.rows = [];
    renderTable();
    renderKpis();
  });

  byId("repType")?.addEventListener("change", () => {
    state.type = byId("repType")?.value || "base_yearly";
    state.hasLoaded = false;
    state.view = "default";
    state.meta = null;
    state.rows = [];
    renderTable();
    renderKpis();
  });
  byId("repFy")?.addEventListener("change", () => setMonthFilterOptions());
  byId("repRows")?.addEventListener("click", (e) => {
    if (!(state.type === "adjustment_by_base" && state.view === "base_summary")) return;
    const row = e.target.closest("tr[data-base-id]");
    if (!row) return;
    const baseId = Number(row.getAttribute("data-base-id") || 0);
    if (!baseId) return;
    byId("repBase").value = String(baseId);
    loadReport().catch((err) => showToast(err.message, "error"));
  });
  byId("repPrintBtn")?.addEventListener("click", printReport);
}

async function init() {
  bindEvents();
  await loadMasters();
  state.type = byId("repType")?.value || "base_yearly";
  state.hasLoaded = false;
  state.view = "default";
  state.meta = null;
  state.rows = [];
  renderTable();
  renderKpis();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message || "Failed to initialize imprest report", "error"));
});
