import {
  amountInBanglaWords,
  byId,
  createMonthOptionsHtml,
  ensureArray,
  escapeHtml,
  formatMoney,
  formatMoneyBn,
  getMonthNameBn,
  getPakkhikLabel,
  getPagination,
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
  rows: [],
  page: 1,
  limit: 20,
  total: 0,
  bases: [],
  fiscalYears: [],
  adjustBudgetRows: [],
  adjustBudgetByCode: new Map(),
};

function toggleModal(id, open) {
  const modal = byId(id);
  if (!modal) return;
  modal.classList.toggle("is-open", Boolean(open));
  modal.setAttribute("aria-hidden", open ? "false" : "true");
}

function setFilterOptions() {
  const baseSelect = byId("impListBase");
  const fySelect = byId("impListFiscalYear");
  const monthSelect = byId("impListMonth");
  const pakkhikSelect = byId("impListPakkhik");

  if (baseSelect) {
    baseSelect.innerHTML =
      '<option value="">All</option>' +
      state.bases
        .map((row) => `<option value="${Number(row.id)}">${escapeHtml(row.base_name)} (${escapeHtml(row.base_code)})</option>`)
        .join("");
  }

  if (fySelect) {
    fySelect.innerHTML =
      '<option value="">All</option>' +
      state.fiscalYears.map((row) => `<option value="${Number(row.id)}">${escapeHtml(row.name)}</option>`).join("");
  }

  if (monthSelect) monthSelect.innerHTML = '<option value="">All</option>' + createMonthOptionsHtml();
  if (pakkhikSelect) {
    pakkhikSelect.innerHTML = `
      <option value="">All</option>
      <option value="FIRST_HALF">1st Half</option>
      <option value="SECOND_HALF">2nd Half</option>
      <option value="NONE">None</option>
    `;
  }
}

function readFilters() {
  return {
    base_id: byId("impListBase")?.value || "",
    fiscal_year_id: byId("impListFiscalYear")?.value || "",
    month: byId("impListMonth")?.value || "",
    pakkhik: byId("impListPakkhik")?.value || "",
    status: byId("impListStatus")?.value || "",
    q: String(byId("impListSearch")?.value || "").trim(),
  };
}

function renderRows() {
  const tbody = byId("impListRows");
  if (!tbody) return;

  if (!state.rows.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="imp-empty">No note found</td></tr>';
    return;
  }

  tbody.innerHTML = state.rows
    .map((row, idx) => {
      const sl = (state.page - 1) * state.limit + idx + 1;
      const actions = [];

      actions.push(`<button class="imp-mini-btn primary" data-action="view" data-id="${Number(row.id)}" type="button">View</button>`);

      if (row.can_edit) {
        actions.push(`<a class="imp-mini-btn" href="imprest-note.html?id=${Number(row.id)}">Edit</a>`);
      }
      if (row.can_approve) {
        actions.push(`<button class="imp-mini-btn success" data-action="approve" data-id="${Number(row.id)}" type="button">Approve</button>`);
      }
      if (row.can_reject) {
        actions.push(`<button class="imp-mini-btn danger" data-action="reject" data-id="${Number(row.id)}" type="button">Reject</button>`);
      }
      if (row.can_issue) {
        actions.push(`<button class="imp-mini-btn warn" data-action="issue" data-id="${Number(row.id)}" type="button">Issue Fund</button>`);
      }
      if (row.can_adjust) {
        actions.push(`<button class="imp-mini-btn" data-action="adjust" data-id="${Number(row.id)}" type="button">Adjust</button>`);
      }
      if (row.can_print) {
        actions.push(`<button class="imp-mini-btn" data-action="print" data-id="${Number(row.id)}" type="button">Print</button>`);
      }

      return `
        <tr>
          <td>${sl}</td>
          <td>${escapeHtml(row.note_no || "-")}</td>
          <td>${escapeHtml(row.base?.base_name || "-")}</td>
          <td>${escapeHtml(row.fiscal_year?.name || "-")}</td>
          <td>${escapeHtml(row.month_name || "-")} (${
            String(row.demand_type || "REGULAR").toUpperCase() === "COMPLEMENTARY"
              ? "Complementary"
              : escapeHtml(getPakkhikLabel(row.pakkhik))
          })</td>
          <td><span class="imp-status ${normalizeStatusClass(row.status)}">${escapeHtml(row.status || "-")}</span></td>
          <td class="imp-right">${formatMoney(row.total_current_claim)}</td>
          <td class="imp-right">${formatMoney(row.total_remaining)}</td>
          <td><div class="imp-row-actions">${actions.join("")}</div></td>
        </tr>
      `;
    })
    .join("");
}

