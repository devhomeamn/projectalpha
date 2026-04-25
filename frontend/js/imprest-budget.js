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
};

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
}

function renderBudgetRows() {
  const tbody = byId("baRows");
  if (!tbody) return;

  if (!state.budgets.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="imp-empty">No budget allocation found</td></tr>';
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
      </tr>
    `;
    })
    .join("");
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
  const payload = {
    code: String(byId("fcCode")?.value || "").trim(),
    khat_name_bn: String(byId("fcNameBn")?.value || "").trim(),
    khat_name_en: String(byId("fcNameEn")?.value || "").trim() || null,
    status: String(byId("fcStatus")?.value || "active"),
  };

  const button = byId("fcSaveBtn");
  const release = setButtonBusy(button, true, "Saving...");
  try {
    await imprestFetch("/financial-codes", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    byId("fcCode").value = "";
    byId("fcNameBn").value = "";
    byId("fcNameEn").value = "";
    showToast("Financial code saved", "success");
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

    byId("baAmount").value = "";
    showToast("Budget allocation saved", "success");
    await loadBudgets();
  } catch (err) {
    showToast(err.message || "Failed to save budget", "error");
  } finally {
    release();
  }
}

function bindEvents() {
  byId("baseSaveBtn")?.addEventListener("click", saveBase);
  byId("fcSaveBtn")?.addEventListener("click", saveFinancialCode);
  byId("fySaveBtn")?.addEventListener("click", saveFiscalYear);
  byId("baSaveBtn")?.addEventListener("click", saveBudgetAllocation);

  byId("baFilterBtn")?.addEventListener("click", () => loadBudgets().catch((err) => showToast(err.message, "error")));
  byId("baRefreshBtn")?.addEventListener("click", () => {
    byId("baFilterBase").value = "";
    byId("baFilterFy").value = "";
    loadBudgets().catch((err) => showToast(err.message, "error"));
  });
}

async function init() {
  bindEvents();
  await loadMasters();
  await loadBudgets();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message || "Failed to initialize budget setup", "error"));
});
