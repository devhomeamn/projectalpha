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
  selectedNoteIds: new Set(),
  selectedNotes: [],
  aggregateRows: [],
  adjustBudgetRows: [],
  adjustBudgetByCode: new Map(),
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
    pakkhik: String(byId("adjPakkhik")?.value || "").trim().toUpperCase(),
  };
}

function resetPreparedSelection() {
  state.selectedNotes = [];
  state.aggregateRows = [];
  state.adjustBudgetRows = [];
  state.adjustBudgetByCode = new Map();
  if (byId("adjAddCode")) byId("adjAddCode").innerHTML = '<option value="">Select khat/code</option>';
  if (byId("adjAddAmount")) byId("adjAddAmount").value = "0";
  byId("adjDetailCard").style.display = "none";
}

function resetAllSelection() {
  state.selectedNoteIds = new Set();
  resetPreparedSelection();
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
      const noteId = Number(row.note_id);
      const isChecked = state.selectedNoteIds.has(noteId) ? "checked" : "";
      return `
        <tr>
          <td style="text-align:center;">
            <input type="checkbox" class="adj-note-select" data-note-id="${noteId}" ${isChecked} />
          </td>
          <td>${idx + 1}</td>
          <td>${escapeHtml(row.note_no || "-")}</td>
          <td>${escapeHtml(row.base_name || "-")} (${escapeHtml(row.base_code || "-")})</td>
          <td>${escapeHtml(row.month_name || "-")} (${escapeHtml(typeLabel)})</td>
          <td>${escapeHtml(row.dispatch_no || "-")}</td>
          <td class="imp-right">${formatMoney(row.issued_amount)}</td>
          <td class="imp-right">${formatMoney(row.adjusted_amount)}</td>
          <td class="imp-right">${formatMoney(row.pending_adjustment)}</td>
        </tr>
      `;
    })
    .join("");
}

function setKpisFromRows(rows) {
  const issuedTotal = rows.reduce((sum, row) => sum + toNumber(row.issued_amount), 0);
  const adjustedTotal = rows.reduce((sum, row) => sum + toNumber(row.adjusted_amount), 0);
  const pendingTotal = rows.reduce((sum, row) => sum + toNumber(row.pending_amount), 0);

  byId("adjIssuedTotal").textContent = formatMoney(issuedTotal);
  byId("adjAdjustedTotal").textContent = formatMoney(adjustedTotal);
  byId("adjPendingTotal").textContent = formatMoney(pendingTotal);
  byId("adjSavedCount").textContent = String(rows.length);
}

function renderEntryRows(rows) {
  const tbody = byId("adjEntryRows");
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="imp-empty">No code-wise row found</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map((row, idx) => {
      const issued = toNumber(row.issued_amount);
      const noIssueDisabled = issued > 0 ? "disabled" : "";
      const codeId = toPositiveInt(row.financial_code_id);
      return `
        <tr data-code-id="${codeId || ""}" data-issued="${issued}" data-pending="${Number(row.pending_amount)}">
          <td>${idx + 1}</td>
          <td>${escapeHtml(row.khat_name_bn || "-")}</td>
          <td>${escapeHtml(row.code || "-")}</td>
          <td class="imp-right">${formatMoney(row.issued_amount)}</td>
          <td class="imp-right">${formatMoney(row.adjusted_amount)}</td>
          <td class="imp-right">${formatMoney(row.pending_amount)}</td>
          <td class="imp-right"><input class="imp-input adj-now" type="number" min="0" step="0.01" max="${Number(
            row.pending_amount
          )}" value="${Number(row.pending_amount)}" /></td>
          <td class="imp-right"><input class="imp-input adj-no-issue" type="number" min="0" step="0.01" value="0" ${noIssueDisabled} /></td>
          <td><input class="imp-input adj-row-remarks" value="" placeholder="Optional" /></td>
        </tr>
      `;
    })
    .join("");
}

function buildAddCodeOptionLabel(row) {
  const code = row?.financial_code?.code || `CODE-${Number(row?.financial_code_id || 0)}`;
  const khat = row?.financial_code?.khat_name_bn || row?.financial_code?.khat_name_en || "-";
  return `${code} - ${khat}`;
}

function setAddCodeOptions() {
  const select = byId("adjAddCode");
  if (!select) return;

  const existingCodes = new Set(state.aggregateRows.map((row) => toPositiveInt(row.financial_code_id)).filter(Boolean));
  const rows = ensureArray(state.adjustBudgetRows).filter((row) => {
    const codeId = toPositiveInt(row.financial_code_id);
    return codeId && !existingCodes.has(codeId);
  });

  state.adjustBudgetByCode = new Map();
  rows.forEach((row) => {
    const codeId = toPositiveInt(row.financial_code_id);
    if (!codeId) return;
    state.adjustBudgetByCode.set(codeId, row);
  });

  select.innerHTML =
    '<option value="">Select khat/code</option>' +
    rows
      .map((row) => `<option value="${Number(row.financial_code_id)}">${escapeHtml(buildAddCodeOptionLabel(row))}</option>`)
      .join("");
}

