import {
  byId,
  ensureArray,
  fetchJson,
  formatDate,
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
    q: String(byId("apSearch")?.value || "").trim(),
    status: String(byId("apStatus")?.value || "Forwarded").trim(),
  };
}

function renderRows() {
  const tbody = byId("apRows");
  if (!tbody) return;
  if (!state.rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="inv-empty">No requisition available</td></tr>';
    return;
  }

  tbody.innerHTML = state.rows
    .map((row, idx) => {
      const sl = (state.page - 1) * state.limit + idx + 1;
      const canApprove = Boolean(row.can_approve);
      return `
        <tr>
          <td>${sl}</td>
          <td>${row.requisition_no || "-"}</td>
          <td>${row.section?.name || "-"}</td>
          <td>${row.requester?.name || row.requester?.username || "-"}</td>
          <td><span class="inv-status ${normalizeStatusClass(row.status)}">${row.status || "-"}</span></td>
          <td>${formatQty(row.totals?.requested_qty)}</td>
          <td>${formatDateTime(row.forwarded_at)}</td>
          <td>
            <div class="inv-row-actions">
              <button class="inv-mini-btn primary" type="button" data-action="view" data-id="${Number(
                row.id
              )}">View</button>
              ${
                canApprove
                  ? `<button class="inv-mini-btn" type="button" data-action="approve" data-id="${Number(
                      row.id
                    )}">Approve</button>`
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
  if (byId("apPageInfo")) byId("apPageInfo").textContent = `Page ${state.page} / ${totalPages}`;
  if (byId("apPrevBtn")) byId("apPrevBtn").disabled = state.page <= 1;
  if (byId("apNextBtn")) byId("apNextBtn").disabled = state.page >= totalPages;
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

function renderDetailModal(data) {
  const grid = byId("apDetailGrid");
  const rows = byId("apDetailRows");
  if (!grid || !rows) return;

  const meta = [
    ["Requisition No", data.requisition_no || "-"],
    ["Section", data.section?.name || "-"],
    ["Requested By", data.requester?.name || data.requester?.username || "-"],
    ["Status", data.status || "-"],
    ["Submitted At", formatDateTime(data.submitted_at)],
    ["Forwarded At", formatDateTime(data.forwarded_at)],
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
    renderDetailModal(out.data);
    modalToggle("apDetailModal", true);
  } catch (err) {
    showToast(err.message || "Failed to load requisition details", "error");
  }
}

function renderApproveRows(lines) {
  const tbody = byId("apApproveRows");
  if (!tbody) return;
  const rows = ensureArray(lines);
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="inv-empty">No line item found</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map((line, idx) => {
      const requested = Number(line.requested_qty || 0);
      return `
        <tr data-line-id="${Number(line.id)}" data-item-id="${Number(line.item_id)}">
          <td>${idx + 1}</td>
          <td>${line.item?.item_code || "-"} - ${line.item?.item_name || "-"}</td>
          <td>${formatQty(requested)}</td>
          <td>
            <input class="inv-input ap-line-approved" type="number" min="0" max="${requested}" step="0.01" value="${requested}" />
          </td>
          <td>
            <input class="inv-input ap-line-remarks" value="${String(line.remarks || "").replace(/"/g, "&quot;")}" />
          </td>
        </tr>
      `;
    })
    .join("");
}

async function openApproveModal(id) {
  try {
    const out = await fetchJson(`/inventory/requisitions/${id}`);
    if (out.data?.status !== "Forwarded") {
      showToast("Only forwarded requisition can be approved", "warn");
      return;
    }
    byId("apApproveId").value = String(id);
    byId("apHeaderRemarks").value = out.data?.remarks || "";
    renderApproveRows(out.data?.items || []);
    modalToggle("apApproveModal", true);
  } catch (err) {
    showToast(err.message || "Failed to load approval form", "error");
  }
}

function readApprovalPayload() {
  const lines = Array.from(byId("apApproveRows")?.querySelectorAll("tr") || []);
  const payloadLines = lines.map((row) => {
    const requested = Number(row.querySelector(".ap-line-approved")?.max || 0);
    const approved = toQty(row.querySelector(".ap-line-approved")?.value);
    if (approved === null) throw new Error("Approved quantity must be valid");
    if (approved > requested) throw new Error("Approved quantity cannot exceed requested quantity");
    return {
      id: Number(row.getAttribute("data-line-id")),
      item_id: Number(row.getAttribute("data-item-id")),
      approved_qty: approved,
      remarks: String(row.querySelector(".ap-line-remarks")?.value || "").trim() || null,
    };
  });

  return {
    lines: payloadLines,
    remarks: String(byId("apHeaderRemarks")?.value || "").trim() || null,
  };
}

async function submitApproval(e) {
  e.preventDefault();
  const id = Number(byId("apApproveId")?.value || 0);
  if (!id) return;

  const btn = byId("apApproveSubmit");
  const release = setButtonBusy(btn, true, "Approving...");
  try {
    const payload = readApprovalPayload();
    const out = await fetchJson(`/inventory/requisitions/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    showToast(out.message || "Requisition updated");
    modalToggle("apApproveModal", false);
    await loadRows(state.page);
  } catch (err) {
    showToast(err.message || "Failed to approve requisition", "error");
  } finally {
    release();
  }
}

async function rejectRequisition() {
  const id = Number(byId("apApproveId")?.value || 0);
  if (!id) return;
  const ok = window.confirm("Reject this requisition?");
  if (!ok) return;

  const btn = byId("apRejectBtn");
  const release = setButtonBusy(btn, true, "Rejecting...");
  try {
    const out = await fetchJson(`/inventory/requisitions/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({
        remarks: String(byId("apHeaderRemarks")?.value || "").trim() || null,
      }),
    });
    showToast(out.message || "Requisition rejected");
    modalToggle("apApproveModal", false);
    await loadRows(state.page);
  } catch (err) {
    showToast(err.message || "Failed to reject requisition", "error");
  } finally {
    release();
  }
}

