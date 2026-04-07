import {
  byId,
  ensureArray,
  fetchJson,
  formatDateTime,
  formatQty,
  getPagination,
  normalizeStatusClass,
  setButtonBusy,
  showToast,
  toQty,
} from "./inventory-common.js";

const state = {
  rows: [],
  page: 1,
  limit: 20,
  total: 0,
};

function modalToggle(id, open) {
  const modal = byId(id);
  if (!modal) return;
  modal.classList.toggle("is-open", Boolean(open));
  modal.setAttribute("aria-hidden", open ? "false" : "true");
}

function readFilters() {
  return {
    q: String(byId("isSearch")?.value || "").trim(),
    status: String(byId("isStatus")?.value || "Approved").trim(),
  };
}

function renderRows() {
  const tbody = byId("isRows");
  if (!tbody) return;
  if (!state.rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="inv-empty">No requisition available for issue</td></tr>';
    return;
  }

  tbody.innerHTML = state.rows
    .map((row, idx) => {
      const sl = (state.page - 1) * state.limit + idx + 1;
      const canIssue = Boolean(row.can_issue);

      return `
        <tr>
          <td>${sl}</td>
          <td>${row.requisition_no || "-"}</td>
          <td>${row.section?.name || "-"}</td>
          <td><span class="inv-status ${normalizeStatusClass(row.status)}">${row.status || "-"}</span></td>
          <td>${formatQty(row.totals?.approved_qty)}</td>
          <td>${formatQty(row.totals?.issued_qty)}</td>
          <td>${formatDateTime(row.approved_at)}</td>
          <td>
            <div class="inv-row-actions">
              <button class="inv-mini-btn primary" type="button" data-action="view" data-id="${Number(
                row.id
              )}">View</button>
              ${
                canIssue
                  ? `<button class="inv-mini-btn" type="button" data-action="issue" data-id="${Number(
                      row.id
                    )}">Issue</button>`
                  : ""
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderPagination() {
  const { totalPages } = getPagination(state.total, state.page, state.limit);
  if (byId("isPageInfo")) byId("isPageInfo").textContent = `Page ${state.page} / ${totalPages}`;
  if (byId("isPrevBtn")) byId("isPrevBtn").disabled = state.page <= 1;
  if (byId("isNextBtn")) byId("isNextBtn").disabled = state.page >= totalPages;
}

async function loadRows(page = 1) {
  const filters = readFilters();
  const params = new URLSearchParams({
    page: String(page),
    limit: String(state.limit),
  });
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);

  const out = await fetchJson(`/inventory/requisitions?${params.toString()}`);
  state.rows = ensureArray(out.data);
  state.page = Number(out.page || page || 1);
  state.limit = Number(out.limit || state.limit);
  state.total = Number(out.total || state.rows.length || 0);
  renderRows();
  renderPagination();
}

