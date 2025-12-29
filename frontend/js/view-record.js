console.log("view-record.js loaded");

let API_BASE = "";
let allRecords = [];
let singleMoveTargetId = null;
let singleMoveTargetRec = null; // ✅ keep selected record for status check

let currentPage = 1;
let totalPages = 1;
let totalRecords = 0;

let selectedSection = "";
let pageSize = 10;

let currentUser = localStorage.getItem("username") || "Unknown User";
let lastViewedRecordForPrint = null;

/* ================== TOAST ================== */
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.className = `toast ${type}`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 3000);
}

(() => {
  const style = document.createElement("style");
  style.textContent = `
    .toast {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: #10b981;
      color: white;
      border-radius: 8px;
      font-weight: 500;
      opacity: 0;
      transform: translateY(-20px);
      transition: all 0.3s ease;
      z-index: 9999;
    }
    .toast.error { background: #ef4444; }
    .toast.warn { background: #f59e0b; }
    .toast.show { opacity: 1; transform: translateY(0); }
    .icon-move.disabled { opacity: .4; cursor: not-allowed; }
  `;
  document.head.appendChild(style);
})();

function normalizeApiBase(apiBaseFromServer) {
  let base = (apiBaseFromServer || window.location.origin || "").trim();
  if (base.endsWith("/")) base = base.slice(0, -1);
  if (base.toLowerCase().endsWith("/api")) return base;
  return `${base}/api`;
}

/* ================== LOAD CONFIG ================== */
async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await res.json() : {};
    API_BASE = normalizeApiBase(data.apiBase);
    console.log("API Base loaded:", API_BASE);
  } catch {
    API_BASE = normalizeApiBase(null);
  }

  await Promise.all([loadSections(), loadCentralRacks()]);
  await fetchRecords(1);
}

/* ================== CENTRAL RACKS ================== */
async function loadCentralRacks() {
  try {
    const res = await fetch(`${API_BASE}/sections/central/racks`);
    const racks = await res.json();

    const singleSelect = document.getElementById("singleMoveRack");
    const bulkSelect = document.getElementById("bulkRackId");
    [singleSelect, bulkSelect].forEach((sel) => sel && (sel.innerHTML = ""));

    if (!Array.isArray(racks) || racks.length === 0) {
      const opt = new Option("-- No racks found --", "");
      if (singleSelect) singleSelect.add(opt);
      if (bulkSelect) bulkSelect.add(new Option(opt.text, opt.value));
      return;
    }

    racks.forEach((r) => {
      if (singleSelect) singleSelect.add(new Option(r.name, r.id));
      if (bulkSelect) bulkSelect.add(new Option(r.name, r.id));
    });
  } catch (err) {
    console.error("loadCentralRacks error:", err);
  }
}

/* ================== SECTIONS ================== */
async function loadSections() {
  try {
    const res = await fetch(`${API_BASE}/sections`);
    const data = await res.json();

    const select = document.getElementById("sectionFilter");
    if (!select) return;

    select.innerHTML = `<option value="">All Sections</option>`;
    data.forEach((s) => select.appendChild(new Option(s.name, s.id)));

    select.onchange = (e) => {
      selectedSection = e.target.value;
      currentPage = 1;
      fetchRecords(1);
    };
  } catch (err) {
    console.error("loadSections error:", err);
  }
}

/* ================== FETCH RECORDS ================== */
async function fetchRecords(page = 1) {
  try {
    const q = document.getElementById("searchInput")?.value?.trim() || "";
    const sectionParam = selectedSection ? `&section=${selectedSection}` : "";

    const res = await fetch(
      `${API_BASE}/records?page=${page}&limit=${pageSize}&q=${encodeURIComponent(q)}${sectionParam}`
    );
    const data = await res.json();

    allRecords = data.data || [];
    currentPage = data.page || 1;
    totalPages = data.totalPages || 1;
    totalRecords = data.total || allRecords.length;

    renderTable(allRecords);
    updatePaginationInfo();
    updatePaginationButtons();
  } catch (err) {
    console.error("fetchRecords error:", err);
  }
}

