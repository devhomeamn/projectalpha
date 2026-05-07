import {
  byId,
  createMonthOptionsHtml,
  ensureArray,
  escapeHtml,
  formatMoney,
  getFiscalMonthSortIndex,
  getFiscalStartMonth,
  getPakkhikLabel,
  imprestFetch,
  preventNumberInputWheel,
  setButtonBusy,
  showToast,
  toNumber,
  toPositiveInt,
} from "./imprest-common.js";

const ISSUED_STATUSES = new Set(["FUND_ISSUED", "PARTIALLY_ADJUSTED", "ADJUSTED"]);
const ADJUSTMENT_DRAFT_STORAGE_KEY = "imprest_adjustment_drafts_v1";
let adjConfirmResolve = null;

const state = {
  bases: [],
  fiscalYears: [],
  noteSummaryRows: [],
  selectedNoteIds: new Set(),
  selectedNotes: [],
  aggregateRows: [],
  adjustBudgetRows: [],
  adjustBudgetByCode: new Map(),
  drafts: [],
  activeDraftId: null,
};

function ensureConfirmModal() {
  if (byId("adjConfirmModal")) return;
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div id="adjConfirmModal" class="inv-modal" aria-hidden="true">
        <div class="inv-modal-card narrow">
          <div class="inv-modal-head">
            <h4 id="adjConfirmTitle">Confirm Action</h4>
            <button id="adjConfirmClose" class="inv-close" type="button">&times;</button>
          </div>
          <p id="adjConfirmMessage" class="imp-card-sub" style="margin: 2px 0 0; font-size: 13px; color: #334155;"></p>
          <div class="imp-actions" style="margin-top:12px;">
            <button id="adjConfirmCancel" class="imp-btn secondary" type="button">Cancel</button>
            <button id="adjConfirmOk" class="imp-btn warn" type="button">Confirm</button>
          </div>
        </div>
      </div>
    `
  );

  const closeWith = (value) => {
    const modal = byId("adjConfirmModal");
    if (modal) {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    }
    const resolve = adjConfirmResolve;
    adjConfirmResolve = null;
    if (resolve) resolve(Boolean(value));
  };

  byId("adjConfirmClose")?.addEventListener("click", () => closeWith(false));
  byId("adjConfirmCancel")?.addEventListener("click", () => closeWith(false));
  byId("adjConfirmOk")?.addEventListener("click", () => closeWith(true));
  byId("adjConfirmModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "adjConfirmModal") closeWith(false);
  });
}

async function showConfirmModal({
  title = "Confirm Action",
  message = "Are you sure?",
  confirmText = "Confirm",
} = {}) {
  ensureConfirmModal();
  const modal = byId("adjConfirmModal");
  if (!modal) return false;
  if (adjConfirmResolve) return false;

  byId("adjConfirmTitle").textContent = String(title);
  byId("adjConfirmMessage").textContent = String(message);
  byId("adjConfirmOk").textContent = String(confirmText);

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  return new Promise((resolve) => {
    adjConfirmResolve = resolve;
  });
}

function toInputAmount(value) {
  const n = toNumber(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Number(n.toFixed(2)));
}

function normalizeDraftRows(rows) {
  return ensureArray(rows)
    .map((raw) => {
      const codeId = toPositiveInt(raw?.financial_code_id);
      if (!codeId) return null;
      const adjustedAmount = Math.max(0, Number(toNumber(raw?.adjusted_amount).toFixed(2)));
      const noIssueAmount = Math.max(0, Number(toNumber(raw?.unissued_adjusted_amount).toFixed(2)));
      const remarks = String(raw?.remarks || "").trim() || null;
      if (adjustedAmount <= 0 && noIssueAmount <= 0 && !remarks) return null;
      return {
        financial_code_id: codeId,
        adjusted_amount: adjustedAmount,
        unissued_adjusted_amount: noIssueAmount,
        remarks,
      };
    })
    .filter(Boolean);
}

function readDraftStore() {
  try {
    const raw = localStorage.getItem(ADJUSTMENT_DRAFT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((raw) => {
        const id = String(raw?.id || "").trim();
        if (!id) return null;
        return {
          id,
          note_ids: ensureArray(raw?.note_ids).map((x) => toPositiveInt(x)).filter(Boolean),
          filters: {
            base_id: toPositiveInt(raw?.filters?.base_id),
            fiscal_year_id: toPositiveInt(raw?.filters?.fiscal_year_id),
            month: toPositiveInt(raw?.filters?.month),
            demand_type: String(raw?.filters?.demand_type || "").trim().toUpperCase() || null,
            pakkhik: String(raw?.filters?.pakkhik || "").trim().toUpperCase() || null,
          },
          adjustment_date: String(raw?.adjustment_date || "").trim() || null,
          adjustment_ref_no: String(raw?.adjustment_ref_no || "").trim() || null,
          remarks: String(raw?.remarks || "").trim() || null,
          allow_over_adjustment: Boolean(raw?.allow_over_adjustment),
          over_adjustment_note: String(raw?.over_adjustment_note || "").trim() || null,
          adjustments: normalizeDraftRows(raw?.adjustments),
          created_at: String(raw?.created_at || "").trim() || new Date().toISOString(),
          updated_at: String(raw?.updated_at || "").trim() || new Date().toISOString(),
        };
      })
      .filter(Boolean)
      .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  } catch {
    return [];
  }
}

function writeDraftStore(drafts) {
  try {
    localStorage.setItem(ADJUSTMENT_DRAFT_STORAGE_KEY, JSON.stringify(ensureArray(drafts)));
  } catch {
    // Ignore localStorage quota/private mode issues.
  }
}

function findDraftById(draftId) {
  const id = String(draftId || "").trim();
  if (!id) return null;
  return state.drafts.find((draft) => draft.id === id) || null;
}

function buildDraftLabel(draft) {
  const date = String(draft?.adjustment_date || "").trim();
  const ref = String(draft?.adjustment_ref_no || "").trim() || "No Ref";
  const notes = ensureArray(draft?.note_ids);
  const preview = notes.slice(0, 3).join(",");
  const more = notes.length > 3 ? `+${notes.length - 3}` : "";
  const notesText = notes.length ? `${preview}${more ? ` ${more}` : ""}` : "No note";
  return `${date || "No Date"} | ${ref} | Notes: ${notesText}`;
}

function paintDraftStatus() {
  const el = byId("adjDraftStatusText");
  if (!el) return;
  const activeDraft = findDraftById(state.activeDraftId);
  if (!activeDraft) {
    el.textContent = "Draft: New";
    return;
  }
  el.textContent = `Draft: ${buildDraftLabel(activeDraft)}`;
}

function renderDraftOptions() {
  const select = byId("adjDraftSelect");
  if (!select) return;

  const options = state.drafts
    .map((draft) => `<option value="${escapeHtml(draft.id)}">${escapeHtml(buildDraftLabel(draft))}</option>`)
    .join("");

  select.innerHTML = '<option value="">Select saved draft</option>' + options;

  const active = findDraftById(state.activeDraftId);
  if (active) {
    select.value = active.id;
  } else {
    state.activeDraftId = null;
    select.value = "";
  }

  const selectedId = String(select.value || "").trim();
  if (byId("adjDraftLoadBtn")) byId("adjDraftLoadBtn").disabled = !selectedId;
  if (byId("adjDraftDeleteBtn")) byId("adjDraftDeleteBtn").disabled = !selectedId;
  paintDraftStatus();
}

function refreshDraftState() {
  state.drafts = readDraftStore();
  renderDraftOptions();
}

function setActiveDraft(draftId = null) {
  const id = String(draftId || "").trim();
  state.activeDraftId = id || null;
  renderDraftOptions();
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

function getSelectedFiscalYearStartMonth() {
  const fiscalYearId = toPositiveInt(byId("adjFiscalYear")?.value);
  if (!fiscalYearId) return 7;
  const fiscalYear = ensureArray(state.fiscalYears).find((row) => toPositiveInt(row?.id) === fiscalYearId);
  return getFiscalStartMonth(fiscalYear, 7);
}

function setMonthFilterOptions(selected = null) {
  const monthSelect = byId("adjMonth");
  if (!monthSelect) return;
  const selectedMonth = toPositiveInt(selected ?? monthSelect.value);
  monthSelect.innerHTML = '<option value="">All</option>' + createMonthOptionsHtml(selectedMonth, getSelectedFiscalYearStartMonth());
  monthSelect.value = selectedMonth ? String(selectedMonth) : "";
}

function setFilterOptions() {
  byId("adjBase").innerHTML = optionsHtml(state.bases, (r) => `${r.base_name} (${r.base_code})`);
  byId("adjFiscalYear").innerHTML = optionsHtml(state.fiscalYears, (r) => r.name);
  setMonthFilterOptions();
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
  if (byId("adjAddAmount")) byId("adjAddAmount").value = "";
  if (byId("adjEntryDate")) byId("adjEntryDate").value = "";
  if (byId("adjEntryRef")) byId("adjEntryRef").value = "";
  if (byId("adjEntryRemarks")) byId("adjEntryRemarks").value = "";
  if (byId("adjAllowOver")) byId("adjAllowOver").value = "NO";
  if (byId("adjOverNote")) byId("adjOverNote").value = "";
  byId("adjDetailCard").style.display = "none";
  paintEntryTotals([]);
  paintDraftStatus();
}

function resetAllSelection() {
  state.selectedNoteIds = new Set();
  resetPreparedSelection();
  paintSelectedNoteTotals();
}

function isOverAdjustmentEnabled() {
  return String(byId("adjAllowOver")?.value || "NO").toUpperCase() === "YES";
}

function paintSelectedNoteTotals() {
  const rows = ensureArray(state.noteSummaryRows).filter((row) => state.selectedNoteIds.has(Number(row.note_id)));
  const issued = rows.reduce((sum, row) => sum + toNumber(row.issued_amount), 0);
  const adjusted = rows.reduce((sum, row) => sum + toNumber(row.adjusted_amount), 0);
  const pending = rows.reduce((sum, row) => sum + toNumber(row.pending_adjustment), 0);

  byId("adjSelIssuedTotal").textContent = formatMoney(issued);
  byId("adjSelAdjustedTotal").textContent = formatMoney(adjusted);
  byId("adjSelPendingTotal").textContent = formatMoney(pending);
}

function getEntryTotalsFromTableRows(rows) {
  let issuedTotal = 0;
  let adjustedTotal = 0;
  let pendingTotal = 0;
  let addNowTotal = 0;
  let noIssueTotal = 0;
  let overTotal = 0;

  rows.forEach((row) => {
    const issued = toNumber(row.getAttribute("data-issued"));
    const pending = toNumber(row.getAttribute("data-pending"));
    const alreadyAdjusted = toNumber(row.getAttribute("data-adjusted"));
    const addNow = toNumber(row.querySelector(".adj-now")?.value);
    const noIssue = toNumber(row.querySelector(".adj-no-issue")?.value);

    issuedTotal += issued;
    adjustedTotal += alreadyAdjusted;
    pendingTotal += pending;
    addNowTotal += addNow;
    noIssueTotal += noIssue;
    overTotal += Math.max(0, addNow - pending);
  });

  return {
    issuedTotal: Number(issuedTotal.toFixed(2)),
    adjustedTotal: Number(adjustedTotal.toFixed(2)),
    pendingTotal: Number(pendingTotal.toFixed(2)),
    addNowTotal: Number(addNowTotal.toFixed(2)),
    noIssueTotal: Number(noIssueTotal.toFixed(2)),
    combinedTotal: Number((addNowTotal + noIssueTotal).toFixed(2)),
    overTotal: Number(overTotal.toFixed(2)),
  };
}

function paintEntryTotals(rowsInput = null) {
  const rows = Array.from(rowsInput || byId("adjEntryRows")?.querySelectorAll("tr") || []);
  const totals = getEntryTotalsFromTableRows(rows);

  byId("adjEntryIssuedTotal").textContent = formatMoney(totals.issuedTotal);
  byId("adjEntryAdjustedTotal").textContent = formatMoney(totals.adjustedTotal);
  byId("adjEntryPendingTotal").textContent = formatMoney(totals.pendingTotal);
  byId("adjEntryNowTotal").textContent = formatMoney(totals.addNowTotal);
  byId("adjEntryNoIssueTotal").textContent = formatMoney(totals.noIssueTotal);
  byId("adjEntryCombinedTotal").textContent = formatMoney(totals.combinedTotal);
  byId("adjEntryOverTotal").textContent = formatMoney(totals.overTotal);
}

function applyOverModeInputConstraints() {
  const rows = Array.from(byId("adjEntryRows")?.querySelectorAll("tr") || []);
  const allowOver = isOverAdjustmentEnabled();
  rows.forEach((row) => {
    const pending = toNumber(row.getAttribute("data-pending"));
    const input = row.querySelector(".adj-now");
    if (!input) return;
    if (allowOver) {
      input.removeAttribute("max");
      return;
    }
    input.setAttribute("max", String(Number(pending.toFixed(2))));
  });
}

function renderNoteRows() {
  const tbody = byId("adjNoteRows");
  if (!tbody) return;

  if (!state.noteSummaryRows.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="imp-empty">No issued note found</td></tr>';
    paintSelectedNoteTotals();
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
  paintSelectedNoteTotals();
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
    paintEntryTotals([]);
    return;
  }

  tbody.innerHTML = rows
    .map((row, idx) => {
      const issued = toNumber(row.issued_amount);
      const noIssueDisabled = issued > 0 ? "disabled" : "";
      const codeId = toPositiveInt(row.financial_code_id);
      return `
        <tr data-code-id="${codeId || ""}" data-issued="${issued}" data-adjusted="${Number(
          row.adjusted_amount
        )}" data-pending="${Number(row.pending_amount)}">
          <td>${idx + 1}</td>
          <td>${escapeHtml(row.khat_name_bn || "-")}</td>
          <td>${escapeHtml(row.code || "-")}</td>
          <td class="imp-right">${formatMoney(row.issued_amount)}</td>
          <td class="imp-right">${formatMoney(row.adjusted_amount)}</td>
          <td class="imp-right">${formatMoney(row.pending_amount)}</td>
          <td class="imp-right"><input class="imp-input adj-now" type="number" min="0" step="any" max="${Number(
            row.pending_amount
          )}" value="" /></td>
          <td class="imp-right"><input class="imp-input adj-no-issue" type="number" min="0" step="any" value="" ${noIssueDisabled} /></td>
          <td><input class="imp-input adj-row-remarks" value="" placeholder="Optional" /></td>
        </tr>
      `;
    })
    .join("");
  applyOverModeInputConstraints();
  paintEntryTotals(Array.from(tbody.querySelectorAll("tr")));
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
    paintEntryTotals(Array.from(tbody.querySelectorAll("tr")));
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
  const initialNoIssue = amount > 0 ? toInputAmount(amount) : "";

  tbody.insertAdjacentHTML(
    "beforeend",
    `
      <tr data-code-id="${codeId}" data-issued="0" data-adjusted="0" data-pending="0">
        <td>${sl}</td>
        <td>${escapeHtml(khat)}</td>
        <td>${escapeHtml(code)}</td>
        <td class="imp-right">${formatMoney(0)}</td>
        <td class="imp-right">${formatMoney(0)}</td>
        <td class="imp-right">${formatMoney(0)}</td>
        <td class="imp-right"><input class="imp-input adj-now" type="number" min="0" step="any" max="0" value="" /></td>
        <td class="imp-right"><input class="imp-input adj-no-issue" type="number" min="0" step="any" value="${initialNoIssue}" /></td>
        <td><input class="imp-input adj-row-remarks" value="" placeholder="Optional" /></td>
      </tr>
    `
  );

  state.adjustBudgetByCode.delete(codeId);
  const selectedOption = select.querySelector(`option[value="${codeId}"]`);
  if (selectedOption) selectedOption.remove();
  select.value = "";
  amountInput.value = "";
  byId("adjSavedCount").textContent = String((tbody.querySelectorAll("tr") || []).length);
  applyOverModeInputConstraints();
  paintEntryTotals(Array.from(tbody.querySelectorAll("tr")));
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

  const fiscalStartMonth = getSelectedFiscalYearStartMonth();
  state.noteSummaryRows = Array.from(byNote.values()).sort((a, b) => {
    const monthOrderDiff =
      getFiscalMonthSortIndex(a.month, fiscalStartMonth) - getFiscalMonthSortIndex(b.month, fiscalStartMonth);
    if (monthOrderDiff !== 0) return monthOrderDiff;
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
  byId("adjAddAmount").value = "";
}

function readAdjustmentPayloadRows({ allowOverAdjustment = false } = {}) {
  const rows = Array.from(byId("adjEntryRows")?.querySelectorAll("tr") || []);
  return rows
    .map((row) => {
      const codeId = toPositiveInt(row.getAttribute("data-code-id"));
      if (!codeId) return null;
      const issued = toNumber(row.getAttribute("data-issued"));
      const pending = toNumber(row.getAttribute("data-pending"));
      const amount = toNumber(row.querySelector(".adj-now")?.value);
      const noIssueAmount = toNumber(row.querySelector(".adj-no-issue")?.value);
      if (!allowOverAdjustment && amount > pending) throw new Error("Adjusted amount exceeds pending amount");
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

function collectDraftRowsFromTable() {
  const rows = Array.from(byId("adjEntryRows")?.querySelectorAll("tr") || []);
  const payloadRows = rows.map((row) => {
    const codeId = toPositiveInt(row.getAttribute("data-code-id"));
    if (!codeId) return null;
    return {
      financial_code_id: codeId,
      adjusted_amount: toNumber(row.querySelector(".adj-now")?.value),
      unissued_adjusted_amount: toNumber(row.querySelector(".adj-no-issue")?.value),
      remarks: String(row.querySelector(".adj-row-remarks")?.value || "").trim() || null,
    };
  });
  return normalizeDraftRows(payloadRows);
}

function upsertDraftRecord(draft) {
  const others = state.drafts.filter((x) => x.id !== draft.id);
  const next = [draft, ...others].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  writeDraftStore(next);
  refreshDraftState();
  setActiveDraft(draft.id);
}

function clearActiveDraftRecord() {
  if (!state.activeDraftId) return;
  const next = state.drafts.filter((x) => x.id !== state.activeDraftId);
  writeDraftStore(next);
  refreshDraftState();
  setActiveDraft(null);
}

function saveDraftRecord() {
  const noteIds = Array.from(state.selectedNoteIds).sort((a, b) => a - b);
  if (!noteIds.length) {
    showToast("Select at least one note before saving draft", "warn");
    return;
  }

  if (byId("adjDetailCard")?.style.display === "none") {
    showToast("Prepare selected notes first", "warn");
    return;
  }

  const existing = findDraftById(state.activeDraftId);
  const now = new Date().toISOString();
  const draft = {
    id: existing?.id || `adj-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    note_ids: noteIds,
    filters: readFilters(),
    adjustment_date: String(byId("adjEntryDate")?.value || "").trim() || null,
    adjustment_ref_no: String(byId("adjEntryRef")?.value || "").trim() || null,
    remarks: String(byId("adjEntryRemarks")?.value || "").trim() || null,
    allow_over_adjustment: isOverAdjustmentEnabled(),
    over_adjustment_note: String(byId("adjOverNote")?.value || "").trim() || null,
    adjustments: collectDraftRowsFromTable(),
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  upsertDraftRecord(draft);
  showToast(existing ? "Draft updated" : "Draft saved", "success");
}

