console.log("add-record.js loaded");

/* ================== TOAST NOTIFICATION ================== */
function showToast(message, type = "success", duration = 3000) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, duration);
}
window.showToast = showToast;

/* ================== GLOBAL VARIABLES ================== */
let API_BASE = "";
let bdOk = true;
let isSubmitting = false;
let lastBdCheckToken = 0;
let subTouched = false;
let subSubmitAttempted = false;

// Print-preview confirm modal state
let lastPreviewRecord = null;
let previewReady = false;

/* ================== AUTH HELPER ================== */
function getToken() {
  return localStorage.getItem("token") || "";
}

function redirectLogin() {
  localStorage.clear();
  window.location.href = "login.html";
}

async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    showToast("Session expired. Please login again.", "error");
    setTimeout(redirectLogin, 700);
    throw new Error("Unauthorized");
  }
  if (res.status === 403) {
    showToast("Access denied.", "error");
    throw new Error("Forbidden");
  }
  return res;
}

/* ================== CONFIG & API BASE ================== */
function normalizeApiBase(apiBaseFromServer) {
  let base = (apiBaseFromServer || window.location.origin || "").trim();
  if (base.endsWith("/")) base = base.slice(0, -1);
  return base.toLowerCase().endsWith("/api") ? base : `${base}/api`;
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    API_BASE = normalizeApiBase(data.apiBase);
  } catch {
    API_BASE = normalizeApiBase(null);
  }
  initPage();
}
loadConfig();

/* ================== UI HELPERS ================== */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ensureMsg(afterId, msgId) {
  let el = document.getElementById(msgId);
  if (!el) {
    el = document.createElement("div");
    el.id = msgId;
    el.style.marginTop = "6px";
    el.style.fontSize = "13px";
    document.getElementById(afterId)?.insertAdjacentElement("afterend", el);
  }
  return el;
}

function setMsg(el, text, success = true, mode = "normal") {
  if (!el) return;
  el.textContent = text || "";
  if (!text) return;
  el.style.color = mode === "warn" ? "#b36b00" : success ? "green" : "red";
}

function safeText(v) {
  return v == null ? "" : String(v);
}

/* ================== LIVE DATE & TIME IN HEADER ================== */
function updateDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString('bn-BD', { day: '2-digit', month: 'long', year: 'numeric' });
  const time = now.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', hour12: false });

  document.getElementById("currentDate").textContent = date;
  document.getElementById("currentTime").textContent = time;
}

/* ================== CONDITIONAL FIELDS ================== */
// Allocate Table for OP-1 / OP-2
function syncAllocateTable(sectionName) {
  const group = document.getElementById("allocate_table_group");
  const input = document.getElementById("allocate_table");
  const star = document.getElementById("allocate_table_star");

  if (!group || !input) return;

  const isOP = (sectionName || "").trim().toLowerCase().includes("officers pay (op-");
  group.style.display = isOP ? "" : "none";
  input.required = isOP;
  if (star) star.style.display = isOP ? "inline" : "none";
  if (!isOP) input.value = "";
}

// Closing Date visibility based on status
function toggleClosingDate() {
  const status = document.getElementById("record_status")?.value || "ongoing";
  const group = document.getElementById("closing_group");
  const star = document.getElementById("closing_required_star");

  if (group) group.style.display = status === "closed" ? "" : "none";
  if (star) star.style.display = status === "closed" ? "inline" : "none";
  if (status !== "closed") document.getElementById("closing_date").value = "";
}

/* ================== INPUT VALIDATION ================== */
function validateFileName() {
  const input = document.getElementById("file_name");
  const value = input?.value.trim() || "";
  const msg = ensureMsg("file_name", "file_msg");

  if (!value) {
    setMsg(msg, "File Name is required", false);
    return false;
  }
  if (value.length < 3 || value.length > 100) {
    setMsg(msg, "File Name must be 3-100 characters", false);
    return false;
  }
  if (!/^[A-Za-z0-9\s\-_().]+$/.test(value)) {
    setMsg(msg, "Only letters, numbers, space, -, _, (, ) allowed", false);
    return false;
  }
  setMsg(msg, "", true);
  return true;
}