function renderPagination() {
  const { totalPages } = getPagination(state.total, state.page, state.limit);
  byId("impListPageInfo").textContent = `Page ${state.page} / ${totalPages}`;
  byId("impListPrevBtn").disabled = state.page <= 1;
  byId("impListNextBtn").disabled = state.page >= totalPages;
}

async function loadRows(page = 1) {
  const filters = readFilters();
  const params = new URLSearchParams({ page: String(page), limit: String(state.limit) });

  ["base_id", "fiscal_year_id", "month", "pakkhik", "status", "q"].forEach((key) => {
    if (filters[key]) params.set(key, String(filters[key]));
  });

  const out = await imprestFetch(`/notes?${params.toString()}`);
  state.rows = ensureArray(out.data);
  state.page = Number(out.page || page);
  state.limit = Number(out.limit || state.limit);
  state.total = Number(out.total || state.rows.length);

  renderRows();
  renderPagination();
}

async function loadMasters() {
  const [basesOut, fyOut] = await Promise.all([imprestFetch("/bases"), imprestFetch("/fiscal-years")]);
  state.bases = ensureArray(basesOut.data);
  state.fiscalYears = ensureArray(fyOut.data);
  setFilterOptions();
}

function openActionModal(type, rowId) {
  const titles = {
    approve: "Approve Note",
    reject: "Reject Note",
  };
  byId("impActionType").value = type;
  byId("impActionId").value = String(rowId);
  byId("impActionTitle").textContent = titles[type] || "Take Action";
  byId("impActionSubmit").textContent = type === "approve" ? "Approve" : "Reject";
  byId("impActionRemarks").value = "";
  toggleModal("impActionModal", true);
}

async function submitActionForm(e) {
  e.preventDefault();
  const noteId = toPositiveInt(byId("impActionId")?.value);
  const actionType = String(byId("impActionType")?.value || "");
  if (!noteId || !actionType) return;

  const endpoint = actionType === "approve" ? "approve" : "reject";
  const submitBtn = byId("impActionSubmit");
  const release = setButtonBusy(submitBtn, true, "Processing...");

  try {
    await imprestFetch(`/notes/${noteId}/${endpoint}`, {
      method: "POST",
      body: JSON.stringify({
        remarks: String(byId("impActionRemarks")?.value || "").trim() || null,
      }),
    });

    toggleModal("impActionModal", false);
    showToast(`Note ${actionType === "approve" ? "approved" : "rejected"} successfully`, "success");
    await loadRows(state.page);
  } catch (err) {
    showToast(err.message || `Failed to ${actionType} note`, "error");
  } finally {
    release();
  }
}

function renderIssueRows(items) {
  const tbody = byId("impIssueRows");
  if (!tbody) return;
  const rows = ensureArray(items);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="imp-empty">No item found</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map((item, idx) => {
      const claimed = toNumber(item.current_claim);
      const approved = toNumber(item.approved_amount || item.current_claim);
      const issueNow = toNumber(item.current_claim);

      return `
        <tr data-item-id="${Number(item.id)}" data-code-id="${Number(item.financial_code_id)}" data-claim="${issueNow}">
          <td>${idx + 1}</td>
          <td>${escapeHtml(item.khat_name || item.financial_code?.khat_name_bn || "-")}</td>
          <td>${escapeHtml(item.financial_code?.code || "-")}</td>
          <td class="imp-right">${formatMoney(claimed)}</td>
          <td class="imp-right">${formatMoney(approved)}</td>
          <td class="imp-right">${formatMoney(issueNow)}</td>
        </tr>
      `;
    })
    .join("");
}

async function openIssueModal(noteId) {
  try {
    const out = await imprestFetch(`/notes/${noteId}`);
    const note = out.data;

    byId("impIssueId").value = String(noteId);
    byId("impIssueDate").value = new Date().toISOString().slice(0, 10);
    byId("impIssueVoucher").value = "";
    byId("impIssueRemarks").value = note.remarks || "";
    renderIssueRows(note.items || []);
    toggleModal("impIssueModal", true);
  } catch (err) {
    showToast(err.message || "Failed to load note for issue", "error");
  }
}

