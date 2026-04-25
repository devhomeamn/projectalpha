import {
  byId,
  ensureArray,
  escapeHtml,
  formatMoney,
  imprestFetch,
  setButtonBusy,
  showToast,
  toNumber,
  toPositiveInt,
} from "./imprest-common.js";

const state = {
  bases: [],
  fiscalYears: [],
  codes: [],
  durations: [],
  selectedDurationKey: "",
  draftRows: [],
  savedRows: [],
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

function getSelectedBaseId() {
  return toPositiveInt(byId("adjBase")?.value);
}

function getSelectedFiscalYearId() {
  return toPositiveInt(byId("adjFiscalYear")?.value);
}

function getSelectedDuration() {
  return state.durations.find((row) => row.duration_key === state.selectedDurationKey) || null;
}

function setMasterOptions() {
  byId("adjBase").innerHTML = optionsHtml(state.bases, (r) => `${r.base_name} (${r.base_code})`);
  byId("adjFiscalYear").innerHTML = optionsHtml(state.fiscalYears, (r) => r.name);
}

function setDurationKpis(duration, savedRows = []) {
  const issuedTotal = toNumber(duration?.issued_total);
  const adjustedTotal = toNumber(duration?.adjusted_total);
  const pendingTotal = toNumber(duration?.pending_total);

  byId("adjIssuedTotal").textContent = formatMoney(issuedTotal);
  byId("adjAdjustedTotal").textContent = formatMoney(adjustedTotal);
  byId("adjPendingTotal").textContent = formatMoney(pendingTotal);
  byId("adjSavedCount").textContent = String(savedRows.length || 0);
}

function renderDurationRows() {
  const tbody = byId("adjDurationRows");
  if (!tbody) return;

  if (!state.durations.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="imp-empty">No duration data found</td></tr>';
    return;
  }

  tbody.innerHTML = state.durations
    .map((row, idx) => {
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(row.duration_label || "-")}</td>
          <td>${escapeHtml(row.duration_start || "-")} to ${escapeHtml(row.duration_end || "-")}</td>
          <td class="imp-right">${formatMoney(row.issued_total)}</td>
          <td class="imp-right">${formatMoney(row.adjusted_total)}</td>
          <td class="imp-right">${formatMoney(row.pending_total)}</td>
          <td>
            <button class="imp-mini-btn primary" data-action="select-duration" data-key="${escapeHtml(
              row.duration_key
            )}" type="button">
              Select
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function findCodeById(codeId) {
  const id = Number(codeId);
  if (!id) return null;
  return state.codes.find((row) => Number(row.id) === id) || null;
}

function renderIssuedRows(duration) {
  const tbody = byId("adjIssuedRows");
  if (!tbody) return;

  const rows = ensureArray(duration?.issued_rows);
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="imp-empty">No issued code in this duration</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map((row, idx) => {
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(row.khat_name_bn || row.khat_name_en || "-")}</td>
          <td>${escapeHtml(row.code || "-")}</td>
          <td class="imp-right">${formatMoney(row.issued_amount)}</td>
          <td class="imp-right">${formatMoney(row.adjusted_amount)}</td>
          <td class="imp-right">${formatMoney(row.pending_amount)}</td>
        </tr>
      `;
    })
    .join("");
}

function codeOptionsHtml(value, { allowBlank = false, blankLabel = "Select" } = {}) {
  const rows = state.codes || [];
  const safeValue = toPositiveInt(value);
  const opts = [];
  if (allowBlank) {
    const selectedAttr = safeValue ? "" : "selected";
    opts.push(`<option value="" ${selectedAttr}>${escapeHtml(blankLabel)}</option>`);
  }

  rows.forEach((row) => {
    const id = Number(row.id);
    const selectedAttr = safeValue === id ? "selected" : "";
    const label = `${row.code} - ${row.khat_name_bn || row.khat_name_en || "-"}`;
    opts.push(`<option value="${id}" ${selectedAttr}>${escapeHtml(label)}</option>`);
  });

  return opts.join("");
}

function ensureDraftRows() {
  if (state.draftRows.length) return;
  state.draftRows = [
    {
      source_financial_code_id: "",
      target_financial_code_id: "",
      adjusted_amount: "",
      remarks: "",
    },
  ];
}

function renderDraftRows() {
  const tbody = byId("adjEntryRows");
  if (!tbody) return;

  ensureDraftRows();

  tbody.innerHTML = state.draftRows
    .map((row, idx) => {
      return `
        <tr data-index="${idx}">
          <td>${idx + 1}</td>
          <td>
            <select class="imp-select adj-source-code">
              ${codeOptionsHtml(row.source_financial_code_id, {
                allowBlank: true,
                blankLabel: "Pooled / Manual",
              })}
            </select>
          </td>
          <td>
            <select class="imp-select adj-target-code">
              ${codeOptionsHtml(row.target_financial_code_id, {
                allowBlank: true,
                blankLabel: "Select target code",
              })}
            </select>
          </td>
          <td>
            <input class="imp-input adj-amount" type="number" min="0" step="0.01" value="${escapeHtml(
              row.adjusted_amount || ""
            )}" />
          </td>
          <td>
            <input class="imp-input adj-remarks" value="${escapeHtml(row.remarks || "")}" />
          </td>
          <td>
            <button class="imp-mini-btn danger" data-action="remove-entry-row" data-index="${idx}" type="button">X</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderSavedRows() {
  const tbody = byId("adjSavedRows");
  if (!tbody) return;

  if (!state.savedRows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="imp-empty">No saved adjustment entry found</td></tr>';
    return;
  }

  tbody.innerHTML = state.savedRows
    .map((row, idx) => {
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(row.adjustment_date || "-")}</td>
          <td>${escapeHtml(row.voucher_no || "-")}</td>
          <td>${escapeHtml(row.duration_label || "-")}</td>
          <td>${escapeHtml(row.source_financial_code?.code || "-")}</td>
          <td>${escapeHtml(row.target_financial_code?.code || "-")}</td>
          <td class="imp-right">${formatMoney(row.adjusted_amount)}</td>
          <td>${escapeHtml(row.remarks || "-")}</td>
        </tr>
      `;
    })
    .join("");
}

function hydrateFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const baseId = toPositiveInt(params.get("base_id"));
  const fiscalYearId = toPositiveInt(params.get("fiscal_year_id"));

  if (baseId && state.bases.some((row) => Number(row.id) === baseId)) {
    byId("adjBase").value = String(baseId);
  }
  if (fiscalYearId && state.fiscalYears.some((row) => Number(row.id) === fiscalYearId)) {
    byId("adjFiscalYear").value = String(fiscalYearId);
  }
}

async function loadMasters() {
  const [basesOut, fyOut, codeOut] = await Promise.all([
    imprestFetch("/bases"),
    imprestFetch("/fiscal-years"),
    imprestFetch("/financial-codes"),
  ]);
  state.bases = ensureArray(basesOut.data);
  state.fiscalYears = ensureArray(fyOut.data);
  state.codes = ensureArray(codeOut.data);
  setMasterOptions();
  hydrateFromQuery();
}

async function loadDurations() {
  const baseId = getSelectedBaseId();
  const fiscalYearId = getSelectedFiscalYearId();
  if (!baseId || !fiscalYearId) {
    throw new Error("Select base and fiscal year first");
  }

  const params = new URLSearchParams({
    base_id: String(baseId),
    fiscal_year_id: String(fiscalYearId),
  });
  const out = await imprestFetch(`/adjustments/durations?${params.toString()}`);
  state.durations = ensureArray(out.data);
  renderDurationRows();

  if (state.selectedDurationKey) {
    const exists = state.durations.some((x) => x.duration_key === state.selectedDurationKey);
    if (!exists) {
      state.selectedDurationKey = "";
      byId("adjDetailCard").style.display = "none";
    } else {
      await selectDuration(state.selectedDurationKey);
    }
  }
}

async function loadSavedEntries() {
  const baseId = getSelectedBaseId();
  const fiscalYearId = getSelectedFiscalYearId();
  const duration = getSelectedDuration();
  if (!baseId || !fiscalYearId || !duration) {
    state.savedRows = [];
    renderSavedRows();
    return;
  }

  const params = new URLSearchParams({
    base_id: String(baseId),
    fiscal_year_id: String(fiscalYearId),
    duration_key: duration.duration_key,
  });
  const out = await imprestFetch(`/adjustments/entries?${params.toString()}`);
  state.savedRows = ensureArray(out.data);
  renderSavedRows();
  setDurationKpis(duration, state.savedRows);
}

async function selectDuration(durationKey) {
  const duration = state.durations.find((row) => row.duration_key === durationKey);
  if (!duration) {
    showToast("Duration not found", "warn");
    return;
  }

  state.selectedDurationKey = duration.duration_key;
  byId("adjDetailCard").style.display = "block";
  byId("adjSelectedLabel").textContent = `${duration.duration_label} (${duration.duration_start} to ${duration.duration_end})`;

  setDurationKpis(duration, []);
  renderIssuedRows(duration);
  state.draftRows = [];
  renderDraftRows();
  await loadSavedEntries();
}

function readDraftRowsFromUi() {
  const rows = [];
  const tbodyRows = Array.from(byId("adjEntryRows")?.querySelectorAll("tr") || []);
  tbodyRows.forEach((tr) => {
    const sourceCodeId = toPositiveInt(tr.querySelector(".adj-source-code")?.value);
    const targetCodeId = toPositiveInt(tr.querySelector(".adj-target-code")?.value);
    const amount = toNumber(tr.querySelector(".adj-amount")?.value);
    const remarks = String(tr.querySelector(".adj-remarks")?.value || "").trim();

    if ((!sourceCodeId && !targetCodeId) || amount <= 0) return;
    rows.push({
      source_financial_code_id: sourceCodeId || null,
      target_financial_code_id: targetCodeId || null,
      adjusted_amount: Number(amount.toFixed(2)),
      remarks: remarks || null,
    });
  });
  return rows;
}

async function saveAdjustments() {
  const baseId = getSelectedBaseId();
  const fiscalYearId = getSelectedFiscalYearId();
  const duration = getSelectedDuration();

  if (!baseId || !fiscalYearId || !duration) {
    showToast("Select base/fiscal year/duration first", "warn");
    return;
  }

  const entries = readDraftRowsFromUi();
  if (!entries.length) {
    showToast("Add at least one valid adjustment row", "warn");
    return;
  }

  const payload = {
    base_id: baseId,
    fiscal_year_id: fiscalYearId,
    duration_key: duration.duration_key,
    adjustment_date: byId("adjEntryDate")?.value || null,
    voucher_no: String(byId("adjEntryVoucher")?.value || "").trim() || null,
    remarks: String(byId("adjEntryRemarks")?.value || "").trim() || null,
    entries,
  };

  const button = byId("adjSaveBtn");
  const release = setButtonBusy(button, true, "Saving...");
  try {
    await imprestFetch("/adjustments/entries", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    showToast("Adjustment saved", "success");
    await loadDurations();
    await selectDuration(duration.duration_key);
  } catch (err) {
    showToast(err.message || "Failed to save adjustment", "error");
  } finally {
    release();
  }
}

function bindEvents() {
  byId("adjLoadBtn")?.addEventListener("click", () => {
    loadDurations().catch((err) => showToast(err.message || "Failed to load durations", "error"));
  });

  byId("adjAddRowBtn")?.addEventListener("click", () => {
    state.draftRows.push({
      source_financial_code_id: "",
      target_financial_code_id: "",
      adjusted_amount: "",
      remarks: "",
    });
    renderDraftRows();
  });

  byId("adjSaveBtn")?.addEventListener("click", saveAdjustments);

  byId("adjDurationRows")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='select-duration']");
    if (!btn) return;
    const key = String(btn.getAttribute("data-key") || "");
    if (!key) return;
    selectDuration(key).catch((err) => showToast(err.message || "Failed to open duration", "error"));
  });

  byId("adjEntryRows")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='remove-entry-row']");
    if (!btn) return;
    const index = Number(btn.getAttribute("data-index"));
    if (!Number.isFinite(index) || index < 0 || index >= state.draftRows.length) return;

    state.draftRows.splice(index, 1);
    if (!state.draftRows.length) {
      state.draftRows.push({
        source_financial_code_id: "",
        target_financial_code_id: "",
        adjusted_amount: "",
        remarks: "",
      });
    }
    renderDraftRows();
  });
}

async function init() {
  byId("adjEntryDate").value = todayDate();
  bindEvents();
  await loadMasters();

  if (getSelectedBaseId() && getSelectedFiscalYearId()) {
    await loadDurations();
    if (state.durations.length) {
      await selectDuration(state.durations[0].duration_key);
    } else {
      renderSavedRows();
    }
  } else {
    renderDurationRows();
    renderSavedRows();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message || "Failed to initialize imprest adjustment page", "error"));
});