function validateBdFormat() {
  const input = document.getElementById("bd_no");
  const value = input?.value.trim() || "";
  const msg = ensureMsg("bd_no", "bd_format_msg");

  if (!value) return true; // required check on submit

  if (value.length < 6 || value.length > 9) {
    setMsg(msg, "BD No must be 6-9 characters", false);
    return false;
  }
  if (!/^[A-Za-z0-9\/\-]+$/.test(value)) {
    setMsg(msg, "Only letters, numbers, -, / allowed", false);
    return false;
  }
  setMsg(msg, "", true);
  return true;
}

function validateDescription() {
  const ta = document.getElementById("description");
  const value = ta?.value || "";
  const msg = ensureMsg("description", "desc_msg");
  if (value.length > 500) {
    setMsg(msg, "Description too long (max 500 chars)", false);
    return false;
  }
  setMsg(msg, "", true);
  return true;
}

function validateAllocateTable() {
  const group = document.getElementById("allocate_table_group");
  if (!group || group.style.display === "none") return true;

  const input = document.getElementById("allocate_table");
  const value = input?.value.trim() || "";
  const msg = ensureMsg("allocate_table", "alloc_msg");

  if (value.length < 2) {
    setMsg(msg, "Allocate Table required (min 2 chars)", false);
    return false;
  }
  setMsg(msg, "", true);
  return true;
}

/* ================== PAGE INITIALIZATION ================== */
function initPage() {
  wirePrintButtonsOnce();
  wirePreviewConfirmOnce();
  updateDateTime();
  setInterval(updateDateTime, 60000);

  // Initial field states
  syncAllocateTable("");
  toggleClosingDate();

  // Wire audit objection toggle (safe if element exists)
  document.getElementById("audit_objection")?.addEventListener("change", syncObjectionFields);

  // Auto uppercase file name
  document.getElementById("file_name")?.addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase();
    validateFileName();
  });

  // Date limits
  document.getElementById("opening_date")?.setAttribute("max", todayISO());
  document.getElementById("closing_date")?.setAttribute("max", todayISO());

  // Status change handler
  document.getElementById("record_status")?.addEventListener("change", toggleClosingDate);

  // Live validation
  document.getElementById("bd_no")?.addEventListener("input", () => {
    validateBdFormat();
    checkBdNoLive();
  });
  document.getElementById("description")?.addEventListener("input", validateDescription);
  document.getElementById("allocate_table")?.addEventListener("input", validateAllocateTable);

  // Load sections
  loadSections();

  // Form submit
  document.getElementById("recordForm")?.addEventListener("submit", onAddRecord);

  // Subcategory touch
  const sub = document.getElementById("subcategory_id");
  sub?.addEventListener("focus", () => subTouched = true);
  sub?.addEventListener("change", () => { subTouched = true; checkBdNoLive(); });
}