async function submitIssueForm(e) {
  e.preventDefault();
  const noteId = toPositiveInt(byId("impIssueId")?.value);
  if (!noteId) return;

  const totalIssueAmount = Array.from(byId("impIssueRows")?.querySelectorAll("tr") || []).reduce(
    (sum, row) => sum + toNumber(row.getAttribute("data-claim")),
    0
  );

  if (totalIssueAmount <= 0) {
    showToast("No claim amount found for issue", "warn");
    return;
  }

  const submitBtn = byId("impIssueSubmit");
  const release = setButtonBusy(submitBtn, true, "Issuing...");

  try {
    await imprestFetch(`/notes/${noteId}/issue`, {
      method: "POST",
      body: JSON.stringify({
        issue_date: byId("impIssueDate")?.value || null,
        dispatch_no: String(byId("impIssueVoucher")?.value || "").trim() || null,
        remarks: String(byId("impIssueRemarks")?.value || "").trim() || null,
      }),
    });

    toggleModal("impIssueModal", false);
    showToast("Fund issued", "success");
    await loadRows(state.page);
  } catch (err) {
    showToast(err.message || "Failed to issue fund", "error");
  } finally {
    release();
  }
}

function renderAdjustRows(items) {
  const tbody = byId("impAdjustRows");
  if (!tbody) return;
  const rows = ensureArray(items);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="imp-empty">No item found</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map((item, idx) => {
      const itemId = toPositiveInt(item.id ?? item.note_item_id);
      const codeId = toPositiveInt(item.financial_code_id);
      const issued = toNumber(item.issued_amount);
      const adjusted = toNumber(item.adjustment_amount);
      const pending = Math.max(0, Number((issued - adjusted).toFixed(2)));
      const noIssueDisabled = issued > 0 ? "disabled" : "";

      return `
        <tr data-item-id="${itemId || ""}" data-code-id="${codeId || ""}" data-issued="${issued}" data-pending="${pending}">
          <td>${idx + 1}</td>
          <td>${escapeHtml(item.khat_name || item.financial_code?.khat_name_bn || "-")}</td>
          <td>${escapeHtml(item.financial_code?.code || "-")}</td>
          <td class="imp-right">${formatMoney(issued)}</td>
          <td class="imp-right">${formatMoney(adjusted)}</td>
          <td class="imp-right">${formatMoney(pending)}</td>
          <td class="imp-right"><input class="imp-input adj-now" type="number" min="0" step="0.01" max="${pending}" value="${pending}" /></td>
          <td class="imp-right"><input class="imp-input adj-no-issue" type="number" min="0" step="0.01" value="0" ${noIssueDisabled} /></td>
        </tr>
      `;
    })
    .join("");
}

function buildAdjustOptionLabel(row) {
  const code = row?.financial_code?.code || `CODE-${Number(row?.financial_code_id || 0)}`;
  const khat = row?.financial_code?.khat_name_bn || row?.financial_code?.khat_name_en || "-";
  return `${code} - ${khat}`;
}

function setAdjustAddCodeOptions(note) {
  const select = byId("impAdjustAddCode");
  if (!select) return;

  const existingCodes = new Set(
    ensureArray(note?.items)
      .map((item) => toPositiveInt(item.financial_code_id))
      .filter(Boolean)
  );

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
      .map((row) => `<option value="${Number(row.financial_code_id)}">${escapeHtml(buildAdjustOptionLabel(row))}</option>`)
      .join("");
}

