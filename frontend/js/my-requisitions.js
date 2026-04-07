import {
  byId,
  ensureArray,
  fetchJson,
  formatDate,
  formatDateTime,
  formatQty,
  getPagination,
  normalizeStatusClass,
  showToast,
} from "./inventory-common.js";

const state = {
  rows: [],
  page: 1,
  limit: 20,
  total: 0,
};

function openApplicationPage(id, { autoPrint = false } = {}) {
  const reqId = Number(id);
  if (!Number.isFinite(reqId) || reqId <= 0) return;
  const params = new URLSearchParams({ id: String(Math.trunc(reqId)) });
  if (autoPrint) params.set("auto_print", "1");
  window.location.href = `requisition-application.html?${params.toString()}`;
}

function detailModalOpen(open) {
  const modal = byId("myReqModal");
  if (!modal) return;
  modal.classList.toggle("is-open", Boolean(open));
  modal.setAttribute("aria-hidden", open ? "false" : "true");
}

function readFilters() {
  const month = Number(byId("myReqMonth")?.value || 0);
  const year = Number(byId("myReqYear")?.value || 0);
  return {
    q: String(byId("myReqSearch")?.value || "").trim(),
    status: String(byId("myReqStatus")?.value || "all").trim(),
    month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : null,
    year: Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : null,
  };
}

function renderRows() {
  const tbody = byId("myReqRows");
  if (!tbody) return;

  if (!state.rows.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="inv-empty">No requisition found</td></tr>';
    return;
  }

  tbody.innerHTML = state.rows
    .map((row, idx) => {
      const sl = (state.page - 1) * state.limit + idx + 1;
      const statusCls = normalizeStatusClass(row.status);
      const canSubmit = Boolean(row.can_submit);
      const canEdit = row.status === "Draft";
      const canPrint = row.status !== "Draft";

      return `
        <tr>
          <td>${sl}</td>
          <td>${row.requisition_no || "-"}</td>
          <td>${row.section?.name || "-"}</td>
          <td>${row.month || "-"} / ${row.year || "-"}</td>
          <td><span class="inv-status ${statusCls}">${row.status || "-"}</span></td>
          <td>${formatQty(row.totals?.requested_qty)}</td>
          <td>${formatQty(row.totals?.approved_qty)}</td>
          <td>${formatQty(row.totals?.issued_qty)}</td>
          <td>${formatDate(row.createdAt)}</td>
          <td>
            <div class="inv-row-actions">
              <button class="inv-mini-btn primary" type="button" data-action="view" data-id="${Number(
                row.id
              )}">View</button>
              ${
                canEdit
                  ? `<button class="inv-mini-btn" type="button" data-action="edit" data-id="${Number(
                      row.id
                    )}">Edit Draft</button>`
                  : ""
              }
              ${
                canSubmit
                  ? `<button class="inv-mini-btn" type="button" data-action="submit" data-id="${Number(
                      row.id
                    )}">Submit</button>`
                  : ""
              }
              ${
                canPrint
                  ? `<button class="inv-mini-btn" type="button" data-action="print" data-id="${Number(
                      row.id
                    )}">Application</button>`
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
  if (byId("myReqPageInfo")) byId("myReqPageInfo").textContent = `Page ${state.page} / ${totalPages}`;
  if (byId("myReqPrevBtn")) byId("myReqPrevBtn").disabled = state.page <= 1;
  if (byId("myReqNextBtn")) byId("myReqNextBtn").disabled = state.page >= totalPages;
}

async function loadRows(page = 1) {
  const filters = readFilters();
  const params = new URLSearchParams({
    page: String(page),
    limit: String(state.limit),
  });
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.month) params.set("month", String(filters.month));
  if (filters.year) params.set("year", String(filters.year));

  const out = await fetchJson(`/inventory/requisitions?${params.toString()}`);
  state.rows = ensureArray(out.data);
  state.page = Number(out.page || page || 1);
  state.limit = Number(out.limit || state.limit);
  state.total = Number(out.total || state.rows.length || 0);
  renderRows();
  renderPagination();
}