/* ================== RENDER TABLE ================== */
function renderTable(records) {
  const tbody = document.querySelector("#recordTable tbody");
  tbody.innerHTML = "";

  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;">No records found</td></tr>`;
    bindCheckAll();
    return;
  }

  const startIndex = (currentPage - 1) * pageSize;
  const canDelete = ["admin", "master"].includes(
    (localStorage.getItem("role") || "").toLowerCase()
  );

  records.forEach((rec, idx) => {
    const tr = document.createElement("tr");

    const sectionName = rec.Section?.name || "-";
    const subName = rec.Subcategory?.name || "-";
    const rackName = rec.Rack?.name || "-";
    const serialNo = rec.serial_no ?? "-";

    const locationClass = rec.status === "central" ? "central" : "section";
    const locationText = rec.status === "central" ? "In Central" : "In Section";

    const currentStatus = (rec.record_status || "ongoing").toLowerCase();
    const currentClass = currentStatus === "closed" ? "closed" : "ongoing";
    const currentText = currentStatus === "closed" ? "Closed" : "Ongoing";

    const openingDate = rec.opening_date || "-";
    const closingDate = rec.closing_date || "-";

    const tableSerial = startIndex + idx + 1;

    tr.innerHTML = `
<td>${tableSerial}</td>
  <td><input type="checkbox" class="record-select" data-id="${rec.id}"></td>
 
 <td class="file-cell" title="View details">${rec.file_name}</td>


  <td>${rec.bd_no || "-"}</td>
  <td>${sectionName}</td>
  <td>${subName}</td>

  <!-- 🔴 Rack -->
  <td class="rack-red">${rackName}</td>

  <!-- 🔴 Rack Serial -->
  <td class="rsl-red">${serialNo}</td>

  <td><span class="status ${currentClass}">${currentText}</span></td>
  <td><span class="status ${locationClass}">${locationText}</span></td>
  <td>${openingDate}</td>
  <td>${closingDate}</td>

  <td class="action-icons">
    <i class="icon-edit" data-id="${rec.id}">✏️</i>
    <i class="icon-move" data-id="${rec.id}">🚚</i>
    ${canDelete ? `<i class="icon-delete" data-id="${rec.id}">🗑️</i>` : ""}
  </td>
    `;

    // ✅ Row click = details modal
    const fileCell = tr.querySelector(".file-cell");
    fileCell.addEventListener("click", (e) => {
      e.stopPropagation();
      showDetails(rec);
    });

    // Edit click
    tr.querySelector(".icon-edit")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(rec);
    });

    // Move click (only if CLOSED)
    const moveIcon = tr.querySelector(".icon-move");
    const isClosed = (rec.record_status || "ongoing").toLowerCase() === "closed";

    if (moveIcon) {
      if (!isClosed) {
        moveIcon.classList.add("disabled");
        moveIcon.title = "Only CLOSED records can be moved to Central";
      } else {
        moveIcon.title = "Move to Central";
      }

      moveIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!isClosed) {
          showToast("⛔ Ongoing record কে Central এ move করা যাবে না। আগে Closed করুন।", "error");
          return;
        }
        openSingleMove(rec);
      });
    }

    // Delete click
    tr.querySelector(".icon-delete")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Are you sure you want to delete this record?")) return;
      try {
        const res = await fetch(`${API_BASE}/records/delete/${rec.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: localStorage.getItem("role") }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        showToast(data.message);
        fetchRecords(currentPage);
      } catch (err) {
        showToast("❌ " + err.message, "error");
      }
    });

    tbody.appendChild(tr);
  });

  bindCheckAll();
}

/* ================== PAGINATION UI ================== */
function updatePaginationInfo() {
  const el = document.getElementById("paginationInfo");
  if (!el) return;
  const start = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalRecords);
  el.textContent = `Showing ${start}-${end} of ${totalRecords} records`;
}

function updatePaginationButtons() {
  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");
  const pageDisplay = document.getElementById("pageDisplay");

  if (pageDisplay) pageDisplay.textContent = `Page ${currentPage} / ${totalPages}`;

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

/* ================== EDIT MODAL ================== */
function openEditModal(rec) {
  document.getElementById("editRecordId").value = rec.id;
  document.getElementById("editFileName").value = rec.file_name;
  document.getElementById("editBdNo").value = rec.bd_no || "";
  document.getElementById("editDescription").value = rec.description || "";
  document.getElementById("editRecordModal").style.display = "flex";
}

function closeEditModal() {
  document.getElementById("editRecordModal").style.display = "none";
}

/* submit edit */
function bindEditForm() {
  const editForm = document.getElementById("editRecordForm");
  if (!editForm) return;

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editRecordId").value;
    const file_name = document.getElementById("editFileName").value.trim();
    const bd_no = document.getElementById("editBdNo").value.trim();
    const description = document.getElementById("editDescription").value.trim();

    try {
      const res = await fetch(`${API_BASE}/records/update/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name, bd_no, description, updated_by: currentUser }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("✅ Record updated successfully!");
      closeEditModal();
      fetchRecords(currentPage);
    } catch (err) {
      showToast("❌ " + err.message, "error");
    }
  });
}