function bindEvents() {
  byId("apSearchBtn")?.addEventListener("click", () => loadRows(1).catch((err) => showToast(err.message, "error")));
  byId("apClearBtn")?.addEventListener("click", () => {
    byId("apSearch").value = "";
    byId("apStatus").value = "Forwarded";
    loadRows(1).catch((err) => showToast(err.message, "error"));
  });
  byId("apStatus")?.addEventListener("change", () => loadRows(1).catch((err) => showToast(err.message, "error")));
  byId("apSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadRows(1).catch((err) => showToast(err.message, "error"));
  });

  byId("apPrevBtn")?.addEventListener("click", () => {
    if (state.page > 1) loadRows(state.page - 1).catch((err) => showToast(err.message, "error"));
  });
  byId("apNextBtn")?.addEventListener("click", () => {
    const { totalPages } = getPagination(state.total, state.page, state.limit);
    if (state.page < totalPages) loadRows(state.page + 1).catch((err) => showToast(err.message, "error"));
  });

  byId("apRows")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = Number(btn.getAttribute("data-id"));
    const action = String(btn.getAttribute("data-action") || "");
    if (!id) return;
    if (action === "view") {
      openDetail(id);
      return;
    }
    if (action === "approve") {
      openApproveModal(id);
    }
  });

  byId("apDetailClose")?.addEventListener("click", () => modalToggle("apDetailModal", false));
  byId("apDetailModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "apDetailModal") modalToggle("apDetailModal", false);
  });

  byId("apApproveClose")?.addEventListener("click", () => modalToggle("apApproveModal", false));
  byId("apApproveCancel")?.addEventListener("click", () => modalToggle("apApproveModal", false));
  byId("apApproveModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "apApproveModal") modalToggle("apApproveModal", false);
  });
  byId("apApproveForm")?.addEventListener("submit", submitApproval);
  byId("apRejectBtn")?.addEventListener("click", rejectRequisition);
}

async function init() {
  bindEvents();
  await loadRows(1);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message || "Failed to initialize approval page", "error"));
});