function addEntryCodeRow() {
  const tbody = byId("adjEntryRows");
  const select = byId("adjAddCode");
  const amountInput = byId("adjAddAmount");
  if (!tbody || !select || !amountInput) return;

  const codeId = toPositiveInt(select.value);
  if (!codeId) {
    showToast("Select a khat/code first", "warn");
    return;
  }

  const amount = toNumber(amountInput.value);
  if (amount < 0) {
    showToast("Adjusted amount cannot be negative", "warn");
    return;
  }

  const existingRow = tbody.querySelector(`tr[data-code-id="${codeId}"]`);
  if (existingRow) {
    const noIssueInput = existingRow.querySelector(".adj-no-issue");
    if (noIssueInput && amount > 0) {
      noIssueInput.value = String(Number((toNumber(noIssueInput.value) + amount).toFixed(2)));
    }
    showToast("This code is already in adjustment table", "warn");
    return;
  }

  const meta = state.adjustBudgetByCode.get(codeId);
  if (!meta) {
    showToast("Selected code is not available in budget setup", "warn");
    return;
  }

  const code = meta?.financial_code?.code || `CODE-${codeId}`;
  const khat = meta?.financial_code?.khat_name_bn || meta?.financial_code?.khat_name_en || "-";
  const sl = (tbody.querySelectorAll("tr") || []).length + 1;
  const initialNoIssue = Math.max(0, Number(amount.toFixed(2)));

  tbody.insertAdjacentHTML(
    "beforeend",
    `
      <tr data-code-id="${codeId}" data-issued="0" data-pending="0">
        <td>${sl}</td>
        <td>${escapeHtml(khat)}</td>
        <td>${escapeHtml(code)}</td>
        <td class="imp-right">${formatMoney(0)}</td>
        <td class="imp-right">${formatMoney(0)}</td>
        <td class="imp-right">${formatMoney(0)}</td>
        <td class="imp-right"><input class="imp-input adj-now" type="number" min="0" step="0.01" max="0" value="0" /></td>
        <td class="imp-right"><input class="imp-input adj-no-issue" type="number" min="0" step="0.01" value="${initialNoIssue}" /></td>
        <td><input class="imp-input adj-row-remarks" value="" placeholder="Optional" /></td>
      </tr>
    `
  );

  state.adjustBudgetByCode.delete(codeId);
  const selectedOption = select.querySelector(`option[value="${codeId}"]`);
  if (selectedOption) selectedOption.remove();
  select.value = "";
  amountInput.value = "0";
  byId("adjSavedCount").textContent = String((tbody.querySelectorAll("tr") || []).length);
}

function setSelectionSummary(notes) {
  const noteNos = notes.map((x) => x.note_no).filter(Boolean);
  const first = notes[0] || {};
  const preview = noteNos.slice(0, 4).join(", ");
  const more = noteNos.length > 4 ? ` ... +${noteNos.length - 4} more` : "";

  byId("adjSelectedLabel").textContent =
    `${notes.length} note selected | ${first.base?.base_name || first.base_name || "-"} | ${preview}${more}`;
}

function buildAggregateRows(notes) {
  const map = new Map();

  notes.forEach((note) => {
    ensureArray(note.items).forEach((item) => {
      const codeId = toPositiveInt(item.financial_code_id);
      if (!codeId) return;

      const issued = toNumber(item.issued_amount);
      const adjusted = toNumber(item.adjusted_amount ?? item.adjustment_amount);
      const bucket =
        map.get(codeId) ||
        {
          financial_code_id: codeId,
          code: item.financial_code?.code || `CODE-${codeId}`,
          khat_name_bn: item.khat_name || item.financial_code?.khat_name_bn || "-",
          issued_amount: 0,
          adjusted_amount: 0,
          pending_amount: 0,
        };

      bucket.issued_amount = Number((bucket.issued_amount + issued).toFixed(2));
      bucket.adjusted_amount = Number((bucket.adjusted_amount + adjusted).toFixed(2));
      bucket.pending_amount = Math.max(0, Number((bucket.issued_amount - bucket.adjusted_amount).toFixed(2)));

      map.set(codeId, bucket);
    });
  });

  return Array.from(map.values())
    .sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));
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
  if (filters.pakkhik) params.set("pakkhik", filters.pakkhik);
  if (filters.demand_type) params.set("demand_type", filters.demand_type);

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
    existing.pending_adjustment = Math.max(0, Number((existing.issued_amount - existing.adjusted_amount).toFixed(2)));

    byNote.set(key, existing);
  });

  state.noteSummaryRows = Array.from(byNote.values()).sort((a, b) => {
    if (a.month !== b.month) return Number(a.month) - Number(b.month);
    return String(a.note_no || "").localeCompare(String(b.note_no || ""));
  });

  resetAllSelection();
  renderNoteRows();
}