/* ================== SINGLE MOVE ================== */
function openSingleMove(rec) {
  // ✅ extra guard (already checked in table click)
  const isClosed = (rec.record_status || "ongoing").toLowerCase() === "closed";
  if (!isClosed) {
    showToast("⛔ Ongoing record কে Central এ move করা যাবে না। আগে Closed করুন।", "error");
    return;
  }

  singleMoveTargetId = rec.id;
  singleMoveTargetRec = rec;

  document.getElementById("singleMoveModal").style.display = "flex";

  const prevSection = rec.Section?.name || rec.previous_section_id || "-";
  const prevRack = rec.Rack?.name || rec.previous_rack_id || "-";
  document.getElementById("currentLocation").textContent = `${prevSection} → Rack ${prevRack}`;

  computeSingleAutoSerial();
}

async function computeSingleAutoSerial() {
  const rackId = document.getElementById("singleMoveRack")?.value;
  const serialInput = document.getElementById("singleMoveSerial");
  if (!rackId) return (serialInput.value = "");

  try {
    const res = await fetch(`${API_BASE}/records/by-rack/${rackId}`);
    const records = await res.json();
    const used = records
      .map((r) => parseInt(r.serial_no))
      .filter(Boolean)
      .sort((a, b) => a - b);

    let next = 1;
    for (const n of used) {
      if (n === next) next++;
      else break;
    }
    serialInput.value = next;
  } catch {
    serialInput.value = "1";
  }
}

function closeSingleMove() {
  singleMoveTargetId = null;
  singleMoveTargetRec = null;
  document.getElementById("singleMoveModal").style.display = "none";
}