function addAdjustCodeRow() {
  const tbody = byId("impAdjustRows");
  const select = byId("impAdjustAddCode");
  const amountInput = byId("impAdjustAddAmount");
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

  const exists = tbody.querySelector(`tr[data-code-id="${codeId}"]`);
  if (exists) {
    const noIssueInput = exists.querySelector(".adj-no-issue");
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
      <tr data-item-id="" data-code-id="${codeId}" data-issued="0" data-pending="0">
        <td>${sl}</td>
        <td>${escapeHtml(khat)}</td>
        <td>${escapeHtml(code)}</td>
        <td class="imp-right">${formatMoney(0)}</td>
        <td class="imp-right">${formatMoney(0)}</td>
        <td class="imp-right">${formatMoney(0)}</td>
        <td class="imp-right"><input class="imp-input adj-now" type="number" min="0" step="0.01" max="0" value="0" /></td>
        <td class="imp-right"><input class="imp-input adj-no-issue" type="number" min="0" step="0.01" value="${initialNoIssue}" /></td>
      </tr>
    `
  );

  state.adjustBudgetByCode.delete(codeId);
  const selectedOption = select.querySelector(`option[value="${codeId}"]`);
  if (selectedOption) selectedOption.remove();
  select.value = "";
  amountInput.value = "0";
}

async function openAdjustModal(noteId) {
  try {
    const out = await imprestFetch(`/notes/${noteId}`);
    const note = out.data;
    const issues = ensureArray(note.issues);
    const latestIssue = issues.length ? issues[issues.length - 1] : null;
    const budgetsOut = await imprestFetch(
      `/budgets?base_id=${Number(note.base_id)}&fiscal_year_id=${Number(note.fiscal_year_id)}`
    );

    byId("impAdjustId").value = String(noteId);
    byId("impAdjustDate").value = new Date().toISOString().slice(0, 10);
    byId("impAdjustVoucher").value = latestIssue?.dispatch_no || latestIssue?.voucher_no || "";
    byId("impAdjustRemarks").value = note.remarks || "";
    byId("impAdjustAddAmount").value = "0";
    state.adjustBudgetRows = ensureArray(budgetsOut.data);
    renderAdjustRows(note.items || []);
    setAdjustAddCodeOptions(note);
    toggleModal("impAdjustModal", true);
  } catch (err) {
    showToast(err.message || "Failed to load note for adjustment", "error");
  }
}

async function submitAdjustForm(e) {
  e.preventDefault();
  const noteId = toPositiveInt(byId("impAdjustId")?.value);
  if (!noteId) return;

  const adjustments = Array.from(byId("impAdjustRows")?.querySelectorAll("tr") || [])
    .map((row) => {
      const pending = toNumber(row.getAttribute("data-pending"));
      const issued = toNumber(row.getAttribute("data-issued"));
      const noteItemId = toPositiveInt(row.getAttribute("data-item-id"));
      const codeId = toPositiveInt(row.getAttribute("data-code-id"));
      const addNow = toNumber(row.querySelector(".adj-now")?.value);
      const noIssueNow = toNumber(row.querySelector(".adj-no-issue")?.value);
      if (addNow > pending) throw new Error("Adjustment amount exceeds pending amount");
      if (noIssueNow > 0 && issued > 0) {
        throw new Error("No-issue adjustment is allowed only when issued amount is zero");
      }
      if (addNow <= 0 && noIssueNow <= 0) return null;
      const payload = {
        financial_code_id: Number(codeId),
        adjusted_amount: Number(addNow.toFixed(2)),
        unissued_adjusted_amount: Number(noIssueNow.toFixed(2)),
      };
      if (noteItemId) {
        payload.note_item_id = Number(noteItemId);
        payload.id = Number(noteItemId);
      }
      return payload;
    })
    .filter(Boolean);

  if (!adjustments.length) {
    showToast("Enter adjustment amount", "warn");
    return;
  }

  const submitBtn = byId("impAdjustSubmit");
  const release = setButtonBusy(submitBtn, true, "Adjusting...");

  try {
    await imprestFetch(`/notes/${noteId}/adjust`, {
      method: "POST",
      body: JSON.stringify({
        adjustment_date: byId("impAdjustDate")?.value || null,
        adjustment_ref_no: String(byId("impAdjustVoucher")?.value || "").trim() || null,
        remarks: String(byId("impAdjustRemarks")?.value || "").trim() || null,
        adjustments,
      }),
    });

    toggleModal("impAdjustModal", false);
    showToast("Adjustment recorded", "success");
    await loadRows(state.page);
  } catch (err) {
    showToast(err.message || "Failed to adjust note", "error");
  } finally {
    release();
  }
}

function buildPrintHtml(payload) {
  const note = payload?.data;
  const meta = payload?.print_meta || {};
  if (!note) return "";

  const totalClaim = toNumber(note.total_current_claim);
  const amountWords = amountInBanglaWords(totalClaim);
  const rowsHtml = (note.items || [])
    .map((item, idx) => {
      return `
        <tr>
          <td>${toBanglaDigits(idx + 1)}</td>
          <td>${escapeHtml(item.khat_name || item.financial_code?.khat_name_bn || "-")}</td>
          <td>${escapeHtml(item.financial_code?.code || "-")}</td>
          <td style="text-align:right;">${formatMoneyBn(item.budget_amount)}</td>
          <td style="text-align:right;">${formatMoneyBn(item.previous_expense)}</td>
          <td style="text-align:right;">${formatMoneyBn(item.current_claim)}</td>
          <td style="text-align:right;">${formatMoneyBn(item.remaining_balance)}</td>
        </tr>
      `;
    })
    .join("");

  const monthBn = getMonthNameBn(note.month);
  const yearBn = toBanglaDigits(String(note.period_start || "").slice(0, 4));
  const pakkhikShort = getPakkhikShort(note.pakkhik);
  const paragraphText = `\u0989\u09aa\u09b0\u09cd\u09af\u09c1\u0995\u09cd\u09a4 \u09ac\u09bf\u09b7\u09af\u09bc\u09c7 ${note.period_start || "-"} \u09b9\u09a4\u09c7 ${note.period_end || "-"} \u09aa\u09b0\u09cd\u09af\u09a8\u09cd\u09a4 \u09b8\u09ae\u09af\u09bc\u09c7\u09b0 \u09ac\u09cd\u09af\u09af\u09bc \u09a8\u09bf\u09b0\u09cd\u09ac\u09be\u09b9\u09c7\u09b0 \u09a8\u09bf\u09ae\u09bf\u09a4\u09cd\u09a4\u09c7 = ${formatMoneyBn(totalClaim)}/- (${amountWords}) \u099f\u09be\u0995\u09be\u09b0 \u0986\u09b0\u09cd\u09a5\u09bf\u0995 \u09a6\u09be\u09ac\u09c0 \u09aa\u09be\u0993\u09af\u09bc\u09be \u0997\u09c7\u099b\u09c7\u0964`;
  const footerText = `\u098f\u09a4\u09a6\u09cd\u09ac\u09bf\u09b7\u09af\u09bc\u09c7, \u09b8\u0982\u09b6\u09cd\u09b2\u09bf\u09b7\u09cd\u099f \u0998\u09be\u0981\u099f\u09bf \u0995\u09b0\u09cd\u09a4\u09c3\u0995 \u09a6\u09be\u09ac\u09c0\u0995\u09c3\u09a4 = ${formatMoneyBn(totalClaim)}/- (${amountWords}) \u099f\u09be\u0995\u09be \u0985\u0997\u09cd\u09b0\u09bf\u09ae \u09aa\u09cd\u09b0\u09a6\u09be\u09a8 \u0995\u09b0\u09be \u09af\u09c7\u09a4\u09c7 \u09aa\u09be\u09b0\u09c7\u0964 \u09ae\u09b9\u09cb\u09a6\u09af\u09bc\u09c7\u09b0 \u09b8\u09a6\u09af\u09bc \u0985\u09a8\u09c1\u09ae\u09cb\u09a6\u09a8\u09c7\u09b0 \u099c\u09a8\u09cd\u09af \u09a8\u09a5\u09bf \u0989\u09aa\u09b8\u09cd\u09a5\u09be\u09aa\u09a8 \u0995\u09b0\u09be \u09b9\u09b2\u09cb\u0964`;

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @font-face { font-family: "SiyamRupaliBN"; src: url("/fonts/Siyamrupali.ttf") format("truetype"); }
          @page { size: A4; margin: 12mm; }
          body { font-family: "SiyamRupaliBN", Arial, sans-serif; color: #000; margin: 0; font-size: 15px; }
          .title-line { font-size: 16px; margin-bottom: 8px; }
          .subject { font-size: 16px; margin: 6px 0 10px; }
          p { margin: 0 0 10px; line-height: 1.55; text-align: justify; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0 10px; }
          th, td { border: 1px solid #000; padding: 6px 7px; font-size: 14px; }
          th { text-align: center; }
          tfoot td { font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="title-line">${escapeHtml(meta.header_line || "\u0985\u09ab\u09bf\u09b8 \u09a8\u09cb\u099f/\u09aa\u09c3\u09b7\u09cd\u09a0\u09be/\u09e6\u09e8")}</div>
        <div class="subject"><strong>\u09ac\u09bf\u09b7\u09df:</strong> ${escapeHtml(
          meta.subject ||
            `${note.base?.base_name || "-"} \u098f\u09b0 ${monthBn}/${yearBn} \u09ae\u09be\u09b8\u09c7\u09b0 \u0986\u09b0\u09cd\u09a5\u09bf\u0995 \u09a6\u09be\u09ac\u09c0 (${pakkhikShort} \u09aa\u09be\u0995\u09cd\u09b7\u09bf\u0995)\u0964`
        )}</div>
        <p>${escapeHtml(paragraphText)}</p>

        <table>
          <thead>
            <tr>
              <th style="width:56px;">ক্রমিক</th>
              <th>খাত</th>
              <th style="width:120px;">অর্থনৈতিক কোড</th>
              <th style="width:110px;">বরাদ্দ</th>
              <th style="width:110px;">পূর্বের ব্যয়</th>
              <th style="width:150px;">বর্তমান আর্থিক দাবীর পরিমাণ</th>
              <th style="width:110px;">অবশিষ্ট</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="text-align:center;">মোট</td>
              <td style="text-align:right;">${formatMoneyBn(note.total_budget)}</td>
              <td style="text-align:right;">${formatMoneyBn(note.total_previous_expense)}</td>
              <td style="text-align:right;">${formatMoneyBn(note.total_current_claim)}</td>
              <td style="text-align:right;">${formatMoneyBn(note.total_remaining)}</td>
            </tr>
          </tfoot>
        </table>

        <p>${escapeHtml(footerText)}</p>
      </body>
    </html>
  `;
}

async function printNote(noteId) {
  try {
    const out = await imprestFetch(`/notes/${noteId}/print`);
    iframePrint(buildPrintHtml(out));
  } catch (err) {
    showToast(err.message || "Failed to print note", "error");
  }
}

function bindEvents() {
  byId("impListSearchBtn")?.addEventListener("click", () => loadRows(1).catch((err) => showToast(err.message, "error")));
  byId("impListClearBtn")?.addEventListener("click", () => {
    byId("impListBase").value = "";
    byId("impListFiscalYear").value = "";
    byId("impListMonth").value = "";
    byId("impListPakkhik").value = "";
    byId("impListStatus").value = "";
    byId("impListSearch").value = "";
    loadRows(1).catch((err) => showToast(err.message, "error"));
  });

  byId("impListSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadRows(1).catch((err) => showToast(err.message, "error"));
  });

  byId("impListPrevBtn")?.addEventListener("click", () => {
    if (state.page > 1) loadRows(state.page - 1).catch((err) => showToast(err.message, "error"));
  });

  byId("impListNextBtn")?.addEventListener("click", () => {
    const { totalPages } = getPagination(state.total, state.page, state.limit);
    if (state.page < totalPages) loadRows(state.page + 1).catch((err) => showToast(err.message, "error"));
  });

  byId("impListRows")?.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;

    const action = String(target.getAttribute("data-action") || "");
    const id = toPositiveInt(target.getAttribute("data-id"));
    if (!id) return;

    if (action === "view") {
      window.location.href = `imprest-note.html?id=${id}`;
      return;
    }
    if (action === "approve" || action === "reject") {
      openActionModal(action, id);
      return;
    }
    if (action === "issue") {
      openIssueModal(id);
      return;
    }
    if (action === "adjust") {
      openAdjustModal(id);
      return;
    }
    if (action === "print") {
      printNote(id);
    }
  });

  byId("impActionClose")?.addEventListener("click", () => toggleModal("impActionModal", false));
  byId("impActionCancel")?.addEventListener("click", () => toggleModal("impActionModal", false));
  byId("impActionForm")?.addEventListener("submit", submitActionForm);
  byId("impActionModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "impActionModal") toggleModal("impActionModal", false);
  });

  byId("impIssueClose")?.addEventListener("click", () => toggleModal("impIssueModal", false));
  byId("impIssueCancel")?.addEventListener("click", () => toggleModal("impIssueModal", false));
  byId("impIssueForm")?.addEventListener("submit", submitIssueForm);
  byId("impIssueModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "impIssueModal") toggleModal("impIssueModal", false);
  });

  byId("impAdjustClose")?.addEventListener("click", () => toggleModal("impAdjustModal", false));
  byId("impAdjustCancel")?.addEventListener("click", () => toggleModal("impAdjustModal", false));
  byId("impAdjustAddCodeBtn")?.addEventListener("click", addAdjustCodeRow);
  byId("impAdjustForm")?.addEventListener("submit", submitAdjustForm);
  byId("impAdjustModal")?.addEventListener("click", (e) => {
    if (e.target?.id === "impAdjustModal") toggleModal("impAdjustModal", false);
  });
}

async function init() {
  bindEvents();
  await loadMasters();
  await loadRows(1);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => showToast(err.message || "Failed to initialize imprest notes", "error"));
});
