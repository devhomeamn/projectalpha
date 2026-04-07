import {
  byId,
  ensureArray,
  fetchJson,
  formatQty,
  getPagination,
  normalizeStatusClass,
  setButtonBusy,
  showToast,
  toQty,
} from "./inventory-common.js";

const state = {
  page: 1,
  limit: 20,
  total: 0,
  rows: [],
  editingId: null,
};

function modalOpen(open) {
  const modal = byId("itemModal");
  if (!modal) return;
  modal.classList.toggle("is-open", Boolean(open));
  modal.setAttribute("aria-hidden", open ? "false" : "true");
}

function readFilters() {
  return {
    q: String(byId("itemSearch")?.value || "").trim(),
    status: String(byId("itemStatusFilter")?.value || "all").trim().toLowerCase(),
  };
}

function resetForm() {
  byId("itemForm")?.reset();
  state.editingId = null;
  const title = byId("itemModalTitle");
  if (title) title.textContent = "Add Item";
  if (byId("itemStatus")) byId("itemStatus").value = "active";
  if (byId("itemCurrentStock")) byId("itemCurrentStock").value = "0";
  if (byId("itemMinimumStock")) byId("itemMinimumStock").value = "0";
}

function fillForm(item) {
  if (!item) return;
  state.editingId = Number(item.id);
  const title = byId("itemModalTitle");
  if (title) title.textContent = "Edit Item";

  byId("itemCode").value = item.item_code || "";
  byId("itemName").value = item.item_name || "";
  byId("itemCategory").value = item.category || "";
  byId("itemUnit").value = item.unit || "";
  byId("itemCurrentStock").value = Number(item.current_stock || 0);
  byId("itemMinimumStock").value = Number(item.minimum_stock || 0);
  byId("itemStatus").value = String(item.status || "active").toLowerCase() === "inactive" ? "inactive" : "active";
  byId("itemDescription").value = item.description || "";
}

function setKpis(items) {
  const rows = ensureArray(items);
  const total = rows.length;
  const active = rows.filter((x) => String(x.status || "").toLowerCase() === "active").length;
  const inactive = rows.filter((x) => String(x.status || "").toLowerCase() === "inactive").length;
  const low = rows.filter((x) => Number(x.current_stock || 0) <= Number(x.minimum_stock || 0)).length;

  const map = [
    ["kpiTotalItems", total],
    ["kpiActiveItems", active],
    ["kpiInactiveItems", inactive],
    ["kpiLowStock", low],
  ];
  map.forEach(([id, value]) => {
    const el = byId(id);
    if (el) el.textContent = String(value);
  });
}