/* confirm single move */
async function bindSingleMove() {
  const rackSelect = document.getElementById("singleMoveRack");
  const confirmBtn = document.getElementById("singleMoveConfirm");

  rackSelect?.addEventListener("change", computeSingleAutoSerial);

  confirmBtn?.addEventListener("click", async () => {
    // ✅ block if somehow target not closed
    const isClosed = (singleMoveTargetRec?.record_status || "ongoing").toLowerCase() === "closed";
    if (!isClosed) {
      showToast("⛔ Only CLOSED records can be moved to Central.", "error");
      return;
    }

    const rackId = rackSelect.value;
    if (!rackId) {
      showToast("⚠️ Please select a target rack", "warn");
      return;
    }

    const serial = document.getElementById("singleMoveSerial").value || "auto";

    try {
      const res = await fetch(`${API_BASE}/records/move/${singleMoveTargetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newRackId: rackId,
          startSerialNo: serial,
          moved_by: currentUser,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast("✅ Moved successfully!");
      closeSingleMove();
      fetchRecords(currentPage);
    } catch (err) {
      showToast("❌ " + err.message, "error");
    }
  });
}

/* ================== BULK MOVE ================== */
function openBulkMove() {
  const selectedIds = [...document.querySelectorAll(".record-select:checked")].map((cb) =>
    parseInt(cb.dataset.id, 10)
  );

  if (selectedIds.length === 0) return showToast("⚠️ Please select at least one record!", "warn");

  // ✅ Only CLOSED can bulk-move
  const selectedRecords = allRecords.filter((r) => selectedIds.includes(r.id));
  const closedIds = selectedRecords
    .filter((r) => (r.record_status || "ongoing").toLowerCase() === "closed")
    .map((r) => r.id);

  if (closedIds.length === 0) {
    showToast("⛔ Selected records are Ongoing. Only CLOSED records can be moved.", "error");
    return;
  }

  const skipped = selectedIds.length - closedIds.length;
  if (skipped > 0) {
    showToast(`⚠️ ${skipped} ongoing record(s) skip হবে। Only CLOSED move হবে।`, "warn");
  }

  const modal = document.getElementById("bulkMoveModal");
  modal.dataset.ids = JSON.stringify(closedIds);
  modal.style.display = "flex";
  computeBulkAutoSerial();
}

async function computeBulkAutoSerial() {
  const rackId = document.getElementById("bulkRackId")?.value;
  const serialInput = document.getElementById("bulkStartSerial");
  if (!rackId) return (serialInput.value = "");

  try {
    const res = await fetch(`${API_BASE}/records/by-rack/${rackId}`);
    const records = await res.json();
    const used = records
      .map((r) => parseInt(r.serial_no))
      .filter(Boolean)
      .sort((a, b) => a - b);

    let next = 1;
    for (const n of used) {
      if (n === next) next++;
      else break;
    }
    serialInput.value = next;
  } catch {
    serialInput.value = "1";
  }
}

function closeBulkMove() {
  document.getElementById("bulkMoveModal").style.display = "none";
}

function bindBulkMove() {
  document.getElementById("openBulkMove")?.addEventListener("click", openBulkMove);
  document.getElementById("bulkCancel")?.addEventListener("click", closeBulkMove);
  document.getElementById("bulkClose")?.addEventListener("click", closeBulkMove);
  document.getElementById("bulkRackId")?.addEventListener("change", computeBulkAutoSerial);

  document.getElementById("bulkConfirm")?.addEventListener("click", async () => {
    const modal = document.getElementById("bulkMoveModal");
    const ids = JSON.parse(modal.dataset.ids || "[]");

    if (!ids.length) {
      showToast("⛔ No CLOSED records selected for bulk move.", "error");
      return;
    }

    const rackId = document.getElementById("bulkRackId").value;
    const startSerial = document.getElementById("bulkStartSerial").value || "auto";

    try {
      const res = await fetch(`${API_BASE}/records/bulk-move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordIds: ids,
          newRackId: rackId,
          startSerialNo: startSerial,
          moved_by: currentUser,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message || "✅ Bulk moved!");
      closeBulkMove();
      fetchRecords(currentPage);
    } catch (err) {
      showToast("❌ " + err.message, "error");
    }
  });
}

/* ================== CHECK ALL ================== */
function bindCheckAll() {
  const master = document.getElementById("checkAll");
  const boxes = document.querySelectorAll(".record-select");
  if (!master) return;

  master.checked = false;
  master.indeterminate = false;

  master.onchange = () => boxes.forEach((cb) => (cb.checked = master.checked));
}

