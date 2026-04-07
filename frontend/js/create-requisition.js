import {
  byId,
  ensureArray,
  fetchJson,
  getCurrentMonthYear,
  getRole,
  getUserSectionId,
  setButtonBusy,
  showToast,
  toPositiveInt,
  toQty,
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

const state = {
  role: getRole(),
  userSectionId: getUserSectionId(),
  sections: [],
  items: [],
  editingId: null,
  requisitionNo: null,
};

function attrEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function updateMetaChips() {
  const mode = byId("reqModeChip");
  const noChip = byId("reqNoChip");
  if (mode) mode.textContent = state.editingId ? "Editing Draft" : "New Draft";
  if (noChip) noChip.textContent = `REQ: ${state.requisitionNo || "-"}`;
}

function disableForm(reason) {
  const form = byId("reqForm");
  if (!form) return;
  form.querySelectorAll("input, select, textarea, button").forEach((el) => {
    el.disabled = true;
  });
  showToast(reason, "error");
}

function setMonthYearDefaults() {
  const monthSelect = byId("reqMonth");
  if (monthSelect && !monthSelect.options.length) {
    monthSelect.innerHTML = MONTH_NAMES.map(
      (name, idx) => `<option value="${idx + 1}">${name}</option>`
    ).join("");
  }

  const current = getCurrentMonthYear();
  if (monthSelect && !monthSelect.value) monthSelect.value = String(current.month);
  if (byId("reqYear") && !byId("reqYear").value) byId("reqYear").value = String(current.year);
}

function fillSectionOptions() {
  const sectionSelect = byId("reqSection");
  if (!sectionSelect) return;
  const options = state.sections
    .map((s) => `<option value="${Number(s.id)}">${String(s.name || `Section #${s.id}`)}</option>`)
    .join("");
  sectionSelect.innerHTML = options || '<option value="">No section found</option>';
}

function itemOptionsHtml(selectedId = null) {
  const rows = ensureArray(state.items);
  const opts = ['<option value="">Select item</option>'];
  rows.forEach((item) => {
    const id = Number(item.id);
    const selected = selectedId && Number(selectedId) === id ? "selected" : "";
    const label = `${item.item_code || "-"} - ${item.item_name || "-"}`;
    opts.push(`<option value="${id}" ${selected}>${label}</option>`);
  });
  return opts.join("");
}

function refreshLineNumbers() {
  const rows = byId("reqLineRows")?.querySelectorAll("tr") || [];
  rows.forEach((row, idx) => {
    const sl = row.querySelector(".line-sl");
    if (sl) sl.textContent = String(idx + 1);
  });
}

function addLine(line = null) {
  const tbody = byId("reqLineRows");
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="line-sl"></td>
    <td>
      <select class="inv-select line-item">
        ${itemOptionsHtml(line?.item_id || null)}
      </select>
    </td>
    <td>
      <input class="inv-input line-qty" type="number" min="0.01" step="0.01" value="${Number(
        line?.requested_qty || 1
      )}" />
    </td>
    <td>
      <input class="inv-input line-remarks" value="${attrEscape(line?.remarks || "")}" />
    </td>
    <td>
      <button class="inv-mini-btn danger line-remove-btn" type="button">Remove</button>
    </td>
  `;

  tbody.appendChild(tr);
  refreshLineNumbers();
}

function resetLines() {
  const tbody = byId("reqLineRows");
  if (!tbody) return;
  tbody.innerHTML = "";
  addLine();
}

function collectPayload() {
  const sectionId = toPositiveInt(byId("reqSection")?.value);
  const month = Number(byId("reqMonth")?.value);
  const year = Number(byId("reqYear")?.value);
  const remarks = String(byId("reqRemarks")?.value || "").trim() || null;

  if (!sectionId) throw new Error("Section is required");
  if (!Number.isFinite(month) || month < 1 || month > 12) throw new Error("Valid month is required");
  if (!Number.isFinite(year) || year < 2000 || year > 2100) throw new Error("Valid year is required");

  const rows = Array.from(byId("reqLineRows")?.querySelectorAll("tr") || []);
  if (!rows.length) throw new Error("At least one item row is required");

  const seen = new Set();
  const items = rows.map((row) => {
    const itemId = toPositiveInt(row.querySelector(".line-item")?.value);
    const requestedQty = toQty(row.querySelector(".line-qty")?.value);
    const lineRemarks = String(row.querySelector(".line-remarks")?.value || "").trim() || null;

    if (!itemId) throw new Error("Select item for every row");
    if (seen.has(itemId)) throw new Error("Duplicate item rows are not allowed");
    seen.add(itemId);
    if (requestedQty === null || requestedQty <= 0) {
      throw new Error("Requested quantity must be greater than 0");
    }

    return {
      item_id: itemId,
      requested_qty: requestedQty,
      remarks: lineRemarks,
    };
  });

  return {
    section_id: sectionId,
    month,
    year,
    remarks,
    items,
  };
}

function fillFormFromRequisition(requisition) {
  if (!requisition) return;
  state.editingId = Number(requisition.id);
  state.requisitionNo = requisition.requisition_no || null;

  byId("reqSection").value = String(requisition.section_id || "");
  byId("reqMonth").value = String(requisition.month || "");
  byId("reqYear").value = String(requisition.year || "");
  byId("reqRemarks").value = requisition.remarks || "";

  const tbody = byId("reqLineRows");
  if (tbody) tbody.innerHTML = "";
  ensureArray(requisition.items).forEach((line) => {
    addLine({
      item_id: line.item_id,
      requested_qty: line.requested_qty,
      remarks: line.remarks,
    });
  });
  if (!ensureArray(requisition.items).length) addLine();

  updateMetaChips();
  history.replaceState(null, "", `create-requisition.html?id=${state.editingId}`);
}

function applyRoleRestriction() {
  const sectionWrap = byId("reqSectionWrap");
  const sectionSelect = byId("reqSection");
  if (!sectionSelect) return;

  if (state.role === "general") {
    if (sectionWrap) sectionWrap.style.display = "";
    if (!state.userSectionId) {
      disableForm("Your account has no assigned section");
      return;
    }
    sectionSelect.value = String(state.userSectionId);
    sectionSelect.disabled = true;
    return;
  }

  sectionSelect.disabled = false;
}

async function loadSections() {
  const sections = await fetchJson("/sections");
  state.sections = ensureArray(sections);
  fillSectionOptions();
  applyRoleRestriction();
}

async function loadItems() {
  const out = await fetchJson("/inventory/items?status=active&page=1&limit=100");
  state.items = ensureArray(out.data);
}

async function loadDraftForEdit(id) {
  const out = await fetchJson(`/inventory/requisitions/${id}`);
  const req = out.data;
  if (!req) throw new Error("Draft not found");
  if (req.status !== "Draft") throw new Error("Submitted requisition cannot be edited");
  if (!req.can_edit_draft) throw new Error("You cannot edit this draft requisition");
  fillFormFromRequisition(req);
}

async function saveDraftFlow({ submitAfter = false } = {}) {
  const saveBtn = byId("reqSaveDraftBtn");
  const submitBtn = byId("reqSubmitBtn");
  const releaseSave = setButtonBusy(saveBtn, true, "Saving...");
  const releaseSubmit = setButtonBusy(submitBtn, true, submitAfter ? "Submitting..." : "Please wait...");
  try {
    const payload = collectPayload();
    let requisitionId = state.editingId;
    let responseData = null;

    if (requisitionId) {
      const out = await fetchJson(`/inventory/requisitions/${requisitionId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      responseData = out.data;
    } else {
      const out = await fetchJson("/inventory/requisitions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      responseData = out.data;
      requisitionId = Number(responseData?.id || 0);
    }

    if (responseData) fillFormFromRequisition(responseData);

    if (submitAfter) {
      if (!requisitionId) throw new Error("Failed to resolve requisition id");
      const submitOut = await fetchJson(`/inventory/requisitions/${requisitionId}/submit`, {
        method: "POST",
      });
      const submittedId = toPositiveInt(submitOut?.data?.id) || requisitionId;
      showToast("Requisition submitted successfully", "success");
      window.location.href = `requisition-application.html?id=${submittedId}&auto_print=1`;
      return;
    }

    showToast("Draft requisition saved");
  } catch (err) {
    showToast(err.message || "Failed to save draft", "error");
  } finally {
    releaseSave();
    releaseSubmit();
  }
}

