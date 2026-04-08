import {
  byId,
  ensureArray,
  fetchJson,
  formatDateTime,
  formatQty,
  getCurrentMonthYear,
  getPagination,
  normalizeStatusClass,
  setButtonBusy,
  showToast,
} from "./inventory-common.js";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const TAB_KEYS = ["summary", "requisition", "issues", "section", "item", "movement"];

const state = {
  activeTab: "summary",
  summary: {},
  filters: {
    month: null,
    year: null,
    section: "all",
    status: "all",
    q: "",
  },
  pages: {
    requisition: { page: 1, limit: 20, total: 0 },
    issues: { page: 1, limit: 20, total: 0 },
    section: { page: 1, limit: 20, total: 0 },
    item: { page: 1, limit: 20, total: 0 },
    movement: { page: 1, limit: 20, total: 0 },
  },
};

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = String(value ?? "");
}

function setLoadingRows(tbodyId, colspan) {
  const tbody = byId(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${colspan}" class="inv-empty">Loading...</td></tr>`;
}

function renderPaginationControls(key) {
  const map = {
    requisition: { prev: "rpReqPrevBtn", next: "rpReqNextBtn", info: "rpReqPageInfo" },
    issues: { prev: "rpIssuePrevBtn", next: "rpIssueNextBtn", info: "rpIssuePageInfo" },
    section: { prev: "rpSectionPrevBtn", next: "rpSectionNextBtn", info: "rpSectionPageInfo" },
    item: { prev: "rpItemPrevBtn", next: "rpItemNextBtn", info: "rpItemPageInfo" },
    movement: { prev: "rpMovementPrevBtn", next: "rpMovementNextBtn", info: "rpMovementPageInfo" },
  };

  const entry = map[key];
  if (!entry) return;

  const pageState = state.pages[key];
  const { totalPages } = getPagination(pageState.total, pageState.page, pageState.limit);
  setText(entry.info, `Page ${pageState.page} / ${totalPages}`);

  const prevBtn = byId(entry.prev);
  const nextBtn = byId(entry.next);
  if (prevBtn) prevBtn.disabled = pageState.page <= 1;
  if (nextBtn) nextBtn.disabled = pageState.page >= totalPages;
}

function setKpis(summary = {}) {
  setText("rpKpiCreated", Number(summary.total_requisitions_created || 0));
  setText("rpKpiForwarded", Number(summary.total_forwarded || 0));
  setText("rpKpiApproved", Number(summary.total_approved || 0));
  setText("rpKpiPartiallyApproved", Number(summary.total_partially_approved || 0));
  setText("rpKpiRejected", Number(summary.total_rejected || 0));
  setText("rpKpiIssued", Number(summary.total_issued || 0));
  setText("rpKpiIssuedQty", formatQty(summary.total_items_issued_qty));
  setText("rpKpiActiveItems", Number(summary.total_active_inventory_items || 0));
  setText("rpKpiLowStock", Number(summary.low_stock_items_count || 0));
}

function populateMonthYearOptions() {
  const now = getCurrentMonthYear();

  const monthSelect = byId("rpMonth");
  if (monthSelect && !monthSelect.options.length) {
    monthSelect.innerHTML = MONTH_NAMES.map(
      (label, idx) => `<option value="${idx + 1}">${label}</option>`
    ).join("");
  }
  if (monthSelect) monthSelect.value = String(now.month);

  const yearSelect = byId("rpYear");
  if (yearSelect && !yearSelect.options.length) {
    const years = [];
    for (let y = now.year + 1; y >= now.year - 8; y -= 1) {
      years.push(`<option value="${y}">${y}</option>`);
    }
    yearSelect.innerHTML = years.join("");
  }
  if (yearSelect) yearSelect.value = String(now.year);
}

async function loadSectionOptions() {
  const out = await fetchJson("/sections");
  const rows = ensureArray(out);
  const select = byId("rpSection");
  if (!select) return;

  const options = ['<option value="all">All Sections</option>']
    .concat(
      rows
        .map((row) => ({
          id: Number(row.id || 0),
          name: String(row.name || `Section #${row.id}`),
        }))
        .filter((row) => row.id > 0)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((row) => `<option value="${row.id}">${row.name}</option>`)
    )
    .join("");

  select.innerHTML = options;
  select.value = "all";
}

function readFilters() {
  const month = toInt(byId("rpMonth")?.value);
  const year = toInt(byId("rpYear")?.value);
  const section = String(byId("rpSection")?.value || "all").trim();
  const status = String(byId("rpStatus")?.value || "all").trim();
  const q = String(byId("rpSearch")?.value || "").trim();

  if (!month || month < 1 || month > 12) throw new Error("Valid month is required");
  if (!year || year < 2000 || year > 2100) throw new Error("Valid year is required");

  return { month, year, section: section || "all", status: status || "all", q };
}

function buildBaseParams(filters) {
  const params = new URLSearchParams({
    month: String(filters.month),
    year: String(filters.year),
  });
  return params;
}

function buildSummaryParams(filters) {
  const params = buildBaseParams(filters);
  if (filters.section && filters.section !== "all") params.set("section", filters.section);
  return params;
}

function buildRequisitionParams(filters, pageState) {
  const params = buildBaseParams(filters);
  params.set("page", String(pageState.page));
  params.set("limit", String(pageState.limit));
  if (filters.section && filters.section !== "all") params.set("section", filters.section);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  return params;
}

function buildIssueParams(filters, pageState) {
  const params = buildBaseParams(filters);
  params.set("page", String(pageState.page));
  params.set("limit", String(pageState.limit));
  if (filters.section && filters.section !== "all") params.set("section", filters.section);
  if (filters.q) params.set("q", filters.q);
  return params;
}

function buildSectionParams(filters, pageState) {
  const params = buildBaseParams(filters);
  params.set("page", String(pageState.page));
  params.set("limit", String(pageState.limit));
  if (filters.section && filters.section !== "all") params.set("section", filters.section);
  return params;
}

function buildItemParams(filters, pageState) {
  const params = buildBaseParams(filters);
  params.set("page", String(pageState.page));
  params.set("limit", String(pageState.limit));
  if (filters.section && filters.section !== "all") params.set("section", filters.section);
  if (filters.q) params.set("q", filters.q);
  return params;
}

function buildMovementParams(filters, pageState) {
  const params = buildBaseParams(filters);
  params.set("page", String(pageState.page));
  params.set("limit", String(pageState.limit));
  if (filters.section && filters.section !== "all") params.set("section", filters.section);
  if (filters.q) params.set("q", filters.q);
  return params;
}

function renderSummaryPanel(summary = {}) {
  const tbody = byId("rpSummaryRows");
  const meta = byId("rpSummaryMeta");
  if (!tbody || !meta) return;

  const monthLabel = MONTH_NAMES[(state.filters.month || 1) - 1] || state.filters.month;
  const sectionLabel = byId("rpSection")?.selectedOptions?.[0]?.textContent || state.filters.section;
  const chips = [
    `Month: ${monthLabel}`,
    `Year: ${state.filters.year}`,
    state.filters.section !== "all" ? `Section Filter: ${sectionLabel}` : "Section Filter: All",
    state.filters.status !== "all"
      ? `Status Filter (Requisition): ${state.filters.status}`
      : "Status Filter (Requisition): All",
  ];
  meta.innerHTML = chips.map((chip) => `<span class="inv-chip">${chip}</span>`).join("");

  const rows = [
    ["Total Requisitions Created", Number(summary.total_requisitions_created || 0)],
    ["Total Forwarded", Number(summary.total_forwarded || 0)],
    ["Total Approved", Number(summary.total_approved || 0)],
    ["Total Partially Approved", Number(summary.total_partially_approved || 0)],
    ["Total Rejected", Number(summary.total_rejected || 0)],
    ["Total Issued", Number(summary.total_issued || 0)],
    ["Total Items Issued Qty", formatQty(summary.total_items_issued_qty)],
    ["Total Active Inventory Items", Number(summary.total_active_inventory_items || 0)],
    ["Low Stock Items Count", Number(summary.low_stock_items_count || 0)],
  ];

  tbody.innerHTML = rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join("");
}

async function loadSummary() {
  const params = buildSummaryParams(state.filters);
  const out = await fetchJson(`/inventory/reports/monthly-summary?${params.toString()}`);
  const summary = out.summary || {};
  state.summary = summary;
  setKpis(summary);
  renderSummaryPanel(summary);
}

async function loadRequisitionStatus() {
  const pageState = state.pages.requisition;
  const params = buildRequisitionParams(state.filters, pageState);
  setLoadingRows("rpReqRows", 9);

  const out = await fetchJson(`/inventory/reports/requisition-status?${params.toString()}`);
  const rows = ensureArray(out.data);
  pageState.page = Number(out.page || pageState.page);
  pageState.limit = Number(out.limit || pageState.limit);
  pageState.total = Number(out.total || rows.length || 0);
  renderPaginationControls("requisition");
  setText("rpReqTotal", pageState.total);

  const tbody = byId("rpReqRows");
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="inv-empty">No requisition found for selected month</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map((row, idx) => {
      const sl = (pageState.page - 1) * pageState.limit + idx + 1;
      return `
        <tr>
          <td>${sl}</td>
          <td>${row.requisition_no || "-"}</td>
          <td>${row.section_name || "-"}</td>
          <td>${row.requested_by || "-"}</td>
          <td><span class="inv-status ${normalizeStatusClass(row.status)}">${row.status || "-"}</span></td>
          <td>${formatDateTime(row.submitted_at)}</td>
          <td>${formatDateTime(row.forwarded_at)}</td>
          <td>${formatDateTime(row.approved_at)}</td>
          <td>${formatDateTime(row.issued_at)}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadMonthlyIssues() {
  const pageState = state.pages.issues;
  const params = buildIssueParams(state.filters, pageState);
  setLoadingRows("rpIssueRows", 10);

  const out = await fetchJson(`/inventory/reports/monthly-issues?${params.toString()}`);
  const rows = ensureArray(out.data);
  pageState.page = Number(out.page || pageState.page);
  pageState.limit = Number(out.limit || pageState.limit);
  pageState.total = Number(out.total || rows.length || 0);
  renderPaginationControls("issues");
  setText("rpIssueGrandTotal", formatQty(out.grand_total_issued_qty));

  const tbody = byId("rpIssueRows");
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="inv-empty">No issued lines found for selected month</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map((row, idx) => {
      const sl = (pageState.page - 1) * pageState.limit + idx + 1;
      return `
        <tr>
          <td>${sl}</td>
          <td>${row.requisition_no || "-"}</td>
          <td>${row.section_name || "-"}</td>
          <td>${row.item_code || "-"} - ${row.item_name || "-"}</td>
          <td>${row.unit || "-"}</td>
          <td>${formatQty(row.requested_qty)}</td>
          <td>${formatQty(row.approved_qty)}</td>
          <td>${formatQty(row.issued_qty)}</td>
          <td>${formatDateTime(row.issue_date)}</td>
          <td>${row.issued_by || "-"}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadSectionConsumption() {
  const pageState = state.pages.section;
  const params = buildSectionParams(state.filters, pageState);
  setLoadingRows("rpSectionRows", 5);

  const out = await fetchJson(`/inventory/reports/section-consumption?${params.toString()}`);
  const rows = ensureArray(out.data);
  pageState.page = Number(out.page || pageState.page);
  pageState.limit = Number(out.limit || pageState.limit);
  pageState.total = Number(out.total || rows.length || 0);
  renderPaginationControls("section");
  setText("rpSectionReqTotal", Number(out.totals?.total_requisitions || 0));
  setText("rpSectionIssuedTotal", formatQty(out.totals?.total_issued_qty));

  const tbody = byId("rpSectionRows");
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="inv-empty">No section-wise monthly data found</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map((row, idx) => {
      const sl = (pageState.page - 1) * pageState.limit + idx + 1;
      return `
        <tr>
          <td>${sl}</td>
          <td>${row.section_name || "-"}</td>
          <td>${Number(row.total_requisitions || 0)}</td>
          <td>${formatQty(row.total_issued_qty)}</td>
          <td>${Number(row.distinct_items || 0)}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadItemConsumption() {
  const pageState = state.pages.item;
  const params = buildItemParams(state.filters, pageState);
  setLoadingRows("rpItemRows", 9);

  const out = await fetchJson(`/inventory/reports/item-consumption?${params.toString()}`);
  const rows = ensureArray(out.data);
  pageState.page = Number(out.page || pageState.page);
  pageState.limit = Number(out.limit || pageState.limit);
  pageState.total = Number(out.total || rows.length || 0);
  renderPaginationControls("item");
  setText("rpItemRequestedTotal", formatQty(out.totals?.total_requested_qty));
  setText("rpItemApprovedTotal", formatQty(out.totals?.total_approved_qty));
  setText("rpItemIssuedTotal", formatQty(out.totals?.total_issued_qty));

  const tbody = byId("rpItemRows");
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="inv-empty">No item-wise monthly data found</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map((row, idx) => {
      const sl = (pageState.page - 1) * pageState.limit + idx + 1;
      const low = String(row.stock_status || "").toLowerCase() === "low";
      return `
        <tr>
          <td>${sl}</td>
          <td>${row.item_code || "-"} - ${row.item_name || "-"}</td>
          <td>${row.unit || "-"}</td>
          <td>${formatQty(row.total_requested_qty)}</td>
          <td>${formatQty(row.total_approved_qty)}</td>
          <td>${formatQty(row.total_issued_qty)}</td>
          <td>${formatQty(row.current_stock)}</td>
          <td>${formatQty(row.minimum_stock)}</td>
          <td><span class="${low ? "inv-low" : "inv-ok"}">${low ? "Low" : "Normal"}</span></td>
        </tr>
      `;
    })
    .join("");
}

async function loadStockMovement() {
  const pageState = state.pages.movement;
  const params = buildMovementParams(state.filters, pageState);
  setLoadingRows("rpMovementRows", 11);

  const out = await fetchJson(`/inventory/reports/stock-movement?${params.toString()}`);
  const rows = ensureArray(out.data);
  pageState.page = Number(out.page || pageState.page);
  pageState.limit = Number(out.limit || pageState.limit);
  pageState.total = Number(out.total || rows.length || 0);
  renderPaginationControls("movement");

  const tbody = byId("rpMovementRows");
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="inv-empty">No stock movement found for selected month</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map((row, idx) => {
      const sl = (pageState.page - 1) * pageState.limit + idx + 1;
      return `
        <tr>
          <td>${sl}</td>
          <td>${formatDateTime(row.date)}</td>
          <td>${row.item_code || "-"} - ${row.item_name || "-"}</td>
          <td>${row.transaction_type || "-"}</td>
          <td>${formatQty(row.qty)}</td>
          <td>${formatQty(row.balance_after)}</td>
          <td>${row.reference_type || "-"}</td>
          <td>${row.reference_id || "-"}</td>
          <td>${row.section_name || "-"}</td>
          <td>${row.done_by || "-"}</td>
          <td>${row.remarks || "-"}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadActiveTabData() {
  if (state.activeTab === "summary") {
    renderSummaryPanel(state.summary);
    return;
  }
  if (state.activeTab === "requisition") {
    await loadRequisitionStatus();
    return;
  }
  if (state.activeTab === "issues") {
    await loadMonthlyIssues();
    return;
  }
  if (state.activeTab === "section") {
    await loadSectionConsumption();
    return;
  }
  if (state.activeTab === "item") {
    await loadItemConsumption();
    return;
  }
  if (state.activeTab === "movement") {
    await loadStockMovement();
  }
}

function resetPages() {
  Object.keys(state.pages).forEach((key) => {
    state.pages[key].page = 1;
  });
}

function syncTabUi() {
  document.querySelectorAll(".inv-tab-btn[data-tab]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-tab") === state.activeTab);
  });
  document.querySelectorAll(".inv-report-panel[data-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.getAttribute("data-panel") === state.activeTab);
  });
  const exportBtn = byId("rpExportBtn");
  if (!exportBtn) return;

  if (state.activeTab === "issues") {
    exportBtn.disabled = false;
    exportBtn.textContent = "Export Issue CSV";
    return;
  }
  if (state.activeTab === "item") {
    exportBtn.disabled = false;
    exportBtn.textContent = "Export Item CSV";
    return;
  }
  exportBtn.disabled = true;
  exportBtn.textContent = "Export CSV";
}

async function applyFilters({ resetPageState = true } = {}) {
  state.filters = readFilters();
  if (resetPageState) resetPages();

  const applyBtn = byId("rpApplyBtn");
  const release = setButtonBusy(applyBtn, true, "Applying...");
  try {
    await loadSummary();
    await loadActiveTabData();
  } finally {
    release();
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(filename, headers, rows) {
  const head = headers.map((h) => csvEscape(h.label)).join(",");
  const body = rows
    .map((row) => headers.map((h) => csvEscape(row[h.key])).join(","))
    .join("\n");
  const csv = `${head}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fetchAllRows(path, baseParams) {
  const limit = 100;
  let page = 1;
  let total = 0;
  const all = [];

  while (true) {
    const params = new URLSearchParams(baseParams.toString());
    params.set("page", String(page));
    params.set("limit", String(limit));
    const out = await fetchJson(`${path}?${params.toString()}`);
    const rows = ensureArray(out.data);
    total = Number(out.total || rows.length || 0);
    all.push(...rows);
    if (!rows.length || all.length >= total) break;
    page += 1;
    if (page > 200) break;
  }

  return all;
}

async function exportCurrentTab() {
  const exportBtn = byId("rpExportBtn");
  if (state.activeTab !== "issues" && state.activeTab !== "item") {
    showToast("CSV export is available for Monthly Issues and Item-wise report", "warn");
    return;
  }

  const release = setButtonBusy(exportBtn, true, "Exporting...");
  try {
    if (state.activeTab === "issues") {
      const params = buildIssueParams(state.filters, { page: 1, limit: 100 });
      params.delete("page");
      params.delete("limit");
      const rows = await fetchAllRows("/inventory/reports/monthly-issues", params);
      if (!rows.length) throw new Error("No monthly issue data to export");

      downloadCsv(
        `inventory_monthly_issues_${state.filters.year}_${String(state.filters.month).padStart(2, "0")}.csv`,
        [
          { key: "requisition_no", label: "Requisition No" },
          { key: "section_name", label: "Section" },
          { key: "item_code", label: "Item Code" },
          { key: "item_name", label: "Item Name" },
          { key: "unit", label: "Unit" },
          { key: "requested_qty", label: "Requested Qty" },
          { key: "approved_qty", label: "Approved Qty" },
          { key: "issued_qty", label: "Issued Qty" },
          { key: "issue_date", label: "Issue Date" },
          { key: "issued_by", label: "Issued By" },
        ],
        rows
      );
      showToast("Monthly issue CSV exported");
      return;
    }

    const params = buildItemParams(state.filters, { page: 1, limit: 100 });
    params.delete("page");
    params.delete("limit");
    const rows = await fetchAllRows("/inventory/reports/item-consumption", params);
    if (!rows.length) throw new Error("No item-wise data to export");

    downloadCsv(
      `inventory_item_consumption_${state.filters.year}_${String(state.filters.month).padStart(2, "0")}.csv`,
      [
        { key: "item_code", label: "Item Code" },
        { key: "item_name", label: "Item Name" },
        { key: "unit", label: "Unit" },
        { key: "total_requested_qty", label: "Total Requested Qty" },
        { key: "total_approved_qty", label: "Total Approved Qty" },
        { key: "total_issued_qty", label: "Total Issued Qty" },
        { key: "current_stock", label: "Current Stock" },
        { key: "minimum_stock", label: "Minimum Stock" },
        { key: "stock_status", label: "Stock Status" },
      ],
      rows
    );
    showToast("Item-wise CSV exported");
  } catch (err) {
    showToast(err.message || "Failed to export CSV", "error");
  } finally {
    release();
    syncTabUi();
  }
}

async function gotoPage(tabKey, nextPage) {
  const pageState = state.pages[tabKey];
  if (!pageState) return;
  const { totalPages } = getPagination(pageState.total, pageState.page, pageState.limit);
  if (nextPage < 1 || nextPage > totalPages) return;
  pageState.page = nextPage;
  try {
    await loadActiveTabData();
  } catch (err) {
    showToast(err.message || "Failed to change page", "error");
  }
}

function bindEvents() {
  byId("rpApplyBtn")?.addEventListener("click", () => {
    applyFilters({ resetPageState: true }).catch((err) =>
      showToast(err.message || "Failed to apply filters", "error")
    );
  });

  byId("rpResetBtn")?.addEventListener("click", () => {
    const now = getCurrentMonthYear();
    byId("rpMonth").value = String(now.month);
    byId("rpYear").value = String(now.year);
    byId("rpSection").value = "all";
    byId("rpStatus").value = "all";
    byId("rpSearch").value = "";
    applyFilters({ resetPageState: true }).catch((err) =>
      showToast(err.message || "Failed to reset report filters", "error")
    );
  });

  byId("rpSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      applyFilters({ resetPageState: true }).catch((err) =>
        showToast(err.message || "Failed to apply search", "error")
      );
    }
  });

  byId("rpTabs")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    const tab = String(btn.getAttribute("data-tab") || "").trim();
    if (!TAB_KEYS.includes(tab) || tab === state.activeTab) return;

    state.activeTab = tab;
    syncTabUi();
    loadActiveTabData().catch((err) => showToast(err.message || "Failed to load tab report", "error"));
  });

  byId("rpExportBtn")?.addEventListener("click", () => {
    exportCurrentTab();
  });

  byId("rpPrintBtn")?.addEventListener("click", () => {
    window.print();
  });

  byId("rpReqPrevBtn")?.addEventListener("click", () => gotoPage("requisition", state.pages.requisition.page - 1));
  byId("rpReqNextBtn")?.addEventListener("click", () => gotoPage("requisition", state.pages.requisition.page + 1));

  byId("rpIssuePrevBtn")?.addEventListener("click", () => gotoPage("issues", state.pages.issues.page - 1));
  byId("rpIssueNextBtn")?.addEventListener("click", () => gotoPage("issues", state.pages.issues.page + 1));

  byId("rpSectionPrevBtn")?.addEventListener("click", () => gotoPage("section", state.pages.section.page - 1));
  byId("rpSectionNextBtn")?.addEventListener("click", () => gotoPage("section", state.pages.section.page + 1));

  byId("rpItemPrevBtn")?.addEventListener("click", () => gotoPage("item", state.pages.item.page - 1));
  byId("rpItemNextBtn")?.addEventListener("click", () => gotoPage("item", state.pages.item.page + 1));

  byId("rpMovementPrevBtn")?.addEventListener("click", () => gotoPage("movement", state.pages.movement.page - 1));
  byId("rpMovementNextBtn")?.addEventListener("click", () => gotoPage("movement", state.pages.movement.page + 1));
}

async function init() {
  populateMonthYearOptions();
  bindEvents();
  syncTabUi();
  await loadSectionOptions();
  await applyFilters({ resetPageState: true });
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message || "Failed to initialize inventory reports", "error"));
});
