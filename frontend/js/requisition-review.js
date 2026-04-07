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
    q: String(byId("rvSearch")?.value || "").trim(),
    status: String(byId("rvStatus")?.value || "Submitted").trim(),
  };
}

function renderRows() {
  const tbody = byId("rvRows");
  if (!tbody) return;
  if (!state.rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="inv-empty">No requisition in review queue</td></tr>';
    return;
  }

  tbody.innerHTML = state.rows
    .map((row, idx) => {
      const sl = (state.page - 1) * state.limit + idx + 1;
      const canForward = Boolean(row.can_forward);
      return `
        <tr>
          <td>${sl}</td>
          <td>${row.requisition_no || "-"}</td>
          <td>${row.section?.name || "-"}</td>
          <td>${row.requester?.name || row.requester?.username || "-"}</td>
          <td><span class="inv-status ${normalizeStatusClass(row.status)}">${row.status || "-"}</span></td>
          <td>${formatQty(row.totals?.requested_qty)}</td>
          <td>${formatDate(row.createdAt)}</td>
          <td>
            <div class="inv-row-actions">
              <button class="inv-mini-btn primary" type="button" data-action="view" data-id="${Number(
                row.id
              )}">View</button>
              ${
                canForward
                  ? `<button class="inv-mini-btn" type="button" data-action="forward" data-id="${Number(
                      row.id
                    )}">Forward</button>`
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
  if (byId("rvPageInfo")) byId("rvPageInfo").textContent = `Page ${state.page} / ${totalPages}`;
  if (byId("rvPrevBtn")) byId("rvPrevBtn").disabled = state.page <= 1;
  if (byId("rvNextBtn")) byId("rvNextBtn").disabled = state.page >= totalPages;
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
  const grid = byId("rvDetailGrid");
  const rows = byId("rvDetailRows");
  if (!grid || !rows) return;

  const meta = [
    ["Requisition No", data.requisition_no || "-"],
    ["Section", data.section?.name || "-"],
    ["Requested By", data.requester?.name || data.requester?.username || "-"],
    ["Status", data.status || "-"],
    ["Submitted At", formatDateTime(data.submitted_at)],
    ["Forwarded By", data.forwarder?.name || data.forwarder?.username || "-"],
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
    modalToggle("rvDetailModal", true);
  } catch (err) {
    showToast(err.message || "Failed to load requisition details", "error");
  }
}

function openForwardModal(id) {
  byId("rvForwardId").value = String(id);
  byId("rvForwardRemarks").value = "";
  modalToggle("rvForwardModal", true);
}

async function submitForward(e) {
  e.preventDefault();
  const id = Number(byId("rvForwardId")?.value || 0);
  if (!id) return;

  const submitBtn = byId("rvForwardSubmit");
  const release = setButtonBusy(submitBtn, true, "Forwarding...");
  try {
    await fetchJson(`/inventory/requisitions/${id}/forward`, {
      method: "POST",
      body: JSON.stringify({
        remarks: String(byId("rvForwardRemarks")?.value || "").trim() || null,
      }),
    });
    showToast("Requisition forwarded");
    modalToggle("rvForwardModal", false);
    await loadRows(state.page);
  } catch (err) {
    showToast(err.message || "Failed to forward requisition", "error");
  } finally {
    release();
  }
}

function bindEvents() {
  byId("rvSearchBtn")?.addEventListener("click", () => loadRows(1).catch((err) => showToast(err.message, "error")));
  byId("rvClearBtn")?.addEventListener("click", () => {
    byId("rvSearch").value = "";
    byId("rvStatus").value = "Submitted";
    loadRows(1).catch((err) => showToast(err.message, "error"));
  });
  byId("rvSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadRows(1).catch((err) => showToast(err.message, "error"));
  });
  byId("rvStatus")?.addEventListener("change", () => loadRows(1).catch((err) => showToast(err.message, "error")));

  byId("rvPrevBtn")?.addEventListener("click", () => {
    if (state.page > 1) loadRows(state.page - 1).catch((err) => showToast(err.message, "error"));
  });
  byId("rvNextBtn")?.addEventListener("click", () => {
    const { totalPages } = getPagination(state.total, state.page, state.limit);
    if (state.page < totalPages) loadRows(state.page + 1).catch((err) => showToast(err.message, "error"));
  });

  byId("rvRows")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = Number(btn.getAttribute("data-id"));
    if (!id) return;
    const action = String(btn.getAttribute("data-action") || "");
    if (action === "view") {
      openDetail(id);
      return;
    }
    if (action === "forward") {
      openForwardModal(id);
    }
  });

  byId("rvDetailClose")?.addEventListener("click", () => modalToggle("rvDetailModal", false));
  byId("rvDetailModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "rvDetailModal") modalToggle("rvDetailModal", false);
  });

  byId("rvForwardClose")?.addEventListener("click", () => modalToggle("rvForwardModal", false));
  byId("rvForwardCancel")?.addEventListener("click", () => modalToggle("rvForwardModal", false));
  byId("rvForwardForm")?.addEventListener("submit", submitForward);
  byId("rvForwardModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "rvForwardModal") modalToggle("rvForwardModal", false);
  });
}

async function init() {
  bindEvents();
  await loadRows(1);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message || "Failed to initialize requisition review", "error"));
});

