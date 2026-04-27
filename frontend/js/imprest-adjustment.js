import {
  byId,
  createMonthOptionsHtml,
  ensureArray,
  escapeHtml,
  formatMoney,
  getPakkhikLabel,
  imprestFetch,
  setButtonBusy,
  showToast,
  toNumber,
  toPositiveInt,
} from "./imprest-common.js";

const ISSUED_STATUSES = new Set(["FUND_ISSUED", "PARTIALLY_ADJUSTED", "ADJUSTED"]);

const state = {
  bases: [],
  fiscalYears: [],
  noteSummaryRows: [],
  selectedNote: null,
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function optionsHtml(rows, labelFn, selected = null, includeAll = false) {
  const opts = [];
  if (includeAll) opts.push('<option value="">All</option>');
  rows.forEach((row) => {
    const id = Number(row.id);
    const selectedAttr = Number(selected) === id ? "selected" : "";
    opts.push(`<option value="${id}" ${selectedAttr}>${escapeHtml(labelFn(row))}</option>`);
  });
  return opts.join("");
}

function setFilterOptions() {
  byId("adjBase").innerHTML = optionsHtml(state.bases, (r) => `${r.base_name} (${r.base_code})`);
  byId("adjFiscalYear").innerHTML = optionsHtml(state.fiscalYears, (r) => r.name);
  byId("adjMonth").innerHTML = '<option value="">All</option>' + createMonthOptionsHtml();
}

function readFilters() {
  return {
    base_id: toPositiveInt(byId("adjBase")?.value),
    fiscal_year_id: toPositiveInt(byId("adjFiscalYear")?.value),
    month: toPositiveInt(byId("adjMonth")?.value),
    demand_type: String(byId("adjDemandType")?.value || "").trim(),
    pakkhik: String(byId("adjPakkhik")?.value || "").trim(),
  };
}

function renderNoteRows() {
  const tbody = byId("adjNoteRows");
  if (!tbody) return;

  if (!state.noteSummaryRows.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="imp-empty">No issued note found</td></tr>';
    return;
  }

  tbody.innerHTML = state.noteSummaryRows
    .map((row, idx) => {
      const typeLabel = row.demand_type === "COMPLEMENTARY" ? "Complementary" : getPakkhikLabel(row.pakkhik);
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(row.note_no || "-")}</td>
          <td>${escapeHtml(row.base_name || "-")} (${escapeHtml(row.base_code || "-")})</td>
          <td>${escapeHtml(row.month_name || "-")} (${escapeHtml(typeLabel)})</td>
          <td>${escapeHtml(row.dispatch_no || "-")}</td>
          <td class="imp-right">${formatMoney(row.issued_amount)}</td>
          <td class="imp-right">${formatMoney(row.adjusted_amount)}</td>
          <td class="imp-right">${formatMoney(row.pending_adjustment)}</td>
          <td>
            <button class="imp-mini-btn primary" data-action="select-note" data-note-id="${Number(row.note_id)}" type="button">
              Select
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function setKpisFromNote(note) {
  const items = ensureArray(note?.items);
  const issuedTotal = items.reduce((sum, item) => sum + toNumber(item.issued_amount), 0);
  const adjustedTotal = items.reduce((sum, item) => sum + toNumber(item.adjusted_amount ?? item.adjustment_amount), 0);
  const pendingTotal = Math.max(0, Number((issuedTotal - adjustedTotal).toFixed(2)));

  byId("adjIssuedTotal").textContent = formatMoney(issuedTotal);
  byId("adjAdjustedTotal").textContent = formatMoney(adjustedTotal);
  byId("adjPendingTotal").textContent = formatMoney(pendingTotal);
  byId("adjSavedCount").textContent = String(items.length);
}

function renderEntryRows(note) {
  const tbody = byId("adjEntryRows");
  if (!tbody) return;

  const items = ensureArray(note?.items);
  const issuedItems = items.filter((item) => toNumber(item.issued_amount) > 0);

  if (!issuedItems.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="imp-empty">No issued note item found</td></tr>';
    return;
  }

  tbody.innerHTML = issuedItems
    .map((item, idx) => {
      const issued = toNumber(item.issued_amount);
      const adjusted = toNumber(item.adjusted_amount ?? item.adjustment_amount);
      const pending = Math.max(0, Number((issued - adjusted).toFixed(2)));
      return `
        <tr data-note-item-id="${Number(item.note_item_id || item.id)}" data-code-id="${Number(item.financial_code_id)}" data-pending="${pending}">
          <td>${idx + 1}</td>
          <td>${escapeHtml(item.khat_name || item.financial_code?.khat_name_bn || "-")}</td>
          <td>${escapeHtml(item.financial_code?.code || "-")}</td>
          <td class="imp-right">${formatMoney(issued)}</td>
          <td class="imp-right">${formatMoney(adjusted)}</td>
          <td class="imp-right">${formatMoney(pending)}</td>
          <td class="imp-right"><input class="imp-input adj-now" type="number" min="0" step="0.01" max="${pending}" value="${pending}" /></td>
          <td><input class="imp-input adj-row-remarks" value="" placeholder="Optional" /></td>
        </tr>
      `;
    })
    .join("");
}

async function loadMasters() {
  const [basesOut, fyOut] = await Promise.all([imprestFetch("/bases"), imprestFetch("/fiscal-years")]);
  state.bases = ensureArray(basesOut.data);
  state.fiscalYears = ensureArray(fyOut.data);
  setFilterOptions();
}

async function loadIssuedNotes() {
  const filters = readFilters();
  if (!filters.base_id || !filters.fiscal_year_id) {
    throw new Error("Select base and fiscal year first");
  }

  const params = new URLSearchParams({
    type: "dispatch_note_adjustment",
    base_id: String(filters.base_id),
    fiscal_year_id: String(filters.fiscal_year_id),
  });
  if (filters.month) params.set("month", String(filters.month));
  if (filters.demand_type) params.set("demand_type", filters.demand_type);
  if (filters.pakkhik) params.set("pakkhik", filters.pakkhik);

  const out = await imprestFetch(`/reports?${params.toString()}`);
  const rows = ensureArray(out.data).filter((row) =>
    ISSUED_STATUSES.has(String(row.status || "FUND_ISSUED").toUpperCase())
  );

  const byNote = new Map();
  rows.forEach((row) => {
    const key = Number(row.note_id);
    if (!key) return;
    const existing =
      byNote.get(key) ||
      {
        note_id: key,
        note_no: row.note_no,
        base_name: row.base_name,
        base_code: row.base_code,
        month: row.month,
        month_name: row.month_name,
        demand_type: row.demand_type,
        pakkhik: row.pakkhik,
        dispatch_no: row.dispatch_no,
        issued_amount: 0,
        adjusted_amount: 0,
        pending_adjustment: 0,
      };

    existing.issued_amount = Number((existing.issued_amount + toNumber(row.issued_amount)).toFixed(2));
    existing.adjusted_amount = Number((existing.adjusted_amount + toNumber(row.adjusted_amount)).toFixed(2));
    existing.pending_adjustment = Number((existing.issued_amount - existing.adjusted_amount).toFixed(2));

    byNote.set(key, existing);
  });

  state.noteSummaryRows = Array.from(byNote.values()).sort((a, b) => {
    if (a.month !== b.month) return Number(a.month) - Number(b.month);
    return String(a.note_no || "").localeCompare(String(b.note_no || ""));
  });

  state.selectedNote = null;
  byId("adjDetailCard").style.display = "none";
  renderNoteRows();
}

async function selectNote(noteId) {
  const id = toPositiveInt(noteId);
  if (!id) return;

  const out = await imprestFetch(`/notes/${id}`);
  state.selectedNote = out.data;

  byId("adjDetailCard").style.display = "block";
  const demandLabel =
    String(state.selectedNote.demand_type || "REGULAR").toUpperCase() === "COMPLEMENTARY"
      ? "Complementary"
      : getPakkhikLabel(state.selectedNote.pakkhik);
  const dispatchNo = ensureArray(state.selectedNote.issues).slice(-1)[0]?.dispatch_no || ensureArray(state.selectedNote.issues).slice(-1)[0]?.voucher_no || "-";

  byId("adjSelectedLabel").textContent = `${state.selectedNote.note_no} | ${state.selectedNote.month_name} (${demandLabel}) | Dispatch: ${dispatchNo}`;
  setKpisFromNote(state.selectedNote);
  renderEntryRows(state.selectedNote);
}

function readAdjustmentPayloadRows() {
  const rows = Array.from(byId("adjEntryRows")?.querySelectorAll("tr") || []);
  return rows
    .map((row) => {
      const pending = toNumber(row.getAttribute("data-pending"));
      const amount = toNumber(row.querySelector(".adj-now")?.value);
      if (amount <= 0) return null;
      if (amount > pending) throw new Error("Adjusted amount exceeds pending amount");
      return {
        note_item_id: Number(row.getAttribute("data-note-item-id")),
        id: Number(row.getAttribute("data-note-item-id")),
        financial_code_id: Number(row.getAttribute("data-code-id")),
        adjusted_amount: Number(amount.toFixed(2)),
        remarks: String(row.querySelector(".adj-row-remarks")?.value || "").trim() || null,
      };
    })
    .filter(Boolean);
}

async function saveAdjustments() {
  const noteId = toPositiveInt(state.selectedNote?.id);
  if (!noteId) {
    showToast("Select a note first", "warn");
    return;
  }

  const adjustments = readAdjustmentPayloadRows();
  if (!adjustments.length) {
    showToast("Enter at least one adjustment amount", "warn");
    return;
  }

  const payload = {
    adjustment_date: byId("adjEntryDate")?.value || null,
    adjustment_ref_no: String(byId("adjEntryRef")?.value || "").trim() || null,
    remarks: String(byId("adjEntryRemarks")?.value || "").trim() || null,
    adjustments,
  };

  const button = byId("adjSaveBtn");
  const release = setButtonBusy(button, true, "Saving...");
  try {
    await imprestFetch(`/notes/${noteId}/adjust`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    showToast("Adjustment saved", "success");
    await loadIssuedNotes();
    await selectNote(noteId);
  } catch (err) {
    showToast(err.message || "Failed to save adjustment", "error");
  } finally {
    release();
  }
}

function bindEvents() {
  byId("adjLoadBtn")?.addEventListener("click", () => {
    loadIssuedNotes().catch((err) => showToast(err.message || "Failed to load notes", "error"));
  });

  byId("adjNoteRows")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='select-note']");
    if (!btn) return;
    const noteId = toPositiveInt(btn.getAttribute("data-note-id"));
    if (!noteId) return;
    selectNote(noteId).catch((err) => showToast(err.message || "Failed to open note", "error"));
  });

  byId("adjSaveBtn")?.addEventListener("click", saveAdjustments);
}

async function init() {
  byId("adjEntryDate").value = todayDate();
  bindEvents();
  await loadMasters();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message || "Failed to initialize imprest adjustment", "error"));
});