/* ================== LOAD SECTIONS, SUBCATEGORIES, RACKS & SERIAL ================== */
async function loadSections() {
  try {
    const res = await authFetch(`${API_BASE}/sections`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Invalid sections data");

    const sectionSelect = document.getElementById("section_id");
    const subSelect = document.getElementById("subcategory_id");
    const rackSelect = document.getElementById("rack_id");
    const serialInput = document.getElementById("serial_no");

    // Populate sections (exclude Central Room)
    sectionSelect.innerHTML = '<option value="">-- Select Section --</option>';
    data.forEach(sec => {
      if ((sec.name || "").toLowerCase() === "central room") return;
      const opt = document.createElement("option");
      opt.value = sec.id;
      opt.textContent = sec.name;
      sectionSelect.appendChild(opt);
    });

    // Section change handler
    sectionSelect.addEventListener("change", async () => {
      const sid = sectionSelect.value;
      const selected = data.find(s => s.id == sid);

      // Reset dependent fields
      subSelect.innerHTML = '<option value="">-- Select Subcategory --</option>';
      rackSelect.innerHTML = '<option value="">-- Select Rack --</option>';
      serialInput.value = "";
      syncAllocateTable(selected?.name || "");
      syncLALAOUI(selected?.name || "");

      if (!sid) return;

      // Load Subcategories (nested in section response)
      if (selected?.Subcategories?.length) {
        selected.Subcategories.forEach(sub => {
          const opt = document.createElement("option");
          opt.value = sub.id;
          opt.textContent = sub.name;
          subSelect.appendChild(opt);
        });
      }

      // Load Racks (separate endpoint)
      try {
        const rackRes = await authFetch(`${API_BASE}/sections/racks/${sid}`);
        const racks = await rackRes.json();
        rackSelect.innerHTML = '<option value="">-- Select Rack --</option>';
        if (Array.isArray(racks)) {
          racks.forEach(r => {
            const opt = document.createElement("option");
            opt.value = r.id;
            opt.textContent = r.name;
            rackSelect.appendChild(opt);
          });
        }
      } catch (err) {
        showToast("Failed to load racks", "error");
      }
    });

    // Rack change → auto generate next serial
    rackSelect.addEventListener("change", async () => {
      const rid = rackSelect.value;
      if (!rid) {
        serialInput.value = "";
        return;
      }

      try {
        const res = await authFetch(`${API_BASE}/records/by-rack/${rid}`);
        const records = await res.json();
        const used = (Array.isArray(records) ? records : [])
          .map(r => r.serial_no)
          .filter(n => n != null)
          .map(Number)
          .sort((a, b) => a - b);

        let next = 1;
        for (let n of used) {
          if (n === next) next++;
          else break;
        }
        serialInput.value = next;
      } catch {
        serialInput.value = "1";
      }
    });

  } catch (err) {
    showToast("Failed to load sections", "error");
  }
}

/* ================== BD NO UNIQUENESS CHECK (LIVE) ================== */
async function checkBdNoLive() {
  const bdInput = document.getElementById("bd_no");
  const subId = document.getElementById("subcategory_id")?.value;
  const msg = ensureMsg("bd_no", "bd_unique_msg");

  const bdValue = bdInput?.value.trim() || "";

  // Detect LA/LAO from selected option text
  const sectionSelect = document.getElementById("section_id");
  const selectedSectionName =
    sectionSelect?.options?.[sectionSelect.selectedIndex]?.textContent?.trim() || "";
  const isLALAO = (selectedSectionName || "").toLowerCase() === "la/lao";

  if (!bdValue || !subId) {
    bdOk = true;
    setMsg(msg, "");
    return;
  }

  // ✅ LA/LAO হলে duplicate BD allow → live uniqueness check skip
  if (isLALAO) {
    bdOk = true;
    setMsg(msg, "LA/LAO: Same BD allowed (Audit Objection multiple entry)", true, "warn");
    return;
  }

  const token = ++lastBdCheckToken;

  try {
    const res = await authFetch(
      `${API_BASE}/records/check-bd?bd_no=${encodeURIComponent(bdValue)}&subcategory_id=${subId}`
    );
    const data = await res.json();

    if (token !== lastBdCheckToken) return;

    if (data.unique || data.available) {
      bdOk = true;
      setMsg(msg, "BD No available", true);
    } else {
      bdOk = false;
      setMsg(msg, "This BD No already exists in this subcategory", false);
    }
  } catch {
    bdOk = true;
    setMsg(msg, "Could not verify BD No (will check on submit)", true, "warn");
  }
}

/* ================== FORM SUBMIT ================== */
async function onAddRecord(e) {
  e.preventDefault();
  if (isSubmitting) return;

  subSubmitAttempted = true;

  // ---- Detect LA/LAO from selected section name ----
  const sectionSelect = document.getElementById("section_id");
  const selectedSectionName =
    sectionSelect?.options?.[sectionSelect.selectedIndex]?.textContent?.trim() || "";
  const isLALAO = isLALAOSection(selectedSectionName);

  // ---- Read Audit Objection UI values ----
  const auditSel = document.getElementById("audit_objection");
  const auditYes = isLALAO && (auditSel?.value || "").toLowerCase() === "yes";

  const objectionNoEl = document.getElementById("objection_no");
  const objectionTitleEl = document.getElementById("objection_title");
  const objectionDetailsEl = document.getElementById("objection_details");
  const attachmentEl = document.getElementById("attachment");

  const objection_no = objectionNoEl ? objectionNoEl.value.trim() : "";
  const objection_title = objectionTitleEl ? objectionTitleEl.value.trim() : "";
  const objection_details = objectionDetailsEl ? objectionDetailsEl.value.trim() : "";
  const attachmentFile = attachmentEl?.files?.[0] || null;

  // ---- Run all validations ----
  const isValidBase =
    validateFileName() &&
    validateBdFormat() &&
    validateDescription() &&
    validateAllocateTable() &&
    document.getElementById("section_id").value &&
    document.getElementById("subcategory_id").value &&
    document.getElementById("rack_id").value &&
    document.getElementById("opening_date").value &&
  (isLALAO ? true : bdOk);


  if (!isValidBase) {
    showToast("Please fix the errors in the form", "error");
    return;
  }

  // ---- Extra validation for LA/LAO + Audit Objection = Yes ----
  if (auditYes) {
    if (!objection_no || !objection_title || !objection_details || !attachmentFile) {
      showToast(
        "LA/LAO: Audit Objection = Yes হলে Objection No/Title/Details এবং Attachment বাধ্যতামূলক",
        "error"
      );
      return;
    }
  }

  const payload = {
    file_name: document.getElementById("file_name").value.trim().toUpperCase(),
    bd_no: document.getElementById("bd_no").value.trim(),
    section_id: document.getElementById("section_id").value,
    subcategory_id: document.getElementById("subcategory_id").value,
    rack_id: document.getElementById("rack_id").value,
    serial_no: document.getElementById("serial_no").value.trim(),
    record_status: document.getElementById("record_status").value,
    opening_date: document.getElementById("opening_date").value,
    closing_date: document.getElementById("closing_date").value || null,
    allocate_table: document.getElementById("allocate_table")?.value.trim() || null,
    description: document.getElementById("description").value.trim() || null,

    // ✅ LA/LAO audit objection fields
    audit_objection: auditYes ? "yes" : "no",
    objection_no: auditYes ? objection_no : "",
    objection_title: auditYes ? objection_title : "",
    objection_details: auditYes ? objection_details : "",
  };

  isSubmitting = true;
  const btn = e.target.querySelector(".btn-primary");
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="material-symbols-rounded">hourglass_top</span> Saving...`;

  try {
    // ✅ Use FormData (supports file upload)
    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => fd.append(k, v ?? ""));

    if (attachmentFile) fd.append("attachment", attachmentFile);

    const res = await authFetch(`${API_BASE}/records/add`, {
      method: "POST",
      body: fd
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Failed to add record");

    const newId = data?.record?.id;
    if (newId) {
      const printRes = await authFetch(`${API_BASE}/records/print/${newId}`);
      const printData = await printRes.json();
      if (printRes.ok && printData?.record) {
        renderPrintTemplate(printData.record);
        // store record & ask user before opening preview
        lastPreviewRecord = printData.record;
        previewReady = true;
        showToast("Record added successfully!", "success");
        openPreviewConfirmModal();
      } else {
        showToast("Record added successfully!", "success");
      }
    } else {
      showToast("Record added successfully!", "success");
    }

    // reset form
    e.target.reset();
    document.getElementById("serial_no").value = "";
    syncAllocateTable("");
    toggleClosingDate();

    // reset LA/LAO fields UI
    syncLALAOUI("");

    // Clear messages
    ["file_msg", "bd_format_msg", "bd_unique_msg", "desc_msg", "alloc_msg"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = "";
    });

  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    isSubmitting = false;
    btn.disabled = false;
    btn.innerHTML = oldText;
  }
}

/* ================== LA/LAO (AUDIT OBJECTION UI) HELPERS ================== */
function isLALAOSection(sectionName) {
  return (sectionName || "").trim().toLowerCase() === "la/lao";
}

function clearObjectionValues() {
  ["objection_no", "objection_title", "objection_details", "attachment"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

function setObjectionRequired(required) {
  const no = document.getElementById("objection_no");
  const title = document.getElementById("objection_title");
  const details = document.getElementById("objection_details");
  const file = document.getElementById("attachment");
  if (no) no.required = required;
  if (title) title.required = required;
  if (details) details.required = required;
  if (file) file.required = required;
}

function syncObjectionFields() {
  const objectionFields = document.getElementById("objectionFields");
  const auditSel = document.getElementById("audit_objection");
  if (!objectionFields || !auditSel) return;

  const yes = (auditSel.value || "").toLowerCase() === "yes";
  objectionFields.style.display = yes ? "" : "none";
  setObjectionRequired(yes);

  if (!yes) clearObjectionValues();
}

function syncLALAOUI(sectionName) {
  const group = document.getElementById("lalAOGroup");
  const objectionFields = document.getElementById("objectionFields");
  const auditSel = document.getElementById("audit_objection");
  if (!group || !objectionFields || !auditSel) return;

  const isLALAO = isLALAOSection(sectionName);
  group.style.display = isLALAO ? "" : "none";

  if (!isLALAO) {
    auditSel.value = "no";
    objectionFields.style.display = "none";
    setObjectionRequired(false);
    clearObjectionValues();
    return;
  }
  syncObjectionFields();
}

/* ================== PRINT PREVIEW CONFIRM (SUCCESS MODAL) ================== */
let previewConfirmWired = false;

function openPreviewConfirmModal() {
  const m = document.getElementById("successModal");
  if (m) m.classList.remove("hidden");
}

function closePreviewConfirmModal() {
  const m = document.getElementById("successModal");
  if (m) m.classList.add("hidden");
}

function wirePreviewConfirmOnce() {
  if (previewConfirmWired) return;
  previewConfirmWired = true;

  const yesBtn = document.getElementById("btnPrintFromSuccess");
  const noBtn = document.getElementById("btnCloseSuccess");

  // Yes → open print preview (only if previewReady)
  yesBtn?.addEventListener("click", () => {
    if (!previewReady || !lastPreviewRecord) {
      showToast("Preview not available for this record.", "warn");
      closePreviewConfirmModal();
      previewReady = false;
      lastPreviewRecord = null;
      return;
    }
    closePreviewConfirmModal();
    document.getElementById("printModal")?.classList.remove("hidden");
  });

  // No → just close
  noBtn?.addEventListener("click", () => {
    closePreviewConfirmModal();
    previewReady = false;
    lastPreviewRecord = null;
  });

  // optional: click outside card to close
  document.getElementById("successModal")?.addEventListener("click", (e) => {
    if (e.target && e.target.id === "successModal") {
      closePreviewConfirmModal();
      previewReady = false;
      lastPreviewRecord = null;
    }
  });
}

/* ================== PRINT MODAL & TEMPLATE ================== */
function wirePrintButtonsOnce() {
  document.getElementById("btnClosePrint")?.addEventListener("click", () => {
    document.getElementById("printModal").classList.add("hidden");
  });

  document.getElementById("btnPrintRecord")?.addEventListener("click", () => {
    const area = document.getElementById("printArea");
    if (area) iframePrint(area.innerHTML);
  });
}

function iframePrint(html) {
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <html>
      <head>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: Arial, sans-serif; color: #000; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 700);
  }, 300);
}

function renderPrintTemplate(record) {
  const el = document.getElementById("printArea");
  if (!el) return;

  const rackNo = safeText(record.Rack?.name || "");
  const serialNo = safeText(record.serial_no || "");
  const bdNo = safeText(record.bd_no || "");

  const sectionName = safeText(record.Section?.name || "");
  const subName = safeText(record.Subcategory?.name || "");
  const fileName = safeText(record.file_name || "");

  const statusText = safeText(record.record_status || "ongoing");
  const locationText = record.status === "central" ? "In Central" : "In Section";
  const openingDate = safeText(record.opening_date || "");
  const closingDate = safeText(record.closing_date || "");
  const allocateTable = safeText(record.allocate_table || "");

  const qrText = `
SFC Air FRMS
File Name: ${fileName}
BD No: ${bdNo}
Section: ${sectionName}
Subcategory: ${subName}
Rack No: ${rackNo}
Serial No: ${serialNo}
Allocate Table: ${allocateTable || "-"}
Status: ${statusText}
Location: ${locationText}
Opening Date: ${openingDate}
Closing Date: ${closingDate}
Added By: ${safeText(record.added_by || "")}
Created At: ${safeText(record.createdAt ? new Date(record.createdAt).toLocaleString() : "")}
Description: ${safeText(record.description || "")}
`.trim();

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrText)}`;

  el.innerHTML = `
    <style>
      @page { size: A4; margin: 12mm; }
      .a4{ width:100%; font-family: Arial, sans-serif; color:#000; }

      .title{ text-align:center; font-weight:900; font-size:30px; margin:0; letter-spacing:.5px; }
      .subtitle{ text-align:center; font-size:13px; opacity:.85; margin-top:4px; }

      .grid{
        margin-top:20px;
        display:grid;
        grid-template-columns: 1fr 1fr 240px;
        column-gap: 34px;
        row-gap: 22px;
        align-items:start;
      }

      .secBlock{
        grid-column: 1 / 3;
        display:grid;
        grid-template-columns: 160px 1fr;
        row-gap: 12px;
        column-gap: 20px;
        padding-top: 6px;
      }
      .secLabel{ font-weight:900; font-size:22px; }
      .secVal{ font-weight:900; font-size:22px; letter-spacing:.4px; }

      .qrBox{
        grid-column: 3 / 4;
        border:2px solid #000;
        border-radius:14px;
        padding:14px;
        text-align:center;
      }
      .qrTitle{ font-size:16px; font-weight:800; margin-bottom:10px; }
      .qrBox img{ width:190px; height:190px; display:block; margin:0 auto; }
      .qrFallback{
        width:190px; height:190px; border:2px dashed #000;
        display:flex; align-items:center; justify-content:center;
        font-size:18px; font-weight:800; margin:0 auto;
      }

      .card{
        border:2px solid #000;
        border-radius:12px;
        padding:12px 14px;
        width:220px;
      }
      .cardLabel{ font-size:12px; font-weight:800; opacity:.85; margin-bottom:8px; }
      .cardValue{ font-size:44px; font-weight:900; line-height:1; }

      .rackCard{ grid-column: 1 / 2; margin-top: -160px; }
      .serialCard{ grid-column: 2 / 3; margin-top: -160px; }

      .info{
        margin-top:34px;
        display:grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 60px;
        row-gap: 12px;
      }

      .infoRow{
        display:grid;
        grid-template-columns: 140px 1fr;
        column-gap: 14px;
        align-items:baseline;
        margin-bottom: 10px;
      }
      .k{ font-weight:800; font-size:14px; }
      .v{ font-weight:800; font-size:14px; text-align:center; word-break: break-word; }
      .infoRight .v{ text-align:center; }
      .dash{ font-weight:900; }
    </style>

    <div class="a4">
      <h1 class="title">SFC Air FRMS</h1>
      <div class="subtitle">File & Record Management System</div>

      <div class="grid">
        <div class="secBlock">
          <div class="secLabel">Section:</div>
          <div class="secVal">${sectionName || "-"}</div>

          <div class="secLabel">Subcategory:</div>
          <div class="secVal">${subName || "-"}</div>
        </div>

        <div class="qrBox">
          <div class="qrTitle">QR CODE</div>
          <img src="${qrUrl}" alt="QR"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="qrFallback" style="display:none;">QR</div>
        </div>

        <div class="card rackCard">
          <div class="cardLabel">Rack No:</div>
          <div class="cardValue">${rackNo || "-"}</div>
        </div>

        <div class="card serialCard">
          <div class="cardLabel">Serial No:</div>
          <div class="cardValue">${serialNo || "-"}</div>
        </div>
      </div>

      <div class="info">
        <div class="infoLeft">
          <div class="infoRow"><div class="k">File Name:</div><div class="v">${fileName || "-"}</div></div>
          <div class="infoRow"><div class="k">BD No:</div><div class="v">${bdNo || "-"}</div></div>
          ${allocateTable ? `<div class="infoRow"><div class="k">Allocate Table</div><div class="v">${allocateTable}</div></div>` : ""}
          <div class="infoRow"><div class="k">Opening Date:</div><div class="v">${openingDate || "-"}</div></div>
        </div>

        <div class="infoRight">
          <div class="infoRow"><div class="k">Status:</div><div class="v">${statusText}</div></div>
          <div class="infoRow"><div class="k">Location:</div><div class="v">${locationText}</div></div>
          <div class="infoRow"><div class="k">Closing Date:</div><div class="v">${closingDate || '<span class="dash">-</span>'}</div></div>
        </div>
      </div>
    </div>
  `;
}
