import {
  byId,
  ensureArray,
  fetchJson,
  formatDateTime,
  formatQty,
  getCurrentMonthYear,
  normalizeStatusClass,
  showToast,
} from "./inventory-common.js";

function readFilters() {
  const month = Number(byId("rpMonth")?.value || 0);
  const year = Number(byId("rpYear")?.value || 0);
  return {
    month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : null,
    year: Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : null,
    from: String(byId("rpFrom")?.value || "").trim(),
    to: String(byId("rpTo")?.value || "").trim(),
    stockQ: String(byId("rpStockSearch")?.value || "").trim(),
    stockStatus: String(byId("rpStockStatus")?.value || "all").trim(),
  };
}

function setKpi(id, value) {
  const el = byId(id);
  if (el) el.textContent = String(value ?? "0");
}

async function loadStockSummary(filters) {
  const params = new URLSearchParams({ page: "1", limit: "100" });
  if (filters.stockQ) params.set("q", filters.stockQ);
  if (filters.stockStatus && filters.stockStatus !== "all") params.set("status", filters.stockStatus);

  const out = await fetchJson(`/inventory/stock-summary?${params.toString()}`);
  const rows = ensureArray(out.data);
  const tbody = byId("rpStockRows");
  if (!tbody) return { total: 0, lowStock: 0 };

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="inv-empty">No stock data found</td></tr>';
    return { total: 0, lowStock: 0 };
  }

  const lowStock = rows.filter((x) => Number(x.current_stock || 0) <= Number(x.minimum_stock || 0)).length;
  tbody.innerHTML = rows
    .map((row, idx) => {
      const low = Number(row.current_stock || 0) <= Number(row.minimum_stock || 0);
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${row.item_code || "-"}</td>
          <td>${row.item_name || "-"}</td>
          <td>${row.category || "-"}</td>
          <td>${formatQty(row.current_stock)}</td>
          <td>${formatQty(row.minimum_stock)}</td>
          <td><span class="inv-status ${normalizeStatusClass(row.status)}">${row.status || "-"}</span></td>
          <td><span class="${low ? "inv-low" : "inv-ok"}">${low ? "Low" : "OK"}</span></td>
        </tr>
      `;
    })
    .join("");

  return { total: rows.length, lowStock };
}

function statusChips(statusCounts = {}) {
  const keys = Object.keys(statusCounts || {});
  if (!keys.length) return '<span class="inv-chip">No status data</span>';
  return keys
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `<span class="inv-chip">${key}: ${Number(statusCounts[key] || 0)}</span>`)
    .join("");
}

async function loadMonthlyReport(filters) {
  if (!filters.month || !filters.year) {
    throw new Error("Valid month/year required for monthly report");
  }

  const out = await fetchJson(`/inventory/reports/monthly?month=${filters.month}&year=${filters.year}`);
  const summary = byId("rpMonthlySummary");
  const rowsEl = byId("rpMonthlyRows");
  if (!summary || !rowsEl) return { totalRequisitions: 0 };

  summary.innerHTML = `
    <span class="inv-chip">Month: ${out.month}</span>
    <span class="inv-chip">Year: ${out.year}</span>
    <span class="inv-chip">Total Requisitions: ${Number(out.total_requisitions || 0)}</span>
    <span class="inv-chip">Requested: ${formatQty(out.totals?.requested_qty)}</span>
    <span class="inv-chip">Approved: ${formatQty(out.totals?.approved_qty)}</span>
    <span class="inv-chip">Issued: ${formatQty(out.totals?.issued_qty)}</span>
    ${statusChips(out.status_counts)}
  `;

  const rows = ensureArray(out.section_summary);
  if (!rows.length) {
    rowsEl.innerHTML = '<tr><td colspan="6" class="inv-empty">No monthly section summary found</td></tr>';
    return { totalRequisitions: Number(out.total_requisitions || 0) };
  }

  rowsEl.innerHTML = rows
    .map(
      (row, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${row.section_name || "-"}</td>
        <td>${Number(row.requisitions || 0)}</td>
        <td>${formatQty(row.requested_qty)}</td>
        <td>${formatQty(row.approved_qty)}</td>
        <td>${formatQty(row.issued_qty)}</td>
      </tr>
    `
    )
    .join("");

  return { totalRequisitions: Number(out.total_requisitions || 0) };
}