function applyDraftRowsToTable(draftRows) {
  const tbody = byId("adjEntryRows");
  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll("tr"));
  rows.forEach((row) => {
    const nowInput = row.querySelector(".adj-now");
    const noIssueInput = row.querySelector(".adj-no-issue");
    const remarksInput = row.querySelector(".adj-row-remarks");
    if (nowInput) nowInput.value = "";
    if (noIssueInput && !noIssueInput.disabled) noIssueInput.value = "";
    if (remarksInput) remarksInput.value = "";
  });

  let skippedRows = 0;
  normalizeDraftRows(draftRows).forEach((entry) => {
    const codeId = toPositiveInt(entry.financial_code_id);
    if (!codeId) return;

    let row = tbody.querySelector(`tr[data-code-id="${codeId}"]`);
    if (!row) {
      const select = byId("adjAddCode");
      if (select?.querySelector(`option[value="${codeId}"]`)) {
        const previousSelect = String(select.value || "");
        if (byId("adjAddAmount")) byId("adjAddAmount").value = "";
        select.value = String(codeId);
        addEntryCodeRow();
        select.value = previousSelect;
        row = tbody.querySelector(`tr[data-code-id="${codeId}"]`);
      }
    }

    if (!row) {
      skippedRows += 1;
      return;
    }

    const nowInput = row.querySelector(".adj-now");
    const noIssueInput = row.querySelector(".adj-no-issue");
    const remarksInput = row.querySelector(".adj-row-remarks");

    if (nowInput) nowInput.value = toInputAmount(entry.adjusted_amount);
    if (noIssueInput && !noIssueInput.disabled) noIssueInput.value = toInputAmount(entry.unissued_adjusted_amount);
    if (remarksInput) remarksInput.value = String(entry.remarks || "");
  });

  paintEntryTotals(Array.from(tbody.querySelectorAll("tr")));
  if (skippedRows > 0) {
    showToast(`${skippedRows} draft row could not be restored (code missing in current setup)`, "warn");
  }
}