/* ================== DETAILS MODAL ================== */
function showDetails(rec) {
  lastViewedRecordForPrint = rec;

  const modal = document.getElementById("recordModal");
  const body = document.getElementById("modalBody");

  const section = rec.Section?.name || "-";
  const subcat = rec.Subcategory?.name || "-";
  const rack = rec.Rack?.name || "-";

  const prev = rec.previous_location || {};
  const prevSection = prev.section_name || "-";
  const prevSubcat = prev.subcategory_name || "-";
  const prevRack = prev.rack_name || "-";

  const serial = rec.serial_no ?? "-";
  const location = rec.status === "central" ? "In Central" : "In Section";

  const currentStatus = (rec.record_status || "ongoing").toLowerCase();
  const statusText = currentStatus === "closed" ? "Closed" : "Ongoing";
  const openingDate = rec.opening_date || "-";
  const closingDate = rec.closing_date || "-";

  // ✅ Allocate Table (show only if exists)
  const allocateTable = (rec.allocate_table || "").toString().trim();
  const allocateHtml = allocateTable
    ? `<p><strong>🧮 Allocate Table:</strong> ${allocateTable}</p>`
    : "";

  body.innerHTML = `
    <div class="block">
      <p><strong>📁 File Name:</strong> ${rec.file_name}</p>
      <p><strong>🆔 BD No:</strong> ${rec.bd_no || "-"}</p>
      ${allocateHtml}
    </div>

    <div class="block">
      <p><strong>📍 Current Location</strong></p>
      <p>• <strong>Section:</strong> ${section}</p>
      <p>• <strong>Subcategory:</strong> ${subcat}</p>
      <p>• <strong>Rack:</strong> ${rack}</p>
      <p>• <strong>Serial No:</strong> <strong>${serial}</strong></p>
    </div>

    <div class="block">
      <p><strong>⏪ Previous Location</strong></p>
      <p>• <strong>Section:</strong> ${prevSection}</p>
      <p>• <strong>Subcategory:</strong> ${prevSubcat}</p>
      <p>• <strong>Rack:</strong> ${prevRack}</p>
    </div>

    <div class="block">
      <p><strong>👤 Added By:</strong> ${rec.added_by || "-"}</p>
      <p><strong>🚚 Moved By:</strong> ${rec.moved_by || "-"}</p>
      <p><strong>🧾 Current Status:</strong> ${statusText}</p>
      <p><strong>📌 Location:</strong> ${location}</p>
      <p><strong>📅 Opening Date:</strong> ${openingDate}</p>
      <p><strong>📅 Closing Date:</strong> ${closingDate}</p>
    </div>
  `;

  // --- workflow status UI bind ---
  bindWorkflowControls(rec);

  modal.style.display = "flex";
}