function statusMixText(statuses = {}) {
  const keys = Object.keys(statuses || {});
  if (!keys.length) return "-";
  return keys
    .sort((a, b) => a.localeCompare(b))
    .map((k) => `${k}:${Number(statuses[k] || 0)}`)
    .join(", ");
}

async function loadSectionWise(filters) {
  const params = new URLSearchParams();
  if (filters.month) params.set("month", String(filters.month));
  if (filters.year) params.set("year", String(filters.year));

  const out = await fetchJson(`/inventory/reports/section-wise?${params.toString()}`);
  const rowsEl = byId("rpSectionRows");
  if (!rowsEl) return;

  const rows = ensureArray(out.sections);
  if (!rows.length) {
    rowsEl.innerHTML = '<tr><td colspan="7" class="inv-empty">No section-wise data found</td></tr>';
    return;
  }

  rowsEl.innerHTML = rows
    .map(
      (row, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${row.section_name || "-"}</td>
        <td>${Number(row.requisitions || 0)}</td>
        <td>${formatQty(row.requested_qty)}</td>
        <td>${formatQty(row.approved_qty)}</td>
        <td>${formatQty(row.issued_qty)}</td>
        <td>${statusMixText(row.statuses)}</td>
      </tr>
    `
    )
    .join("");
}

async function loadTransactions(filters) {
  const params = new URLSearchParams({ page: "1", limit: "100" });
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  const out = await fetchJson(`/inventory/transactions?${params.toString()}`);
  const rows = ensureArray(out.data);
  const tbody = byId("rpTxnRows");
  if (!tbody) return { count: 0 };

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="inv-empty">No transaction found</td></tr>';
    return { count: 0 };
  }

  tbody.innerHTML = rows
    .map(
      (row, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${formatDateTime(row.createdAt)}</td>
        <td>${row.item?.item_code || "-"} - ${row.item?.item_name || "-"}</td>
        <td>${row.transaction_type || "-"}</td>
        <td>${formatQty(row.qty)}</td>
        <td>${formatQty(row.balance_after)}</td>
        <td>${row.section?.name || "-"}</td>
        <td>${row.doneBy?.name || row.doneBy?.username || "-"}</td>
        <td>${row.remarks || "-"}</td>
      </tr>
    `
    )
    .join("");

  return { count: rows.length };
}

async function refreshReports() {
  const filters = readFilters();
  const refreshBtn = byId("rpRefreshBtn");
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Refreshing...";
  }

  try {
    const [stockRes, monthlyRes, sectionRes, txnRes] = await Promise.all([
      loadStockSummary(filters),
      loadMonthlyReport(filters),
      loadSectionWise(filters),
      loadTransactions(filters),
    ]);

    setKpi("rpKpiItems", stockRes.total);
    setKpi("rpKpiLowStock", stockRes.lowStock);
    setKpi("rpKpiMonthlyReq", monthlyRes.totalRequisitions);
    setKpi("rpKpiTxn", txnRes.count);
  } catch (err) {
    showToast(err.message || "Failed to load reports", "error");
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "Refresh Reports";
    }
  }
}

function bindEvents() {
  byId("rpRefreshBtn")?.addEventListener("click", () => {
    refreshReports();
  });

  byId("rpStockSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") refreshReports();
  });
}

async function init() {
  const now = getCurrentMonthYear();
  if (byId("rpMonth")) byId("rpMonth").value = String(now.month);
  if (byId("rpYear")) byId("rpYear").value = String(now.year);
  bindEvents();
  await refreshReports();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message || "Failed to initialize reports", "error"));
});