async function loadDraftForEdit() {
  const draftId = String(byId("adjDraftSelect")?.value || "").trim();
  if (!draftId) {
    showToast("Select a draft first", "warn");
    return;
  }

  const draft = findDraftById(draftId);
  if (!draft) {
    showToast("Draft not found", "error");
    refreshDraftState();
    return;
  }

  const baseId = toPositiveInt(draft.filters?.base_id);
  const fiscalYearId = toPositiveInt(draft.filters?.fiscal_year_id);
  if (!baseId || !fiscalYearId) {
    showToast("Draft is missing base/fiscal year", "error");
    return;
  }

  byId("adjBase").value = String(baseId);
  byId("adjFiscalYear").value = String(fiscalYearId);
  byId("adjMonth").value = draft.filters?.month ? String(draft.filters.month) : "";
  byId("adjDemandType").value = String(draft.filters?.demand_type || "");
  byId("adjPakkhik").value = String(draft.filters?.pakkhik || "");
  setMonthFilterOptions(draft.filters?.month);

  await loadIssuedNotes();

  const availableNoteIdSet = new Set(ensureArray(state.noteSummaryRows).map((row) => Number(row.note_id)));
  const selectedNoteIds = ensureArray(draft.note_ids)
    .map((id) => toPositiveInt(id))
    .filter((id) => id && availableNoteIdSet.has(Number(id)));

  if (!selectedNoteIds.length) {
    showToast("Draft notes are not available in current issued list", "warn");
    setActiveDraft(draft.id);
    return;
  }

  state.selectedNoteIds = new Set(selectedNoteIds);
  renderNoteRows();
  await prepareSelectedNotes();

  byId("adjEntryDate").value = String(draft.adjustment_date || "");
  byId("adjEntryRef").value = String(draft.adjustment_ref_no || "");
  byId("adjEntryRemarks").value = String(draft.remarks || "");
  byId("adjAllowOver").value = draft.allow_over_adjustment ? "YES" : "NO";
  byId("adjOverNote").value = String(draft.over_adjustment_note || "");
  applyOverModeInputConstraints();

  applyDraftRowsToTable(draft.adjustments);
  setActiveDraft(draft.id);
  showToast("Draft loaded for edit", "success");
}