function renderDetail(data) {
  const grid = byId("isDetailGrid");
  const rows = byId("isDetailRows");
  if (!grid || !rows) return;

  const meta = [
    ["Requisition No", data.requisition_no || "-"],
    ["Section", data.section?.name || "-"],
    ["Status", data.status || "-"],
    ["Requested By", data.requester?.name || data.requester?.username || "-"],
    ["Approved By", data.approver?.name || data.approver?.username || "-"],
    ["Issued By", data.issuer?.name || data.issuer?.username || "-"],
  ];

  grid.innerHTML = meta
    .map(
      ([label, value]) => `
      <article class="inv-detail-item">
        <div class="label">${label}</div>
        <div class="value">${value || "-"}</div>
      </article>
    `
    )
    .join("");

  const lines = ensureArray(data.items);
  if (!lines.length) {
    rows.innerHTML = '<tr><td colspan="7" class="inv-empty">No line item found</td></tr>';
    return;
  }
  rows.innerHTML = lines
    .map(
      (line, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${line.item?.item_code || "-"} - ${line.item?.item_name || "-"}</td>
        <td>${formatQty(line.requested_qty)}</td>
        <td>${formatQty(line.approved_qty)}</td>
        <td>${formatQty(line.issued_qty)}</td>
        <td><span class="inv-status ${normalizeStatusClass(line.line_status)}">${line.line_status || "-"}</span></td>
        <td>${line.remarks || "-"}</td>
      </tr>
    `
    )
    .join("");
}

async function openDetail(id) {
  try {
    const out = await fetchJson(`/inventory/requisitions/${id}`);
    renderDetail(out.data);
    modalToggle("isDetailModal", true);
  } catch (err) {
    showToast(err.message || "Failed to load requisition detail", "error");
  }
}

function renderIssueRows(lines) {
  const tbody = byId("isIssueRows");
  if (!tbody) return;
  const list = ensureArray(lines);
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="inv-empty">No line item found</td></tr>';
    return;
  }

  tbody.innerHTML = list
    .map((line, idx) => {
      const approved = Number(line.approved_qty || 0);
      const issued = Number(line.issued_qty || 0);
      const remaining = Math.max(0, Number((approved - issued).toFixed(2)));
      const issueable =
        ["Approved", "Partially Approved", "Issued"].includes(String(line.line_status || "")) &&
        remaining > 0;
      const stock = Number(line.item?.current_stock || 0);
      const defaultIssue = issueable ? Math.max(0, Math.min(remaining, stock)) : 0;

      return `
        <tr data-line-id="${Number(line.id)}" data-item-id="${Number(line.item_id)}" data-remaining="${remaining}">
          <td>${idx + 1}</td>
          <td>${line.item?.item_code || "-"} - ${line.item?.item_name || "-"}</td>
          <td>${formatQty(approved)}</td>
          <td>${formatQty(issued)}</td>
          <td>${formatQty(remaining)}</td>
          <td>${formatQty(stock)}</td>
          <td>
            <input
              class="inv-input is-line-issue"
              type="number"
              min="0"
              max="${remaining}"
              step="0.01"
              value="${defaultIssue}"
              ${issueable ? "" : "disabled"}
            />
          </td>
        </tr>
      `;
    })
    .join("");
}

async function openIssueModal(id) {
  try {
    const out = await fetchJson(`/inventory/requisitions/${id}`);
    if (!["Approved", "Partially Approved", "Issued"].includes(String(out.data?.status || ""))) {
      showToast("Only approved or partially approved requisition can be issued", "warn");
      return;
    }
    byId("isIssueId").value = String(id);
    byId("isIssueRemarks").value = out.data?.remarks || "";
    renderIssueRows(out.data?.items || []);
    modalToggle("isIssueModal", true);
  } catch (err) {
    showToast(err.message || "Failed to open issue form", "error");
  }
}

function collectIssuePayload() {
  const rows = Array.from(byId("isIssueRows")?.querySelectorAll("tr") || []);
  const lines = [];
  rows.forEach((row) => {
    const input = row.querySelector(".is-line-issue");
    if (!input || input.disabled) return;
    const qty = toQty(input.value);
    const remaining = Number(row.getAttribute("data-remaining") || 0);
    if (qty === null || qty <= 0) return;
    if (qty > remaining) {
      throw new Error("Issued quantity cannot exceed remaining approved quantity");
    }
    lines.push({
      id: Number(row.getAttribute("data-line-id")),
      item_id: Number(row.getAttribute("data-item-id")),
      issued_qty: qty,
    });
  });

  if (!lines.length) throw new Error("Enter issue quantity for at least one line");

  return {
    lines,
    remarks: String(byId("isIssueRemarks")?.value || "").trim() || null,
  };
}

async function submitIssue(e) {
  e.preventDefault();
  const id = Number(byId("isIssueId")?.value || 0);
  if (!id) return;

  const submitBtn = byId("isIssueSubmit");
  const release = setButtonBusy(submitBtn, true, "Issuing...");
  try {
    const payload = collectIssuePayload();
    const out = await fetchJson(`/inventory/requisitions/${id}/issue`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    showToast(out.message || "Items issued successfully");
    modalToggle("isIssueModal", false);
    await loadRows(state.page);
  } catch (err) {
    showToast(err.message || "Failed to issue items", "error");
  } finally {
    release();
  }
}

function bindEvents() {
  byId("isSearchBtn")?.addEventListener("click", () => loadRows(1).catch((err) => showToast(err.message, "error")));
  byId("isClearBtn")?.addEventListener("click", () => {
    byId("isSearch").value = "";
    byId("isStatus").value = "Approved";
    loadRows(1).catch((err) => showToast(err.message, "error"));
  });
  byId("isStatus")?.addEventListener("change", () => loadRows(1).catch((err) => showToast(err.message, "error")));
  byId("isSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadRows(1).catch((err) => showToast(err.message, "error"));
  });

  byId("isPrevBtn")?.addEventListener("click", () => {
    if (state.page > 1) loadRows(state.page - 1).catch((err) => showToast(err.message, "error"));
  });
  byId("isNextBtn")?.addEventListener("click", () => {
    const { totalPages } = getPagination(state.total, state.page, state.limit);
    if (state.page < totalPages) loadRows(state.page + 1).catch((err) => showToast(err.message, "error"));
  });

  byId("isRows")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = Number(btn.getAttribute("data-id"));
    const action = String(btn.getAttribute("data-action") || "");
    if (!id) return;
    if (action === "view") {
      openDetail(id);
      return;
    }
    if (action === "issue") {
      openIssueModal(id);
    }
  });

  byId("isDetailClose")?.addEventListener("click", () => modalToggle("isDetailModal", false));
  byId("isDetailModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "isDetailModal") modalToggle("isDetailModal", false);
  });

  byId("isIssueClose")?.addEventListener("click", () => modalToggle("isIssueModal", false));
  byId("isIssueCancel")?.addEventListener("click", () => modalToggle("isIssueModal", false));
  byId("isIssueModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "isIssueModal") modalToggle("isIssueModal", false);
  });
  byId("isIssueForm")?.addEventListener("submit", submitIssue);
}

async function init() {
  bindEvents();
  await loadRows(1);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message || "Failed to initialize issue page", "error"));
});