/* ================== PRINT (View) ================== */
function startPrintFromView() {
  if (!lastViewedRecordForPrint) {
    alert("No record selected for print");
    return;
  }

  const r = lastViewedRecordForPrint;

  const createdAt = r.createdAt ? new Date(r.createdAt).toLocaleString() : "";

  const currentStatus = (r.record_status || "ongoing").toLowerCase();
  const statusText = currentStatus === "closed" ? "Closed" : "Ongoing";
  const locationText = r.status === "central" ? "In Central" : "In Section";

  const sectionName = r.Section?.name || "-";
  const subName = r.Subcategory?.name || "-";
  const rackNo = r.Rack?.name || "-";
  const serialNo = r.serial_no ?? "-";
  const bdNo = r.bd_no || "-";
  const fileName = r.file_name || "-";
  const openingDate = r.opening_date || "-";
  const closingDate = r.closing_date || "-";

  // ✅ QR contains everything (same idea as add-record)
  const qrText = `
SFC Air FRMS
File Name: ${fileName}
BD No: ${bdNo}
Section: ${sectionName}
Subcategory: ${subName}
Rack No: ${rackNo}
Serial No: ${serialNo}
Status: ${statusText}
Location: ${locationText}
Opening Date: ${openingDate}
Closing Date: ${closingDate}
Created At: ${createdAt}
Description: ${r.description || ""}
`.trim();

  const qrUrl =
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrText)}`;

  // ✅ A4 HTML (screenshot style)
  const html = `
    <div class="a4">
      <h1 class="title">SFC Air FRMS</h1>
      <div class="subtitle">File & Record Management System</div>

      <div class="grid">
        <!-- Section/Subcategory -->
        <div class="secBlock">
          <div class="secLabel">Section :</div>
          <div class="secVal">${sectionName}</div>

          <div class="secLabel">Subcategory:</div>
          <div class="secVal">${subName}</div>
        </div>

        <!-- QR -->
        <div class="qrBox">
          <div class="qrTitle">QR CODE</div>
          <img src="${qrUrl}" alt="QR"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="qrFallback" style="display:none;">QR</div>
        </div>

        <!-- Rack + Serial (moved up a bit) -->
        <div class="card rackCard">
          <div class="cardLabel">Rack No.</div>
          <div class="cardValue">${rackNo}</div>
        </div>

        <div class="card serialCard">
          <div class="cardLabel">Serial No.</div>
          <div class="cardValue">${serialNo}</div>
        </div>
      </div>

      <!-- Bottom info -->
      <div class="info">
        <div class="infoLeft">
          <div class="infoRow"><div class="k">File Name :</div><div class="v">${fileName}</div></div>
          <div class="infoRow"><div class="k">File/BD No :</div><div class="v">${bdNo}</div></div>
          <div class="infoRow"><div class="k">Opening Date :</div><div class="v">${openingDate}</div></div>
        </div>

        <div class="infoRight">
          <div class="infoRow"><div class="k">Status :</div><div class="v">${statusText}</div></div>
          <div class="infoRow"><div class="k">Location :</div><div class="v">${locationText}</div></div>
          <div class="infoRow"><div class="k">Closing Date :</div><div class="v">${closingDate || "-"}</div></div>
        </div>
      </div>
    </div>
  `;

  let frame = document.getElementById("printFrame");
  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = "printFrame";
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.setAttribute("aria-hidden", "true");
    document.body.appendChild(frame);
  }

  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Record Print</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body{ font-family: Arial, sans-serif; color:#000; margin:0; }
          .a4{ width:100%; }

          .title{
            text-align:center;
            font-weight:900;
            font-size:30px;
            margin:0;
            letter-spacing:.5px;
          }
          .subtitle{
            text-align:center;
            font-size:13px;
            opacity:.85;
            margin-top:4px;
          }

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
          .qrTitle{ font-size:16px; font-weight:900; margin-bottom:10px; }
          .qrBox img{ width:190px; height:190px; display:block; margin:0 auto; }
          .qrFallback{
            width:190px; height:190px; border:2px dashed #000;
            display:flex; align-items:center; justify-content:center;
            font-size:18px; font-weight:900; margin:0 auto;
          }

          .card{
            border:2px solid #000;
            border-radius:12px;
            padding:12px 14px;
            width: 220px;
          }
          .cardLabel{ font-size:12px; font-weight:800; opacity:.85; margin-bottom:8px; }
          .cardValue{ font-size:44px; font-weight:900; line-height:1; }

          .rackCard{ grid-column: 1 / 2; margin-top: -160px; }  /* ✅ move up */
          .serialCard{ grid-column: 2 / 3; margin-top: -160px; }/* ✅ move up */

          .info{
            margin-top: 34px;
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
          .k{ font-weight:900; font-size:14px; }
          .v{ font-weight:800; font-size:14px; text-align:center; word-break: break-word; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  doc.close();

  frame.onload = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };
}

window.addEventListener("afterprint", () => {
  const root = document.getElementById("printRoot");
  if (root) root.innerHTML = "";
  document.body.classList.remove("printing");
});

function closeModal() {
  document.getElementById("recordModal").style.display = "none";
}

// Click outside modal to close
window.addEventListener("click", (e) => {
  const modal = document.getElementById("recordModal");
  if (e.target === modal) closeModal();
});

// ✅ ESC press to close
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

/* ================== SEARCH (FIX) ================== */
function bindSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;

  let t = null;
  input.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      currentPage = 1;
      fetchRecords(1);
    }, 300);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      currentPage = 1;
      fetchRecords(1);
    }
  });
}

/* ================== Date helpers ================== */
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function setWfMsg(text, ok = true) {
  const el = document.getElementById("wfClosingMsg");
  if (!el) return;
  el.textContent = text || "";
  if (!text) return;
  el.style.color = ok ? "green" : "red";
}

/* ================== WORKFLOW CONTROLS (Details Modal) ================== */
function bindWorkflowControls(rec) {
  const sel = document.getElementById("wfStatusSelect");
  const closingWrap = document.getElementById("wfClosingWrap");
  const closingInput = document.getElementById("wfClosingDate");
  const saveBtn = document.getElementById("wfSaveBtn");

  if (!sel || !closingWrap || !closingInput || !saveBtn) return;

  const current = (rec.record_status || "ongoing").toLowerCase();
  sel.value = current;

  closingInput.max = todayISO();
  closingInput.value = rec.closing_date || "";

  function sync() {
    const v = (sel.value || "ongoing").toLowerCase();
    if (v === "closed") {
      closingWrap.style.display = "";
    } else {
      closingWrap.style.display = "none";
      closingInput.value = "";
      setWfMsg("", true);
    }
  }
  sync();

  sel.onchange = () => sync();

  closingInput.oninput = () => {
    if (!closingInput.value) return setWfMsg("", true);
    if (closingInput.value > todayISO()) return setWfMsg("❌ আজকের পরের date দেওয়া যাবে না", false);
    if (rec.opening_date && closingInput.value < rec.opening_date) {
      return setWfMsg("❌ Opening date এর আগে closing দেওয়া যাবে না", false);
    }
    setWfMsg("✅ Closing date ঠিক আছে", true);
  };

  saveBtn.onclick = async () => {
    const v = (sel.value || "ongoing").toLowerCase();
    let closing_date = closingInput.value || null;

    if (v === "closed") {
      if (!closing_date) return showToast("⚠️ Closed হলে Closing Date দিতে হবে", "error");
      if (closing_date > todayISO())
        return showToast("⚠️ আজকের পরের closing date দেওয়া যাবে না", "error");
      if (rec.opening_date && closing_date < rec.opening_date) {
        return showToast("⚠️ Closing date, Opening date এর আগে হতে পারবে না", "error");
      }
    } else {
      closing_date = null;
    }

    try {
      const res = await fetch(`${API_BASE}/records/workflow/${rec.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record_status: v,
          closing_date,
          updated_by: currentUser,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      showToast("✅ Status updated");

      rec.record_status = v;
      rec.closing_date = closing_date;

      fetchRecords(currentPage);
    } catch (err) {
      showToast("❌ " + err.message, "error");
    }
  };
}