function deleteSelectedDraft() {
  const draftId = String(byId("adjDraftSelect")?.value || "").trim();
  if (!draftId) {
    showToast("Select a draft first", "warn");
    return;
  }

  const next = state.drafts.filter((x) => x.id !== draftId);
  writeDraftStore(next);
  refreshDraftState();

  if (state.activeDraftId === draftId) {
    setActiveDraft(null);
  }

  showToast("Draft deleted", "success");
}

async function saveAdjustments() {
  const noteIds = Array.from(state.selectedNoteIds);
  if (!noteIds.length) {
    showToast("Select at least one note", "warn");
    return;
  }

  const allowOverAdjustment = isOverAdjustmentEnabled();
  const overAdjustmentNote = String(byId("adjOverNote")?.value || "").trim();
  const adjustments = readAdjustmentPayloadRows({ allowOverAdjustment });
  if (!adjustments.length) {
    showToast("Enter at least one adjustment amount", "warn");
    return;
  }

  const totals = getEntryTotalsFromTableRows(Array.from(byId("adjEntryRows")?.querySelectorAll("tr") || []));
  if (allowOverAdjustment && totals.overTotal > 0 && !overAdjustmentNote) {
    showToast("Over adjustment note is required when over amount is used", "warn");
    return;
  }

  const ok = await showConfirmModal({
    title: "Save Adjustment",
    message: "এই adjustment entry save করতে চান?",
    confirmText: "Save Adjustment",
  });
  if (!ok) return;

  const filters = readFilters();
  const payload = {
    note_ids: noteIds,
    month: filters.month || null,
    pakkhik: filters.pakkhik || null,
    adjustment_date: byId("adjEntryDate")?.value || null,
    adjustment_ref_no: String(byId("adjEntryRef")?.value || "").trim() || null,
    remarks: String(byId("adjEntryRemarks")?.value || "").trim() || null,
    allow_over_adjustment: allowOverAdjustment,
    over_adjustment_note: overAdjustmentNote || null,
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
    clearActiveDraftRecord();
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

  byId("adjFiscalYear")?.addEventListener("change", () => {
    setMonthFilterOptions();
    resetAllSelection();
    renderNoteRows();
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
    setActiveDraft(null);
    renderNoteRows();
  });

  byId("adjAllowOver")?.addEventListener("change", () => {
    applyOverModeInputConstraints();
    paintEntryTotals();
  });

  byId("adjEntryRows")?.addEventListener("input", (e) => {
    const target = e.target;
    if (!target.closest(".adj-now, .adj-no-issue")) return;
    paintEntryTotals();
  });

  byId("adjDraftSelect")?.addEventListener("change", () => {
    const selectedId = String(byId("adjDraftSelect")?.value || "").trim();
    if (byId("adjDraftLoadBtn")) byId("adjDraftLoadBtn").disabled = !selectedId;
    if (byId("adjDraftDeleteBtn")) byId("adjDraftDeleteBtn").disabled = !selectedId;
  });

  byId("adjDraftSaveBtn")?.addEventListener("click", saveDraftRecord);
  byId("adjDraftLoadBtn")?.addEventListener("click", () => {
    loadDraftForEdit().catch((err) => showToast(err.message || "Failed to load draft", "error"));
  });
  byId("adjDraftDeleteBtn")?.addEventListener("click", deleteSelectedDraft);

  byId("adjSaveBtn")?.addEventListener("click", saveAdjustments);
  byId("adjAddCodeBtn")?.addEventListener("click", addEntryCodeRow);
}

async function init() {
  preventNumberInputWheel(document);
  if (byId("adjEntryDate")) byId("adjEntryDate").value = "";
  if (byId("adjEntryRef")) byId("adjEntryRef").value = "";
  if (byId("adjEntryRemarks")) byId("adjEntryRemarks").value = "";
  if (byId("adjAddAmount")) byId("adjAddAmount").value = "";
  if (byId("adjAllowOver")) byId("adjAllowOver").value = "NO";
  if (byId("adjOverNote")) byId("adjOverNote").value = "";
  refreshDraftState();
  paintSelectedNoteTotals();
  paintEntryTotals([]);
  bindEvents();
  await loadMasters();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message || "Failed to initialize imprest adjustment", "error"));
});