async function prepareSelectedNotes() {
  if (!state.selectedNoteIds.size) {
    showToast("Select at least one note", "warn");
    return;
  }

  const noteIds = Array.from(state.selectedNoteIds);
  const notesOut = await Promise.all(noteIds.map((id) => imprestFetch(`/notes/${id}`)));
  const notes = notesOut.map((x) => x.data).filter(Boolean);

  if (!notes.length) throw new Error("Selected notes could not be loaded");

  const baseId = Number(notes[0].base_id || 0);
  const fiscalYearId = Number(notes[0].fiscal_year_id || 0);
  if (notes.some((x) => Number(x.base_id) !== baseId)) {
    throw new Error("Selected notes must belong to same base");
  }
  if (notes.some((x) => Number(x.fiscal_year_id) !== fiscalYearId)) {
    throw new Error("Selected notes must belong to same fiscal year");
  }

  const budgetsOut = await imprestFetch(`/budgets?base_id=${baseId}&fiscal_year_id=${fiscalYearId}`);
  state.adjustBudgetRows = ensureArray(budgetsOut.data);

  const aggregateRows = buildAggregateRows(notes);
  if (!aggregateRows.length) throw new Error("No code-wise row found for selected notes");

  state.selectedNotes = notes;
  state.aggregateRows = aggregateRows;

  byId("adjDetailCard").style.display = "block";
  setSelectionSummary(notes);
  setKpisFromRows(aggregateRows);
  renderEntryRows(aggregateRows);
  setAddCodeOptions();
  byId("adjAddAmount").value = "0";
}

function readAdjustmentPayloadRows() {
  const rows = Array.from(byId("adjEntryRows")?.querySelectorAll("tr") || []);
  return rows
    .map((row) => {
      const codeId = toPositiveInt(row.getAttribute("data-code-id"));
      if (!codeId) return null;
      const issued = toNumber(row.getAttribute("data-issued"));
      const pending = toNumber(row.getAttribute("data-pending"));
      const amount = toNumber(row.querySelector(".adj-now")?.value);
      const noIssueAmount = toNumber(row.querySelector(".adj-no-issue")?.value);
      if (amount > pending) throw new Error("Adjusted amount exceeds pending amount");
      if (noIssueAmount > 0 && issued > 0) {
        throw new Error("No-issue adjustment is allowed only when issued amount is zero");
      }
      if (amount <= 0 && noIssueAmount <= 0) return null;
      return {
        financial_code_id: Number(codeId),
        adjusted_amount: Number(amount.toFixed(2)),
        unissued_adjusted_amount: Number(noIssueAmount.toFixed(2)),
        remarks: String(row.querySelector(".adj-row-remarks")?.value || "").trim() || null,
      };
    })
    .filter(Boolean);
}

async function saveAdjustments() {
  const noteIds = Array.from(state.selectedNoteIds);
  if (!noteIds.length) {
    showToast("Select at least one note", "warn");
    return;
  }

  const adjustments = readAdjustmentPayloadRows();
  if (!adjustments.length) {
    showToast("Enter at least one adjustment amount", "warn");
    return;
  }

  const filters = readFilters();
  const payload = {
    note_ids: noteIds,
    month: filters.month || null,
    pakkhik: filters.pakkhik || null,
    adjustment_date: byId("adjEntryDate")?.value || null,
    adjustment_ref_no: String(byId("adjEntryRef")?.value || "").trim() || null,
    remarks: String(byId("adjEntryRemarks")?.value || "").trim() || null,
    adjustments,
  };

  const button = byId("adjSaveBtn");
  const release = setButtonBusy(button, true, "Saving...");
  try {
    const out = await imprestFetch("/adjustments/notes", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    showToast(out.message || "Adjustment saved", "success");
    await loadIssuedNotes();
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

  byId("adjPrepareBtn")?.addEventListener("click", () => {
    prepareSelectedNotes().catch((err) => showToast(err.message || "Failed to prepare notes", "error"));
  });

  byId("adjNoteRows")?.addEventListener("change", (e) => {
    const checkbox = e.target.closest(".adj-note-select");
    if (!checkbox) return;
    const noteId = toPositiveInt(checkbox.getAttribute("data-note-id"));
    if (!noteId) return;

    if (checkbox.checked) state.selectedNoteIds.add(noteId);
    else state.selectedNoteIds.delete(noteId);

    resetPreparedSelection();
    renderNoteRows();
  });

  byId("adjSaveBtn")?.addEventListener("click", saveAdjustments);
  byId("adjAddCodeBtn")?.addEventListener("click", addEntryCodeRow);
}

async function init() {
  byId("adjEntryDate").value = todayDate();
  bindEvents();
  await loadMasters();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message || "Failed to initialize imprest adjustment", "error"));
});