/* ================== PAGE SIZE (FIX) ================== */
function bindPageSize() {
  const sel = document.getElementById("pageSize");
  if (!sel) return;

  pageSize = parseInt(sel.value) || 10;

  sel.addEventListener("change", () => {
    pageSize = parseInt(sel.value) || 10;
    currentPage = 1;
    fetchRecords(1);
  });
}

/* ================== PAGINATION BUTTONS ================== */
function bindPaginationButtons() {
  document.getElementById("prevPage")?.addEventListener("click", () => {
    if (currentPage > 1) fetchRecords(currentPage - 1);
  });
  document.getElementById("nextPage")?.addEventListener("click", () => {
    if (currentPage < totalPages) fetchRecords(currentPage + 1);
  });
}

/* ================== EXPORT CSV (NEW) ================== */
function exportToCSV() {
  if (!allRecords.length) return showToast("No records to export", "error");

  const headers = [
    "File Name",
    "BD No",
    "Section",
    "Subcategory",
    "Rack",
    "Serial No",
    "Added By",
    "Moved By",
    "Current Status",
    "Location",
    "Opening Date",
    "Closing Date",
  ];

  const rows = allRecords.map((r) => [
    r.file_name || "",
    r.bd_no || "",
    r.Section?.name || "",
    r.Subcategory?.name || "",
    r.Rack?.name || "",
    r.serial_no ?? "",
    r.added_by || "",
    r.moved_by || "",
    (r.record_status || "ongoing").toLowerCase(),
    r.status === "central" ? "central" : "active",
    r.opening_date || "",
    r.closing_date || "",
  ]);

  let csv = headers.join(",") + "\n";
  csv += rows
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `records_page_${currentPage}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

window.exportToCSV = exportToCSV;

/* ================== INIT ================== */
document.addEventListener("DOMContentLoaded", () => {
  bindSearch();
  bindPageSize();
  bindPaginationButtons();
  bindEditForm();
  bindSingleMove();
  bindBulkMove();

  document
    .getElementById("printFromViewBtn")
    ?.addEventListener("click", startPrintFromView);

  loadConfig();
});