function renderRows() {
  const tbody = byId("itemRows");
  if (!tbody) return;

  if (!state.rows.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="inv-empty">No inventory item found</td></tr>';
    return;
  }

  tbody.innerHTML = state.rows
    .map((row, idx) => {
      const sl = (state.page - 1) * state.limit + idx + 1;
      const low = Number(row.current_stock || 0) <= Number(row.minimum_stock || 0);
      const status = String(row.status || "active");
      const statusClass = normalizeStatusClass(status);
      const toggleLabel = statusClass === "active" ? "Deactivate" : "Activate";

      return `
        <tr>
          <td>${sl}</td>
          <td>${row.item_code || "-"}</td>
          <td>${row.item_name || "-"}</td>
          <td>${row.category || "-"}</td>
          <td>${row.unit || "-"}</td>
          <td>${formatQty(row.current_stock)}</td>
          <td>${formatQty(row.minimum_stock)}</td>
          <td><span class="${low ? "inv-low" : "inv-ok"}">${low ? "Low" : "OK"}</span></td>
          <td><span class="inv-status ${statusClass}">${status}</span></td>
          <td>
            <div class="inv-row-actions">
              <button class="inv-mini-btn primary" type="button" data-action="edit" data-id="${Number(
                row.id
              )}">Edit</button>
              <button class="inv-mini-btn" type="button" data-action="toggle-status" data-id="${Number(
                row.id
              )}" data-next="${statusClass === "active" ? "inactive" : "active"}">${toggleLabel}</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderPagination() {
  const { totalPages } = getPagination(state.total, state.page, state.limit);
  const pageInfo = byId("itemPageInfo");
  if (pageInfo) pageInfo.textContent = `Page ${state.page} / ${totalPages}`;

  const prevBtn = byId("itemPrevBtn");
  const nextBtn = byId("itemNextBtn");
  if (prevBtn) prevBtn.disabled = state.page <= 1;
  if (nextBtn) nextBtn.disabled = state.page >= totalPages;
}

async function loadItems(page = 1) {
  const filters = readFilters();
  const params = new URLSearchParams({
    page: String(page),
    limit: String(state.limit),
  });
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);

  const out = await fetchJson(`/inventory/items?${params.toString()}`);
  state.rows = ensureArray(out.data);
  state.page = Number(out.page || page || 1);
  state.limit = Number(out.limit || state.limit);
  state.total = Number(out.total || state.rows.length || 0);

  setKpis(state.rows);
  renderRows();
  renderPagination();
}

function readFormPayload() {
  const itemCode = String(byId("itemCode")?.value || "").trim();
  const itemName = String(byId("itemName")?.value || "").trim();
  const currentStock = toQty(byId("itemCurrentStock")?.value);
  const minimumStock = toQty(byId("itemMinimumStock")?.value);

  if (!itemCode) throw new Error("Item code is required");
  if (!itemName) throw new Error("Item name is required");
  if (currentStock === null) throw new Error("Current stock must be a valid number");
  if (minimumStock === null) throw new Error("Minimum stock must be a valid number");

  return {
    item_code: itemCode,
    item_name: itemName,
    category: String(byId("itemCategory")?.value || "").trim() || null,
    unit: String(byId("itemUnit")?.value || "").trim() || null,
    current_stock: currentStock,
    minimum_stock: minimumStock,
    description: String(byId("itemDescription")?.value || "").trim() || null,
    status: String(byId("itemStatus")?.value || "active").toLowerCase() === "inactive" ? "inactive" : "active",
  };
}

async function submitForm(e) {
  e.preventDefault();
  const saveBtn = byId("itemSaveBtn");
  const release = setButtonBusy(saveBtn, true, state.editingId ? "Updating..." : "Saving...");
  try {
    const payload = readFormPayload();
    if (state.editingId) {
      await fetchJson(`/inventory/items/${state.editingId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      showToast("Item updated successfully");
    } else {
      await fetchJson("/inventory/items", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      showToast("Item created successfully");
    }
    modalOpen(false);
    await loadItems(state.page);
  } catch (err) {
    showToast(err.message || "Failed to save item", "error");
  } finally {
    release();
  }
}

async function editItem(id) {
  try {
    const out = await fetchJson(`/inventory/items/${id}`);
    fillForm(out.data);
    modalOpen(true);
  } catch (err) {
    showToast(err.message || "Failed to load item", "error");
  }
}

async function toggleItemStatus(id, nextStatus) {
  const ok = window.confirm(`Change item status to "${nextStatus}"?`);
  if (!ok) return;
  try {
    await fetchJson(`/inventory/items/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    showToast("Item status updated");
    await loadItems(state.page);
  } catch (err) {
    showToast(err.message || "Failed to update status", "error");
  }
}

function bindEvents() {
  byId("itemSearchBtn")?.addEventListener("click", () => loadItems(1).catch((err) => showToast(err.message, "error")));
  byId("itemClearBtn")?.addEventListener("click", () => {
    byId("itemSearch").value = "";
    byId("itemStatusFilter").value = "all";
    loadItems(1).catch((err) => showToast(err.message, "error"));
  });
  byId("itemSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadItems(1).catch((err) => showToast(err.message, "error"));
  });

  byId("itemPrevBtn")?.addEventListener("click", () => {
    if (state.page > 1) loadItems(state.page - 1).catch((err) => showToast(err.message, "error"));
  });
  byId("itemNextBtn")?.addEventListener("click", () => {
    const { totalPages } = getPagination(state.total, state.page, state.limit);
    if (state.page < totalPages) loadItems(state.page + 1).catch((err) => showToast(err.message, "error"));
  });

  byId("itemNewBtn")?.addEventListener("click", () => {
    resetForm();
    modalOpen(true);
  });
  byId("itemCancelBtn")?.addEventListener("click", () => modalOpen(false));
  byId("itemModalClose")?.addEventListener("click", () => modalOpen(false));
  byId("itemForm")?.addEventListener("submit", submitForm);

  byId("itemRows")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = Number(btn.getAttribute("data-id"));
    const action = btn.getAttribute("data-action");
    if (!id || !action) return;

    if (action === "edit") {
      editItem(id);
      return;
    }
    if (action === "toggle-status") {
      const next = String(btn.getAttribute("data-next") || "active");
      toggleItemStatus(id, next);
    }
  });
}

async function init() {
  bindEvents();
  resetForm();
  await loadItems(1);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    showToast(err.message || "Failed to initialize inventory items", "error");
  });
});