function bindEvents() {
  byId("reqAddLineBtn")?.addEventListener("click", () => addLine());

  byId("reqLineRows")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".line-remove-btn");
    if (!btn) return;
    const tbody = byId("reqLineRows");
    if (!tbody) return;
    if (tbody.querySelectorAll("tr").length <= 1) {
      showToast("At least one row is required", "warn");
      return;
    }
    btn.closest("tr")?.remove();
    refreshLineNumbers();
  });

  byId("reqResetBtn")?.addEventListener("click", () => {
    const ok = window.confirm("Reset current form values?");
    if (!ok) return;
    state.editingId = null;
    state.requisitionNo = null;
    byId("reqForm")?.reset();
    setMonthYearDefaults();
    fillSectionOptions();
    applyRoleRestriction();
    resetLines();
    updateMetaChips();
    history.replaceState(null, "", "create-requisition.html");
  });

  byId("reqForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveDraftFlow({ submitAfter: false });
  });

  byId("reqSubmitBtn")?.addEventListener("click", () => {
    const ok = window.confirm("Submit requisition now? After submit, editing will be locked.");
    if (!ok) return;
    saveDraftFlow({ submitAfter: true });
  });
}

async function init() {
  setMonthYearDefaults();
  bindEvents();

  await Promise.all([loadSections(), loadItems()]);
  resetLines();
  updateMetaChips();

  const q = new URLSearchParams(window.location.search);
  const editingId = toPositiveInt(q.get("id"));
  if (editingId) {
    await loadDraftForEdit(editingId);
    applyRoleRestriction();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    showToast(err.message || "Failed to initialize create requisition page", "error");
  });
});
