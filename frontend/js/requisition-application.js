import {
  byId,
  ensureArray,
  escapeHtml,
  fetchJson,
  formatQty,
  showToast,
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

function textValue(value, fallback = "-") {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function formatDateDdMmYyyy(value) {
  if (!value) return "-";

  const text = String(value).trim();
  const directMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (directMatch) {
    const [, y, m, d] = directMatch;
    return `${d}-${m}-${y}`;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return text;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  return `${day}-${month}-${year}`;
}

function monthYearLabel(month, year) {
  const m = Number(month);
  const y = Number(year);
  if (!Number.isFinite(m) || m < 1 || m > 12 || !Number.isFinite(y)) {
    return `${textValue(month)} / ${textValue(year)}`;
  }
  return `${MONTH_NAMES[m - 1]} ${Math.trunc(y)}`;
}

function getRequisitionIdFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const id = Number(q.get("id") || 0);
  if (!Number.isFinite(id) || id <= 0) return null;
  return Math.trunc(id);
}

function hasAutoPrintFlag() {
  const q = new URLSearchParams(window.location.search);
  const raw = String(q.get("auto_print") || q.get("autoprint") || "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function clearAutoPrintFlag() {
  const url = new URL(window.location.href);
  url.searchParams.delete("auto_print");
  url.searchParams.delete("autoprint");
  const search = url.searchParams.toString();
  window.history.replaceState(null, "", `${url.pathname}${search ? `?${search}` : ""}`);
}

function showError(message) {
  const box = byId("appErrorBox");
  const paper = byId("appPaper");
  if (box) {
    box.textContent = textValue(message, "Failed to load requisition application.");
    box.hidden = false;
  }
  if (paper) paper.style.display = "none";
}

function renderRows(lines) {
  const tbody = byId("appItemsRows");
  const totalQtyEl = byId("appTotalQty");
  const itemCountEl = byId("appItemCount");
  if (!tbody) return;

  const safeLines = ensureArray(lines);
  if (!safeLines.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No requisition item found</td></tr>';
    if (totalQtyEl) totalQtyEl.textContent = "0.00";
    if (itemCountEl) itemCountEl.textContent = "0 item(s)";
    return;
  }

  let totalQty = 0;
  tbody.innerHTML = safeLines
    .map((line, idx) => {
      const code = escapeHtml(textValue(line.item?.item_code));
      const name = escapeHtml(textValue(line.item?.item_name));
      const unit = escapeHtml(textValue(line.item?.unit));
      const qtyText = formatQty(line.requested_qty);
      const remarks = escapeHtml(textValue(line.remarks));
      totalQty += Number(line.requested_qty || 0);

      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${code}</td>
          <td>${name}</td>
          <td>${unit}</td>
          <td class="right">${qtyText}</td>
          <td>${remarks}</td>
        </tr>
      `;
    })
    .join("");

  if (totalQtyEl) totalQtyEl.textContent = formatQty(totalQty);
  if (itemCountEl) itemCountEl.textContent = `${safeLines.length} item(s)`;
}

function setText(id, value, fallback = "-") {
  const el = byId(id);
  if (!el) return;
  el.textContent = textValue(value, fallback);
}

function renderApplication(data) {
  const requisitionNo = textValue(data.requisition_no);
  const reqMonthYear = monthYearLabel(data.month, data.year);
  const requestDate = formatDateDdMmYyyy(data.submitted_at || data.createdAt);
  const sectionName = textValue(data.section?.name);

  setText("appSectionName", sectionName);
  setText("appReqNo", requisitionNo);
  setText("appDate", requestDate);
  setText("appMonthYear", reqMonthYear);

  const subject = `Prayer for approval of requisitioned inventory items (${requisitionNo}).`;
  setText("appSubjectLine", subject);

  const body = `With due respect, I request approval for issuing the following inventory items for official use of ${sectionName} section for ${reqMonthYear}.`;
  setText("appBodyLine", body);

  renderRows(data.items);
  document.title = `${requisitionNo} - Requisition Application`;
}

async function loadApplication() {
  const requisitionId = getRequisitionIdFromUrl();
  if (!requisitionId) {
    showError("Invalid requisition id.");
    return;
  }

  try {
    const out = await fetchJson(`/inventory/requisitions/${requisitionId}`);
    if (!out?.data) throw new Error("Requisition details were not found.");
    renderApplication(out.data);

    if (hasAutoPrintFlag()) {
      clearAutoPrintFlag();
      setTimeout(() => {
        window.print();
      }, 250);
    }
  } catch (err) {
    showToast(err.message || "Failed to load requisition application", "error");
    showError(err.message || "Failed to load requisition application");
  }
}

function bindEvents() {
  byId("appPrintBtn")?.addEventListener("click", () => window.print());
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadApplication();
});