function renderDetailsModal(data) {
  const detailGrid = byId("myReqDetailGrid");
  const detailRows = byId("myReqDetailRows");
  if (!detailGrid || !detailRows) return;

  const headerItems = [
    ["Requisition No", data.requisition_no || "-"],
    ["Section", data.section?.name || "-"],
    ["Status", data.status || "-"],
    ["Month/Year", `${data.month || "-"} / ${data.year || "-"}`],
    ["Requested By", data.requester?.name || data.requester?.username || "-"],
    ["Submitted At", formatDateTime(data.submitted_at)],
    ["Forwarded By", data.forwarder?.name || data.forwarder?.username || "-"],
    ["Approved By", data.approver?.name || data.approver?.username || "-"],
    ["Issued By", data.issuer?.name || data.issuer?.username || "-"],
  ];

  detailGrid.innerHTML = headerItems
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
    detailRows.innerHTML = '<tr><td colspan="7" class="inv-empty">No line item found</td></tr>';
    return;
  }

  detailRows.innerHTML = lines
    .map((line, idx) => {
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${line.item?.item_code || "-"} - ${line.item?.item_name || "-"}</td>
          <td>${formatQty(line.requested_qty)}</td>
          <td>${formatQty(line.approved_qty)}</td>
          <td>${formatQty(line.issued_qty)}</td>
          <td><span class="inv-status ${normalizeStatusClass(line.line_status)}">${line.line_status || "-"}</span></td>
          <td>${line.remarks || "-"}</td>
        </tr>
      `;
    })
    .join("");
}

async function openDetails(id) {
  try {
    const out = await fetchJson(`/inventory/requisitions/${id}`);
    renderDetailsModal(out.data);
    detailModalOpen(true);
  } catch (err) {
    showToast(err.message || "Failed to load requisition details", "error");
  }
}

async function submitDraft(id) {
  const ok = window.confirm("Submit this draft requisition?");
  if (!ok) return;
  try {
    const out = await fetchJson(`/inventory/requisitions/${id}/submit`, { method: "POST" });
    const submittedId = Number(out?.data?.id || id);
    showToast("Requisition submitted");
    openApplicationPage(submittedId, { autoPrint: true });
  } catch (err) {
    showToast(err.message || "Failed to submit requisition", "error");
  }
}

function bindEvents() {
  byId("myReqSearchBtn")?.addEventListener("click", () => loadRows(1).catch((err) => showToast(err.message, "error")));
  byId("myReqClearBtn")?.addEventListener("click", () => {
    byId("myReqSearch").value = "";
    byId("myReqStatus").value = "all";
    byId("myReqMonth").value = "";
    byId("myReqYear").value = "";
    loadRows(1).catch((err) => showToast(err.message, "error"));
  });
  byId("myReqSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadRows(1).catch((err) => showToast(err.message, "error"));
  });

  byId("myReqPrevBtn")?.addEventListener("click", () => {
    if (state.page > 1) loadRows(state.page - 1).catch((err) => showToast(err.message, "error"));
  });
  byId("myReqNextBtn")?.addEventListener("click", () => {
    const { totalPages } = getPagination(state.total, state.page, state.limit);
    if (state.page < totalPages) loadRows(state.page + 1).catch((err) => showToast(err.message, "error"));
  });

  byId("myReqRows")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = Number(btn.getAttribute("data-id"));
    const action = String(btn.getAttribute("data-action") || "");
    if (!id) return;

    if (action === "view") {
      openDetails(id);
      return;
    }
    if (action === "edit") {
      window.location.href = `create-requisition.html?id=${id}`;
      return;
    }
    if (action === "submit") {
      submitDraft(id);
      return;
    }
    if (action === "print") {
      openApplicationPage(id, { autoPrint: true });
    }
  });

  byId("myReqModalClose")?.addEventListener("click", () => detailModalOpen(false));
  byId("myReqModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "myReqModal") detailModalOpen(false);
  });
}

async function init() {
  bindEvents();
  await loadRows(1);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message || "Failed to initialize requisitions", "error"));
});
