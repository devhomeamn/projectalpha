import {
  amountInBanglaWords,
  byId,
  createMonthOptionsHtml,
  createPakkhikOptionsHtml,
  escapeHtml,
  getMonthNameBn,
  getPakkhikLabel,
  getPakkhikShort,
  iframePrint,
  imprestFetch,
  normalizeStatusClass,
  setButtonBusy,
  showToast,
  toBanglaDigits,
  toNumber,
  toPositiveInt,
} from "./imprest-common.js";

const state = {
  bases: [],
  fiscalYears: [],
  availableCodes: [],
  preferredCodeIds: [],
  note: null,
};

const DEFAULT_GENERATE_CODE_LIMIT = 30;
const PREFERRED_CODES_STORAGE_KEY = "imprest_note_preferred_codes_v1";
const codeCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function compareCodeText(a, b) {
  const codeA = String(a || "").trim();
  const codeB = String(b || "").trim();
  const out = codeCollator.compare(codeA, codeB);
  if (out !== 0) return out;
  return codeA.localeCompare(codeB);
}

function formatMoneyTrim(value, locale = "en-IN") {
  const n = toNumber(value);
  return n.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatMoneyBnTrim(value) {
  return toBanglaDigits(formatMoneyTrim(value));
}

function statusBadgeClass(status) {
  return normalizeStatusClass(status || "");
}

function setBaseOptions() {
  const el = byId("impBase");
  if (!el) return;
  const options = state.bases
    .map((row) => `<option value="${Number(row.id)}">${escapeHtml(row.base_name)} (${escapeHtml(row.base_code)})</option>`)
    .join("");
  el.innerHTML = options || '<option value="">No base found</option>';
}

function setFiscalYearOptions() {
  const el = byId("impFiscalYear");
  if (!el) return;
  const options = state.fiscalYears
    .map((row) => `<option value="${Number(row.id)}">${escapeHtml(row.name)}</option>`)
    .join("");
  el.innerHTML = options || '<option value="">No fiscal year</option>';
}

function setFixedSelectors() {
  const month = byId("impMonth");
  const pakkhik = byId("impPakkhik");
  const demandType = byId("impDemandType");
  if (month) month.innerHTML = createMonthOptionsHtml(new Date().getMonth() + 1);
  if (demandType) demandType.value = "REGULAR";
  if (pakkhik) pakkhik.innerHTML = createPakkhikOptionsHtml("FIRST_HALF");
}

function setDemandTypeVisibility() {
  const demandType = String(byId("impDemandType")?.value || "REGULAR").toUpperCase();
  const pakkhikSelect = byId("impPakkhik");
  const block = byId("impSuppPeriodBlock");
  if (!block || !pakkhikSelect) return;

  if (demandType === "COMPLEMENTARY") {
    block.style.display = "flex";
    pakkhikSelect.value = "NONE";
    pakkhikSelect.disabled = true;
    return;
  }

  block.style.display = "none";
  pakkhikSelect.disabled = false;
  const current = String(pakkhikSelect.value || "").toUpperCase();
  if (!["FIRST_HALF", "SECOND_HALF"].includes(current)) {
    pakkhikSelect.value = "FIRST_HALF";
  }
}

function toCodeMeta(row) {
  const id = toPositiveInt(row?.financial_code_id);
  const code = String(row?.financial_code?.code || (id ? `CODE-${id}` : "CODE")).trim();
  const khat = String(row?.financial_code?.khat_name_bn || row?.financial_code?.khat_name_en || "-").trim();
  const budget = toNumber(row?.budget_amount);
  return { id, code, khat, budget };
}

function compareCodeMeta(a, b) {
  const byCode = compareCodeText(a?.code, b?.code);
  if (byCode !== 0) return byCode;
  return toPositiveInt(a?.id) - toPositiveInt(b?.id);
}

function getSortedAvailableCodeMetas() {
  return (state.availableCodes || [])
    .map(toCodeMeta)
    .filter((row) => row.id)
    .sort(compareCodeMeta);
}

function sortNoteItemsByCode(items = []) {
  return [...items].sort((a, b) => {
    const codeA = String(a?.financial_code?.code || a?.financialCode?.code || "").trim();
    const codeB = String(b?.financial_code?.code || b?.financialCode?.code || "").trim();
    const byCode = compareCodeText(codeA, codeB);
    if (byCode !== 0) return byCode;
    return toPositiveInt(a?.financial_code_id) - toPositiveInt(b?.financial_code_id);
  });
}

function getPreferenceScopeKey() {
  const baseId = toPositiveInt(byId("impBase")?.value);
  const fiscalYearId = toPositiveInt(byId("impFiscalYear")?.value);
  if (!baseId || !fiscalYearId) return "";
  return `${baseId}:${fiscalYearId}`;
}

function readPreferredStore() {
  try {
    const raw = localStorage.getItem(PREFERRED_CODES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePreferredStore(next) {
  try {
    localStorage.setItem(PREFERRED_CODES_STORAGE_KEY, JSON.stringify(next || {}));
  } catch {
    // Ignore storage errors (private mode, quota, etc.)
  }
}

function parseCodeIdList(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const out = [];
  values.forEach((value) => {
    const id = toPositiveInt(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
}

function readPreferredCodesForCurrentScope() {
  const scopeKey = getPreferenceScopeKey();
  if (!scopeKey) return [];
  const store = readPreferredStore();
  return parseCodeIdList(store[scopeKey]);
}

function savePreferredCodesForCurrentScope(codeIds) {
  const scopeKey = getPreferenceScopeKey();
  if (!scopeKey) return;
  const store = readPreferredStore();
  const ids = parseCodeIdList(codeIds).slice(0, DEFAULT_GENERATE_CODE_LIMIT);
  if (!ids.length) {
    delete store[scopeKey];
  } else {
    store[scopeKey] = ids;
  }
  writePreferredStore(store);
}

function getBudgetRowByCodeId(codeId) {
  const id = toPositiveInt(codeId);
  if (!id) return null;
  return (state.availableCodes || []).find((row) => toPositiveInt(row?.financial_code_id) === id) || null;
}

function getCurrentNoteCodeIdSet() {
  const set = new Set();
  const rows = Array.isArray(state.note?.items) ? state.note.items : [];
  rows.forEach((row) => {
    const id = toPositiveInt(row?.financial_code_id);
    if (id) set.add(id);
  });
  return set;
}

function resolveGenerationCodeIds() {
  const sorted = getSortedAvailableCodeMetas();
  if (!sorted.length) return [];

  const availableIdSet = new Set(sorted.map((row) => row.id));
  const preferred = parseCodeIdList(state.preferredCodeIds).filter((id) => availableIdSet.has(id));
  if (preferred.length) {
    return preferred.slice(0, DEFAULT_GENERATE_CODE_LIMIT);
  }
  return sorted.slice(0, DEFAULT_GENERATE_CODE_LIMIT).map((row) => row.id);
}

function updateGenerateCodeHint() {
  const hintEl = byId("impGenerateCodeHint");
  if (!hintEl) return;

  const sorted = getSortedAvailableCodeMetas();
  if (!sorted.length) {
    hintEl.textContent = "No budget code found for selected base and fiscal year.";
    return;
  }

  const selectedIds = resolveGenerationCodeIds();
  const selectedCount = selectedIds.length;
  const total = sorted.length;
  const usingPreferred = parseCodeIdList(state.preferredCodeIds).length > 0;

  if (selectedCount >= total) {
    hintEl.textContent = `Generate note will include all ${total} budget code(s).`;
    return;
  }

  if (usingPreferred) {
    hintEl.textContent = `Generate note will include your preferred ${selectedCount} code(s) from ${total}. Add more later from "Add More Code / Khat".`;
    return;
  }

  hintEl.textContent = `Generate note will include first ${selectedCount} sequential code(s) from ${total}. Add more later from "Add More Code / Khat".`;
}

function updatePreferredButtonsState() {
  const saveBtn = byId("impSavePreferredBtn");
  const clearBtn = byId("impClearPreferredBtn");
  const selectedCount = getCurrentNoteCodeIdSet().size;
  const preferredCount = parseCodeIdList(state.preferredCodeIds).length;

  if (saveBtn) {
    saveBtn.disabled = selectedCount === 0;
  }
  if (clearBtn) {
    clearBtn.disabled = preferredCount === 0;
  }
}

function getAddableCodesBySearch(query = "") {
  const text = String(query || "").trim().toLowerCase();
  const selected = getCurrentNoteCodeIdSet();

  return getSortedAvailableCodeMetas()
    .filter((row) => row.id && !selected.has(row.id))
    .filter((row) => {
      if (!text) return true;
      return row.code.toLowerCase().includes(text) || row.khat.toLowerCase().includes(text);
    });
}

function renderAddCodeList() {
  const list = byId("impAddCodeList");
  if (!list) return;

  const note = state.note;
  if (!note || !note.can_edit_items) {
    list.innerHTML = '<div class="imp-code-search-empty">Generate/open a draft note to add or remove code.</div>';
    return;
  }

  if (!state.availableCodes.length) {
    list.innerHTML = '<div class="imp-code-search-empty">No budget code found for selected base and fiscal year.</div>';
    return;
  }

  const query = String(byId("impAddCodeSearch")?.value || "");
  const rows = getAddableCodesBySearch(query).slice(0, 20);

  if (!rows.length) {
    const text = String(query || "").trim()
      ? "No matching code found."
      : "All codes are already selected.";
    list.innerHTML = `<div class="imp-code-search-empty">${escapeHtml(text)}</div>`;
    return;
  }

  list.innerHTML = rows
    .map(
      (row) => `
      <button type="button" class="imp-code-search-item" data-add-code-id="${row.id}">
        <span class="meta">
          <span class="line1">${escapeHtml(row.code)} - ${escapeHtml(row.khat)}</span>
          <span class="line2">Budget: ${formatMoneyTrim(row.budget)}</span>
        </span>
        <span class="act">Add</span>
      </button>
    `
    )
    .join("");
}

function addCodeToNote(codeId) {
  const note = state.note;
  if (!note || !note.can_edit_items) return false;

  const id = toPositiveInt(codeId);
  if (!id) return false;

  const existing = getCurrentNoteCodeIdSet();
  if (existing.has(id)) return false;

  const budgetRow = getBudgetRowByCodeId(id);
  if (!budgetRow) return false;

  const codeMeta = toCodeMeta(budgetRow);
  const item = {
    id: null,
    note_id: toPositiveInt(note.id) || null,
    financial_code_id: id,
    khat_name: codeMeta.khat,
    financial_code: {
      id,
      code: codeMeta.code,
      khat_name_bn: codeMeta.khat,
    },
    budget_amount: Number(codeMeta.budget.toFixed(2)),
    previous_expense: 0,
    current_claim: 0,
    approved_amount: 0,
    issued_amount: 0,
    adjustment_amount: 0,
    remaining_balance: Number(codeMeta.budget.toFixed(2)),
    remarks: null,
  };

  note.items = [...(Array.isArray(note.items) ? note.items : []), item];
  renderRows(note);
  recalcTotalsAndPaint();
  renderAddCodeList();
  updatePreferredButtonsState();
  return true;
}

function removeCodeFromNote(codeId) {
  const note = state.note;
  if (!note || !note.can_edit_items) return false;

  const id = toPositiveInt(codeId);
  if (!id) return false;

  const rows = Array.isArray(note.items) ? note.items : [];
  if (rows.length <= 1) {
    showToast("At least one code row is required", "warn");
    return false;
  }

  const next = rows.filter((row) => toPositiveInt(row?.financial_code_id) !== id);
  if (next.length === rows.length) return false;
  note.items = next;
  renderRows(note);
  recalcTotalsAndPaint();
  renderAddCodeList();
  updatePreferredButtonsState();
  return true;
}

function addCodeFromSearch() {
  const query = String(byId("impAddCodeSearch")?.value || "");
  const first = getAddableCodesBySearch(query)[0];
  if (!first) {
    showToast("No matching code found to add", "warn");
    return;
  }

  if (addCodeToNote(first.id)) {
    showToast("Code added to note", "success");
  }
}

function saveCurrentCodesAsPreferred() {
  const selectedIds = sortNoteItemsByCode(Array.isArray(state.note?.items) ? state.note.items : [])
    .map((row) => toPositiveInt(row?.financial_code_id))
    .filter((id) => id);

  if (!selectedIds.length) {
    showToast("No code found to save as preferred", "warn");
    return;
  }

  const availableIds = new Set(getSortedAvailableCodeMetas().map((row) => row.id));
  const scoped = parseCodeIdList(selectedIds)
    .filter((id) => availableIds.has(id))
    .slice(0, DEFAULT_GENERATE_CODE_LIMIT);

  if (!scoped.length) {
    showToast("No valid budget code found to save", "warn");
    return;
  }

  savePreferredCodesForCurrentScope(scoped);
  state.preferredCodeIds = scoped;
  updateGenerateCodeHint();
  updatePreferredButtonsState();
  showToast(`Saved ${scoped.length} preferred code(s)`, "success");
}

function clearPreferredCodes() {
  savePreferredCodesForCurrentScope([]);
  state.preferredCodeIds = [];
  updateGenerateCodeHint();
  updatePreferredButtonsState();
  showToast("Preferred code list cleared for this base/fiscal year", "success");
}

async function loadBudgetCodes() {
  const baseId = toPositiveInt(byId("impBase")?.value);
  const fiscalYearId = toPositiveInt(byId("impFiscalYear")?.value);

  state.availableCodes = [];
  state.preferredCodeIds = [];
  if (!baseId || !fiscalYearId) {
    updateGenerateCodeHint();
    renderAddCodeList();
    updatePreferredButtonsState();
    return;
  }

  const params = new URLSearchParams({
    base_id: String(baseId),
    fiscal_year_id: String(fiscalYearId),
  });
  const out = await imprestFetch(`/budgets?${params.toString()}`);
  state.availableCodes = Array.isArray(out.data)
    ? [...out.data].sort((a, b) => compareCodeMeta(toCodeMeta(a), toCodeMeta(b)))
    : [];
  state.preferredCodeIds = readPreferredCodesForCurrentScope();
  updateGenerateCodeHint();
  renderAddCodeList();
  updatePreferredButtonsState();
}

function setMeta(note) {
  const grid = byId("impMetaGrid");
  if (!grid) return;

  const rows = [
    ["Note No", note.note_no || "-"],
    ["Base", note.base?.base_name || "-"],
    ["Fiscal Year", note.fiscal_year?.name || "-"],
    ["Demand Type", String(note.demand_type || "REGULAR").toUpperCase() === "COMPLEMENTARY" ? "Complementary" : "Regular"],
    [
      "Period",
      `${note.month_name || "-"} (${
        String(note.demand_type || "REGULAR").toUpperCase() === "COMPLEMENTARY"
          ? "Complementary"
          : getPakkhikLabel(note.pakkhik)
      })`,
    ],
    ["Start Date", note.period_start || "-"],
    ["End Date", note.period_end || "-"],
    ["Submitted By", note.submitted_by_name || "-"],
    ["Approved By", note.approved_by_name || "-"],
  ];

  grid.innerHTML = rows
    .map(
      ([k, v]) => `
      <article class="imp-meta-item">
        <div class="k">${escapeHtml(k)}</div>
        <div class="v">${escapeHtml(v)}</div>
      </article>
    `
    )
    .join("");
}

function calcRowRemaining(item) {
  return Number((toNumber(item.budget_amount) - toNumber(item.previous_expense) - toNumber(item.current_claim)).toFixed(2));
}

function recalcTotalsAndPaint() {
  const note = state.note;
  if (!note) return;

  let totalBudget = 0;
  let totalPrevious = 0;
  let totalClaim = 0;
  let totalRemaining = 0;

  (note.items || []).forEach((item) => {
    const remaining = calcRowRemaining(item);
    item.remaining_balance = remaining;

    totalBudget += toNumber(item.budget_amount);
    totalPrevious += toNumber(item.previous_expense);
    totalClaim += toNumber(item.current_claim);
    totalRemaining += remaining;

    const codeId = toPositiveInt(item.financial_code_id);
    const row = byId(`imp-row-code-${codeId}`);
    if (!row) return;
    const remEl = row.querySelector(".imp-row-remaining");
    if (remEl) remEl.textContent = formatMoneyTrim(remaining);
  });

  note.total_budget = Number(totalBudget.toFixed(2));
  note.total_previous_expense = Number(totalPrevious.toFixed(2));
  note.total_current_claim = Number(totalClaim.toFixed(2));
  note.total_remaining = Number(totalRemaining.toFixed(2));

  byId("impTotalBudget").textContent = formatMoneyTrim(note.total_budget);
  byId("impTotalPrevious").textContent = formatMoneyTrim(note.total_previous_expense);
  byId("impTotalClaim").textContent = formatMoneyTrim(note.total_current_claim);
  byId("impTotalRemaining").textContent = formatMoneyTrim(note.total_remaining);
}

function renderRows(note) {
  const tbody = byId("impItemRows");
  if (!tbody) return;

  const editable = Boolean(note.can_edit_items);
  const sortedItems = sortNoteItemsByCode(Array.isArray(note.items) ? note.items : []);
  note.items = sortedItems;

  if (!sortedItems.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="imp-empty">No item row found</td></tr>';
    return;
  }

  tbody.innerHTML = sortedItems
    .map((item, idx) => {
      const claim = String(toNumber(item.current_claim));
      const codeId = toPositiveInt(item.financial_code_id);
      return `
      <tr id="imp-row-code-${codeId}">
        <td>${idx + 1}</td>
        <td>${escapeHtml(item.khat_name || item.financial_code?.khat_name_bn || "-")}</td>
        <td>${escapeHtml(item.financial_code?.code || "-")}</td>
        <td class="imp-right">${formatMoneyTrim(item.budget_amount)}</td>
        <td class="imp-right">${formatMoneyTrim(item.previous_expense)}</td>
        <td class="imp-right">
          <input
            class="imp-input imp-row-claim"
            data-financial-code-id="${codeId}"
            type="number"
            min="0"
            step="0.01"
            value="${claim}"
            ${editable ? "" : "disabled"}
          />
        </td>
        <td class="imp-right imp-row-remaining">${formatMoneyTrim(item.remaining_balance)}</td>
        <td>
          ${
            editable
              ? `<button class="imp-mini-btn danger" data-remove-code-id="${codeId}" type="button">X</button>`
              : "-"
          }
        </td>
      </tr>
    `;
    })
    .join("");
}

function renderNote(note) {
  state.note = note;

  byId("impNoteBlock").style.display = "block";
  byId("impRemarks").value = note.remarks || "";

  const badge = byId("impStatusBadge");
  if (badge) {
    badge.className = `imp-status ${statusBadgeClass(note.status)}`;
    badge.textContent = note.status || "-";
  }

  setMeta(note);
  renderRows(note);
  recalcTotalsAndPaint();
  renderAddCodeList();
  updateGenerateCodeHint();
  updatePreferredButtonsState();

  byId("impSaveBtn").disabled = !note.can_edit_items;
  byId("impSubmitBtn").disabled = !note.can_submit;
  if (byId("impAddCodeSearch")) byId("impAddCodeSearch").disabled = !note.can_edit_items;
  if (byId("impAddCodeBtn")) byId("impAddCodeBtn").disabled = !note.can_edit_items;
}

async function loadMasters() {
  const [basesRes, fyRes] = await Promise.all([imprestFetch("/bases"), imprestFetch("/fiscal-years")]);

  state.bases = basesRes.data || [];
  state.fiscalYears = fyRes.data || [];

  setBaseOptions();
  setFiscalYearOptions();
}

function readGeneratePayload() {
  const baseId = toPositiveInt(byId("impBase")?.value);
  const fiscalYearId = toPositiveInt(byId("impFiscalYear")?.value);
  const month = toPositiveInt(byId("impMonth")?.value);
  const demandType = String(byId("impDemandType")?.value || "REGULAR")
    .trim()
    .toUpperCase();
  const pakkhik = demandType === "COMPLEMENTARY" ? "NONE" : String(byId("impPakkhik")?.value || "").trim();
  const remarks = String(byId("impRemarks")?.value || "").trim();

  if (!baseId || !fiscalYearId || !month || !demandType || !pakkhik) {
    throw new Error("Base, fiscal year, month, demand type and pakkhik are required");
  }

  const payload = {
    base_id: baseId,
    fiscal_year_id: fiscalYearId,
    month,
    demand_type: demandType,
    pakkhik,
    remarks: remarks || null,
  };

  if (!state.availableCodes.length) {
    throw new Error("No budget allocation found for selected base and fiscal year");
  }

  const generationCodeIds = resolveGenerationCodeIds();
  if (!generationCodeIds.length) {
    throw new Error("No eligible budget code found for note generation");
  }
  payload.financial_code_ids = generationCodeIds;

  if (demandType === "COMPLEMENTARY") {
    const periodStart = String(byId("impPeriodStart")?.value || "").trim();
    const periodEnd = String(byId("impPeriodEnd")?.value || "").trim();
    if (!periodStart || !periodEnd) {
      throw new Error("Complementary note requires period start and period end");
    }
    payload.period_start = periodStart;
    payload.period_end = periodEnd;
  }

  return payload;
}

async function generateNote() {
  const button = byId("impGenerateBtn");
  const release = setButtonBusy(button, true, "Generating...");
  try {
    const payload = readGeneratePayload();
    const out = await imprestFetch("/notes/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    renderNote(out.data);
    showToast(out.message || "Note ready", "success");

    if (out?.data?.id) {
      const url = new URL(window.location.href);
      url.searchParams.set("id", String(out.data.id));
      window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`);
    }
  } catch (err) {
    showToast(err.message || "Failed to generate note", "error");
  } finally {
    release();
  }
}

function collectEditableItems() {
  const note = state.note;
  const rows = Array.isArray(note?.items) ? note.items : [];

  return rows
    .map((item) => {
      const codeId = toPositiveInt(item.financial_code_id);
      const payload = {
        financial_code_id: codeId,
        current_claim: Number(toNumber(item.current_claim).toFixed(2)),
      };
      const rowId = toPositiveInt(item.id);
      if (rowId) payload.id = rowId;
      return payload;
    })
    .filter((row) => row.financial_code_id > 0);
}

async function saveDraft() {
  const note = state.note;
  if (!note?.id) return;

  const button = byId("impSaveBtn");
  const release = setButtonBusy(button, true, "Saving...");
  try {
    const out = await imprestFetch(`/notes/${Number(note.id)}/items`, {
      method: "PUT",
      body: JSON.stringify({
        items: collectEditableItems(),
        replace_items: true,
        remarks: String(byId("impRemarks")?.value || "").trim() || null,
      }),
    });

    renderNote(out.data);
    showToast(out.message || "Draft saved", "success");
  } catch (err) {
    showToast(err.message || "Failed to save draft", "error");
  } finally {
    release();
  }
}

async function submitNote() {
  const note = state.note;
  if (!note?.id) return;

  const button = byId("impSubmitBtn");
  const release = setButtonBusy(button, true, "Submitting...");
  try {
    await imprestFetch(`/notes/${Number(note.id)}/items`, {
      method: "PUT",
      body: JSON.stringify({
        items: collectEditableItems(),
        replace_items: true,
        remarks: String(byId("impRemarks")?.value || "").trim() || null,
      }),
    });

    const out = await imprestFetch(`/notes/${Number(note.id)}/submit`, {
      method: "POST",
      body: JSON.stringify({
        remarks: String(byId("impRemarks")?.value || "").trim() || null,
      }),
    });

    renderNote(out.data);
    showToast(out.message || "Submitted", "success");
  } catch (err) {
    showToast(err.message || "Failed to submit", "error");
  } finally {
    release();
  }
}

function buildPrintHtml(payload) {
  const note = payload?.data || state.note;
  const meta = payload?.print_meta || {};
  if (!note) return "";

  const totalClaim = toNumber(note.total_current_claim);
  const amountWords = amountInBanglaWords(totalClaim);
  const rowsHtml = sortNoteItemsByCode(note.items || [])
    .map((item, idx) => {
      return `
        <tr>
          <td>${toBanglaDigits(idx + 1)}</td>
          <td>${escapeHtml(item.khat_name || item.financial_code?.khat_name_bn || "-")}</td>
          <td>${escapeHtml(item.financial_code?.code || "-")}</td>
          <td style="text-align:right;">${formatMoneyBnTrim(item.budget_amount)}</td>
          <td style="text-align:right;">${formatMoneyBnTrim(item.previous_expense)}</td>
          <td style="text-align:right;">${formatMoneyBnTrim(item.current_claim)}</td>
          <td style="text-align:right;">${formatMoneyBnTrim(item.remaining_balance)}</td>
        </tr>
      `;
    })
    .join("");

  const monthBn = getMonthNameBn(note.month);
  const yearBn = toBanglaDigits(String(note.period_start || "").slice(0, 4));
  const pakkhikShort = getPakkhikShort(note.pakkhik);
  const noteRemarks = String(note.remarks || "").trim();
  const paragraphText = `\u0989\u09aa\u09b0\u09cd\u09af\u09c1\u0995\u09cd\u09a4 \u09ac\u09bf\u09b7\u09af\u09bc\u09c7 ${note.period_start || "-"} \u09b9\u09a4\u09c7 ${note.period_end || "-"} \u09aa\u09b0\u09cd\u09af\u09a8\u09cd\u09a4 \u09b8\u09ae\u09af\u09bc\u09c7\u09b0 \u09ac\u09cd\u09af\u09af\u09bc \u09a8\u09bf\u09b0\u09cd\u09ac\u09be\u09b9\u09c7\u09b0 \u09a8\u09bf\u09ae\u09bf\u09a4\u09cd\u09a4\u09c7 = ${formatMoneyBnTrim(
    totalClaim
  )}/- (${amountWords}) \u099f\u09be\u0995\u09be\u09b0 \u0986\u09b0\u09cd\u09a5\u09bf\u0995 \u09a6\u09be\u09ac\u09c0 \u09aa\u09be\u0993\u09af\u09bc\u09be \u0997\u09c7\u099b\u09c7\u0964`;
  const footerText = `\u098f\u09a4\u09a6\u09cd\u09ac\u09bf\u09b7\u09af\u09bc\u09c7, \u09b8\u0982\u09b6\u09cd\u09b2\u09bf\u09b7\u09cd\u099f \u0998\u09be\u0981\u099f\u09bf \u0995\u09b0\u09cd\u09a4\u09c3\u0995 \u09a6\u09be\u09ac\u09c0\u0995\u09c3\u09a4 = ${formatMoneyBnTrim(
    totalClaim
  )}/- (${amountWords}) \u099f\u09be\u0995\u09be \u0985\u0997\u09cd\u09b0\u09bf\u09ae \u09aa\u09cd\u09b0\u09a6\u09be\u09a8 \u0995\u09b0\u09be \u09af\u09c7\u09a4\u09c7 \u09aa\u09be\u09b0\u09c7\u0964 \u09ae\u09b9\u09cb\u09a6\u09af\u09bc\u09c7\u09b0 \u09b8\u09a6\u09af\u09bc \u0985\u09a8\u09c1\u09ae\u09cb\u09a6\u09a8\u09c7\u09b0 \u099c\u09a8\u09cd\u09af \u09a8\u09a5\u09bf \u0989\u09aa\u09b8\u09cd\u09a5\u09be\u09aa\u09a8 \u0995\u09b0\u09be \u09b9\u09b2\u09cb\u0964`;

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @font-face {
            font-family: "SiyamRupaliBN";
            src: url("/fonts/Siyamrupali.ttf") format("truetype");
          }
          @page { size: A4; margin: 12mm; }
          body { font-family: "SiyamRupaliBN", Arial, sans-serif; color: #000; margin: 0; font-size: 15px; }
          .sheet { width: 100%; }
          .title-line { font-size: 16px; margin-bottom: 8px; }
          .subject { font-size: 16px; margin: 6px 0 10px; }
          p { margin: 0 0 10px; line-height: 1.55; text-align: justify; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0 10px; }
          th, td { border: 1px solid #000; padding: 6px 7px; font-size: 14px; vertical-align: top; }
          th { text-align: center; }
          tfoot td { font-weight: 700; }
          .footer { margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="title-line">${escapeHtml(meta.header_line || "\u0985\u09ab\u09bf\u09b8 \u09a8\u09cb\u099f/\u09aa\u09c3\u09b7\u09cd\u09a0\u09be/\u09e6\u09e8")}</div>
          <div class="subject"><strong>\u09ac\u09bf\u09b7\u09df:</strong> ${escapeHtml(
            meta.subject ||
              `${note.base?.base_name || "-"} \u098f\u09b0 ${monthBn}/${yearBn} \u09ae\u09be\u09b8\u09c7\u09b0 \u0986\u09b0\u09cd\u09a5\u09bf\u0995 \u09a6\u09be\u09ac\u09c0 (${pakkhikShort} \u09aa\u09be\u0995\u09cd\u09b7\u09bf\u0995)\u0964`
          )}</div>

          <p>${escapeHtml(paragraphText)}</p>
          ${noteRemarks ? `<p><strong>Remarks:</strong> ${escapeHtml(noteRemarks)}</p>` : ""}

          <table>
            <thead>
              <tr>
                <th style="width:56px;">\u0995\u09cd\u09b0\u09ae\u09bf\u0995</th>
                <th>\u0996\u09be\u09a4</th>
                <th style="width:120px;">\u0985\u09b0\u09cd\u09a5\u09a8\u09c8\u09a4\u09bf\u0995 \u0995\u09cb\u09a1</th>
                <th style="width:110px;">\u09ac\u09b0\u09be\u09a6\u09cd\u09a6</th>
                <th style="width:110px;">\u09aa\u09c2\u09b0\u09cd\u09ac\u09c7\u09b0 \u09ac\u09cd\u09af\u09df</th>
                <th style="width:150px;">\u09ac\u09b0\u09cd\u09a4\u09ae\u09be\u09a8 \u0986\u09b0\u09cd\u09a5\u09bf\u0995 \u09a6\u09be\u09ac\u09c0\u09b0 \u09aa\u09b0\u09bf\u09ae\u09be\u09a3</th>
                <th style="width:110px;">\u0985\u09ac\u09b6\u09bf\u09b7\u09cd\u099f</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="text-align:center;">\u09ae\u09cb\u099f</td>
                <td style="text-align:right;">${formatMoneyBnTrim(note.total_budget)}</td>
                <td style="text-align:right;">${formatMoneyBnTrim(note.total_previous_expense)}</td>
                <td style="text-align:right;">${formatMoneyBnTrim(note.total_current_claim)}</td>
                <td style="text-align:right;">${formatMoneyBnTrim(note.total_remaining)}</td>
              </tr>
            </tfoot>
          </table>

          <p class="footer">${escapeHtml(footerText)}</p>
        </div>
      </body>
    </html>
  `;
}

async function printNote() {
  const noteId = toPositiveInt(state.note?.id);
  if (!noteId) {
    showToast("Generate note first", "warn");
    return;
  }

  try {
    const out = await imprestFetch(`/notes/${noteId}/print`);
    const html = buildPrintHtml(out);
    iframePrint(html);
  } catch (err) {
    showToast(err.message || "Failed to load print preview", "error");
  }
}

async function loadByIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const noteId = toPositiveInt(params.get("id"));
  if (!noteId) return;

  try {
    const out = await imprestFetch(`/notes/${noteId}`);
    renderNote(out.data);

    if (out.data?.base_id) byId("impBase").value = String(out.data.base_id);
    if (out.data?.fiscal_year_id) byId("impFiscalYear").value = String(out.data.fiscal_year_id);
    if (out.data?.month) byId("impMonth").value = String(out.data.month);
    if (out.data?.demand_type) byId("impDemandType").value = String(out.data.demand_type);
    if (out.data?.pakkhik) byId("impPakkhik").value = String(out.data.pakkhik);
    if (out.data?.period_start) byId("impPeriodStart").value = String(out.data.period_start);
    if (out.data?.period_end) byId("impPeriodEnd").value = String(out.data.period_end);

    setDemandTypeVisibility();
    await loadBudgetCodes();
  } catch (err) {
    showToast(err.message || "Failed to load note", "error");
  }
}

function bindEvents() {
  byId("impGenerateBtn")?.addEventListener("click", generateNote);
  byId("impSaveBtn")?.addEventListener("click", saveDraft);
  byId("impSubmitBtn")?.addEventListener("click", submitNote);
  byId("impPrintBtn")?.addEventListener("click", printNote);

  byId("impBase")?.addEventListener("change", () => {
    loadBudgetCodes().catch((err) => showToast(err.message || "Failed to load codes", "error"));
  });
  byId("impFiscalYear")?.addEventListener("change", () => {
    loadBudgetCodes().catch((err) => showToast(err.message || "Failed to load codes", "error"));
  });
  byId("impDemandType")?.addEventListener("change", setDemandTypeVisibility);
  byId("impAddCodeSearch")?.addEventListener("input", renderAddCodeList);
  byId("impAddCodeSearch")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    addCodeFromSearch();
  });
  byId("impAddCodeBtn")?.addEventListener("click", addCodeFromSearch);
  byId("impSavePreferredBtn")?.addEventListener("click", saveCurrentCodesAsPreferred);
  byId("impClearPreferredBtn")?.addEventListener("click", clearPreferredCodes);

  byId("impAddCodeList")?.addEventListener("click", (e) => {
    const button = e.target.closest("[data-add-code-id]");
    if (!button) return;
    if (addCodeToNote(button.getAttribute("data-add-code-id"))) {
      showToast("Code added to note", "success");
    }
  });

  byId("impItemRows")?.addEventListener("click", (e) => {
    const button = e.target.closest("[data-remove-code-id]");
    if (!button || !state.note?.can_edit_items) return;
    if (removeCodeFromNote(button.getAttribute("data-remove-code-id"))) {
      showToast("Code row removed", "success");
    }
  });

  byId("impItemRows")?.addEventListener("input", (e) => {
    const input = e.target.closest(".imp-row-claim");
    if (!input || !state.note) return;

    const codeId = toPositiveInt(input.getAttribute("data-financial-code-id"));
    if (!codeId) return;

    const item = (state.note.items || []).find((x) => toPositiveInt(x.financial_code_id) === codeId);
    if (!item) return;

    const claim = Number(input.value || 0);
    item.current_claim = Number.isFinite(claim) && claim >= 0 ? Number(claim.toFixed(2)) : 0;
    recalcTotalsAndPaint();
  });
}

async function init() {
  setFixedSelectors();
  setDemandTypeVisibility();
  bindEvents();
  await loadMasters();
  await loadBudgetCodes();
  await loadByIdFromQuery();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    showToast(err.message || "Failed to initialize imprest note page", "error");
  });
});
