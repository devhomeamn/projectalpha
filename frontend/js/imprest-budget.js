import {
  byId,
  ensureArray,
  escapeHtml,
  formatMoney,
  imprestFetch,
  setButtonBusy,
  showToast,
  toPositiveInt,
} from "./imprest-common.js";

const state = {
  bases: [],
  fiscalYears: [],
  codes: [],
  budgets: [],
  budgetLookupSeq: 0,
  editingFinancialCodeId: null,
};

function normalizeFinancialCodeInputValue(value) {
  return String(value ?? "").replace(/[^\d\u09e6-\u09ef]/g, "");
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

function paintSelects() {
  byId("baBase").innerHTML = optionsHtml(state.bases, (r) => `${r.base_name} (${r.base_code})`);
  byId("baFiscalYear").innerHTML = optionsHtml(state.fiscalYears, (r) => r.name);
  byId("baCode").innerHTML = optionsHtml(state.codes, (r) => `${r.code} - ${r.khat_name_bn}`);

  byId("baFilterBase").innerHTML = optionsHtml(state.bases, (r) => `${r.base_name} (${r.base_code})`, null, true);
  byId("baFilterFy").innerHTML = optionsHtml(state.fiscalYears, (r) => r.name, null, true);

  const fcExisting = byId("fcExisting");
  if (fcExisting) {
    const opts = ['<option value="">+ Add New Code</option>'];
    state.codes.forEach((row) => {
      opts.push(`<option value="${Number(row.id)}">${escapeHtml(`${row.code} - ${row.khat_name_bn || ""}`)}</option>`);
    });
    fcExisting.innerHTML = opts.join("");
    fcExisting.value = state.editingFinancialCodeId ? String(state.editingFinancialCodeId) : "";
  }
}

function renderBudgetRows() {
  const tbody = byId("baRows");
  if (!tbody) return;

  if (!state.budgets.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="imp-empty">No budget allocation found</td></tr>';
    return;
  }

  tbody.innerHTML = state.budgets
    .map((row, idx) => {
      return `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(row.base?.base_name || "-")} (${escapeHtml(row.base?.base_code || "-")})</td>
        <td>${escapeHtml(row.fiscal_year?.name || "-")}</td>
        <td>${escapeHtml(row.financial_code?.code || "-")}</td>
        <td>${escapeHtml(row.financial_code?.khat_name_bn || "-")}</td>
        <td class="imp-right">${formatMoney(row.budget_amount)}</td>
        <td>
          <button class="imp-btn danger imp-btn-sm" type="button" data-budget-delete="${Number(row.id)}">Delete</button>
        </td>
      </tr>
    `;
    })
    .join("");
}

function resetFinancialCodeForm() {
  state.editingFinancialCodeId = null;
  byId("fcExisting").value = "";
  byId("fcCode").value = "";
  byId("fcNameBn").value = "";
  byId("fcNameEn").value = "";
  byId("fcStatus").value = "active";
  byId("fcSaveBtn").textContent = "Save Code";
  const resetBtn = byId("fcResetBtn");
  if (resetBtn) resetBtn.hidden = true;
}

function startFinancialCodeEdit(selectedId) {
  const codeId = toPositiveInt(selectedId);
  if (!codeId) {
    resetFinancialCodeForm();
    return;
  }

  const target = state.codes.find((row) => Number(row.id) === Number(codeId));
  if (!target) {
    resetFinancialCodeForm();
    return;
  }

  state.editingFinancialCodeId = Number(target.id);
  byId("fcExisting").value = String(target.id);
  byId("fcCode").value = String(target.code || "");
  byId("fcNameBn").value = String(target.khat_name_bn || "");
  byId("fcNameEn").value = String(target.khat_name_en || "");
  byId("fcStatus").value = String(target.status || "active");
  byId("fcSaveBtn").textContent = "Update Code";
  const resetBtn = byId("fcResetBtn");
  if (resetBtn) resetBtn.hidden = false;
}

async function loadMasters() {
  const [basesOut, codesOut, fyOut] = await Promise.all([
    imprestFetch("/bases"),
    imprestFetch("/financial-codes"),
    imprestFetch("/fiscal-years"),
  ]);

  state.bases = ensureArray(basesOut.data);
  state.codes = ensureArray(codesOut.data);
  state.fiscalYears = ensureArray(fyOut.data);
  paintSelects();

  if (state.editingFinancialCodeId) {
    const stillExists = state.codes.some((row) => Number(row.id) === Number(state.editingFinancialCodeId));
    if (stillExists) {
      startFinancialCodeEdit(state.editingFinancialCodeId);
    } else {
      resetFinancialCodeForm();
    }
  }
}

async function loadBudgets() {
  const params = new URLSearchParams();
  const baseId = toPositiveInt(byId("baFilterBase")?.value);
  const fyId = toPositiveInt(byId("baFilterFy")?.value);
  if (baseId) params.set("base_id", String(baseId));
  if (fyId) params.set("fiscal_year_id", String(fyId));

  const out = await imprestFetch(`/budgets${params.toString() ? `?${params.toString()}` : ""}`);
  state.budgets = ensureArray(out.data);
  renderBudgetRows();
}

function setBudgetSelectionHint(text) {
  const hintEl = byId("baExistingHint");
  if (!hintEl) return;
  hintEl.textContent = String(text || "");
}

async function syncBudgetAmountFromSelection() {
  const baseId = toPositiveInt(byId("baBase")?.value);
  const fiscalYearId = toPositiveInt(byId("baFiscalYear")?.value);
  const codeId = toPositiveInt(byId("baCode")?.value);
  const amountInput = byId("baAmount");

  const seq = ++state.budgetLookupSeq;

  if (!baseId || !fiscalYearId || !codeId) {
    if (amountInput) amountInput.value = "";
    setBudgetSelectionHint("Select base, fiscal year and code to load existing allocation.");
    return;
  }

  const params = new URLSearchParams({
    base_id: String(baseId),
    fiscal_year_id: String(fiscalYearId),
    financial_code_id: String(codeId),
  });

  const out = await imprestFetch(`/budgets?${params.toString()}`);
  if (seq !== state.budgetLookupSeq) return;

  const rows = ensureArray(out.data);
  const existing = rows.find(
    (row) =>
      Number(row.base_id) === Number(baseId) &&
      Number(row.fiscal_year_id) === Number(fiscalYearId) &&
      Number(row.financial_code_id) === Number(codeId)
  );

  if (existing) {
    if (amountInput) amountInput.value = String(Number(existing.budget_amount || 0));
    setBudgetSelectionHint(
      `Existing allocation found: ${formatMoney(existing.budget_amount)}. Saving will update this amount.`
    );
    return;
  }

  if (amountInput) amountInput.value = "";
  setBudgetSelectionHint("No previous allocation found for this selection. Enter a new budget amount.");
}

async function saveBase() {
  const payload = {
    base_name: String(byId("baseName")?.value || "").trim(),
    base_code: String(byId("baseCode")?.value || "").trim(),
    status: String(byId("baseStatus")?.value || "active"),
  };

  const button = byId("baseSaveBtn");
  const release = setButtonBusy(button, true, "Saving...");
  try {
    await imprestFetch("/bases", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    byId("baseName").value = "";
    byId("baseCode").value = "";
    showToast("Base saved", "success");
    await loadMasters();
    await loadBudgets();
  } catch (err) {
    showToast(err.message || "Failed to save base", "error");
  } finally {
    release();
  }
}

async function saveFinancialCode() {
  const codeInput = byId("fcCode");
  const code = normalizeFinancialCodeInputValue(codeInput?.value || "");
  if (codeInput) codeInput.value = code;

  if (!code) {
    showToast("Code must be numeric only", "error");
    return;
  }

  const payload = {
    code,
    khat_name_bn: String(byId("fcNameBn")?.value || "").trim(),
    khat_name_en: String(byId("fcNameEn")?.value || "").trim() || null,
    status: String(byId("fcStatus")?.value || "active"),
  };

  const editingId = toPositiveInt(state.editingFinancialCodeId);
  const path = editingId ? `/financial-codes/${editingId}` : "/financial-codes";
  const method = editingId ? "PUT" : "POST";

  const button = byId("fcSaveBtn");
  const release = setButtonBusy(button, true, "Saving...");
  try {
    await imprestFetch(path, {
      method,
      body: JSON.stringify(payload),
    });

    resetFinancialCodeForm();
    showToast(editingId ? "Financial code updated" : "Financial code saved", "success");
    await loadMasters();
    await loadBudgets();
  } catch (err) {
    showToast(err.message || "Failed to save financial code", "error");
  } finally {
    release();
  }
}

async function saveFiscalYear() {
  const payload = {
    name: String(byId("fyName")?.value || "").trim(),
    start_date: byId("fyStart")?.value || "",
    end_date: byId("fyEnd")?.value || "",
    status: String(byId("fyStatus")?.value || "active"),
  };

  const button = byId("fySaveBtn");
  const release = setButtonBusy(button, true, "Saving...");
  try {
    await imprestFetch("/fiscal-years", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    byId("fyName").value = "";
    byId("fyStart").value = "";
    byId("fyEnd").value = "";
    showToast("Fiscal year saved", "success");
    await loadMasters();
    await loadBudgets();
  } catch (err) {
    showToast(err.message || "Failed to save fiscal year", "error");
  } finally {
    release();
  }
}

async function saveBudgetAllocation() {
  const payload = {
    base_id: toPositiveInt(byId("baBase")?.value),
    fiscal_year_id: toPositiveInt(byId("baFiscalYear")?.value),
    financial_code_id: toPositiveInt(byId("baCode")?.value),
    budget_amount: Number(byId("baAmount")?.value || 0),
  };

  const button = byId("baSaveBtn");
  const release = setButtonBusy(button, true, "Saving...");
  try {
    await imprestFetch("/budgets", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    showToast("Budget allocation saved", "success");
    await loadBudgets();
    await syncBudgetAmountFromSelection();
  } catch (err) {
    showToast(err.message || "Failed to save budget", "error");
  } finally {
    release();
  }
}

async function deleteBudgetAllocation(idValue) {
  const budgetId = toPositiveInt(idValue);
  if (!budgetId) return;

  const ok = window.confirm("Delete this budget allocation? It will fail if already used in note/adjustment.");
  if (!ok) return;

  try {
    await imprestFetch(`/budgets/${budgetId}`, { method: "DELETE" });
    showToast("Budget allocation deleted", "success");
    await loadBudgets();
    await syncBudgetAmountFromSelection();
  } catch (err) {
    showToast(err.message || "Failed to delete budget allocation", "error");
  }
}

function bindEvents() {
  byId("baseSaveBtn")?.addEventListener("click", saveBase);
  byId("fcSaveBtn")?.addEventListener("click", saveFinancialCode);
  byId("fcResetBtn")?.addEventListener("click", resetFinancialCodeForm);
  byId("fcExisting")?.addEventListener("change", (e) => {
    startFinancialCodeEdit(e.target?.value);
  });
  byId("fcCode")?.addEventListener("input", (e) => {
    const normalized = normalizeFinancialCodeInputValue(e.target?.value || "");
    if (normalized !== e.target.value) e.target.value = normalized;
  });

  byId("fySaveBtn")?.addEventListener("click", saveFiscalYear);
  byId("baSaveBtn")?.addEventListener("click", saveBudgetAllocation);
  byId("baBase")?.addEventListener("change", () => {
    syncBudgetAmountFromSelection().catch((err) =>
      showToast(err.message || "Failed to load existing allocation", "error")
    );
  });
  byId("baFiscalYear")?.addEventListener("change", () => {
    syncBudgetAmountFromSelection().catch((err) =>
      showToast(err.message || "Failed to load existing allocation", "error")
    );
  });
  byId("baCode")?.addEventListener("change", () => {
    syncBudgetAmountFromSelection().catch((err) =>
      showToast(err.message || "Failed to load existing allocation", "error")
    );
  });

  byId("baFilterBtn")?.addEventListener("click", () => loadBudgets().catch((err) => showToast(err.message, "error")));
  byId("baRefreshBtn")?.addEventListener("click", () => {
    byId("baFilterBase").value = "";
    byId("baFilterFy").value = "";
    loadBudgets().catch((err) => showToast(err.message, "error"));
  });

  byId("baRows")?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("[data-budget-delete]");
    if (!btn) return;
    deleteBudgetAllocation(btn.getAttribute("data-budget-delete"));
  });
}

async function init() {
  bindEvents();
  await loadMasters();
  await loadBudgets();
  await syncBudgetAmountFromSelection();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message || "Failed to initialize budget setup", "error"));
});
