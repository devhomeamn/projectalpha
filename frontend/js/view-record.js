console.log("view-record.js loaded");

let API_BASE = "";
let allRecords = [];
let singleMoveTargetId = null;

let currentPage = 1;
let totalPages = 1;
let totalRecords = 0;

let selectedSection = "";
let pageSize = 10;

let currentUser = localStorage.getItem("username") || "Unknown User";

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
    .toast.show { opacity: 1; transform: translateY(0); }
  `;
  document.head.appendChild(style);
})();

/* ================== LOAD CONFIG ================== */
async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    API_BASE = data.apiBase ? `${data.apiBase}/api` : `${window.location.origin}/api`;
    console.log("API Base loaded:", API_BASE);
  } catch {
    API_BASE = `${window.location.origin}/api`;
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
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;">No records found</td></tr>`;
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
    const statusClass = rec.status === "central" ? "central" : "section";
    const statusText = rec.status === "central" ? "In Central" : "In Section";
    const tableSerial = startIndex + idx + 1;

    tr.innerHTML = `
      <td>${tableSerial}</td>
      <td><input type="checkbox" class="record-select" data-id="${rec.id}"></td>
      <td class="file-cell" style="cursor:pointer; font-weight:600; color:#111827;">
        ${rec.file_name}
      </td>
      <td>${rec.bd_no || "-"}</td>
      <td>${sectionName}</td>
      <td>${subName}</td>
      <td>${rackName}</td>
      <td><strong>${serialNo}</strong></td>
      <td>${rec.added_by || "-"}</td>
      <td>${rec.moved_by || "-"}</td>
      <td><span class="status ${statusClass}">${statusText}</span></td>
      <td class="action-icons">
        <i class="icon-edit" data-id="${rec.id}" title="Edit">✏️</i>
        <i class="icon-move" data-id="${rec.id}" title="Move">🚚</i>
        ${canDelete ? `<i class="icon-delete" data-id="${rec.id}" title="Delete">🗑️</i>` : ""}
      </td>
    `;

    // ✅ Row click = Show details modal
    tr.addEventListener("click", () => showDetails(rec));

    // Edit click
    tr.querySelector(".icon-edit")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(rec);
    });

    // Move click
    tr.querySelector(".icon-move")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openSingleMove(rec);
    });

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
  singleMoveTargetId = rec.id;
  document.getElementById("singleMoveModal").style.display = "flex";

  const prevSection = rec.Section?.name || rec.previous_section_id || "-";
  const prevRack = rec.Rack?.name || rec.previous_rack_id || "-";
  document.getElementById("currentLocation").textContent =
    `${prevSection} → Rack ${prevRack}`;

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
  document.getElementById("singleMoveModal").style.display = "none";
}

/* confirm single move */
async function bindSingleMove() {
  const rackSelect = document.getElementById("singleMoveRack");
  const confirmBtn = document.getElementById("singleMoveConfirm");

  rackSelect?.addEventListener("change", computeSingleAutoSerial);

  confirmBtn?.addEventListener("click", async () => {
    const rackId = rackSelect.value;
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
  const selected = [...document.querySelectorAll(".record-select:checked")]
    .map((cb) => parseInt(cb.dataset.id));

  if (selected.length === 0) return alert("⚠️ Please select at least one record!");

  const modal = document.getElementById("bulkMoveModal");
  modal.dataset.ids = JSON.stringify(selected);
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
  const modal = document.getElementById("recordModal");
  const body = document.getElementById("modalBody");

  const section = rec.Section?.name || "-";
  const subcat  = rec.Subcategory?.name || "-";
  const rack    = rec.Rack?.name || "-";

  // ✅ backend enhanced field
  const prev = rec.previous_location || {};
  const prevSection = prev.section_name || "-";
  const prevSubcat  = prev.subcategory_name || "-";
  const prevRack    = prev.rack_name || "-";

  const serial = rec.serial_no ?? "-";
  const status = rec.status === "central" ? "In Central" : "In Section";

  body.innerHTML = `
    <p><strong>File Name:</strong> ${rec.file_name}</p>
    <p><strong>BD No:</strong> ${rec.bd_no || "-"}</p>

    <hr style="margin:10px 0;">

    <p><strong>Current Section:</strong> ${section}</p>
    <p><strong>Current Subcategory:</strong> ${subcat}</p>
    <p><strong>Current Rack:</strong> ${rack}</p>
    <p><strong>Current Serial:</strong> ${serial}</p>

    <hr style="margin:10px 0;">

    <p><strong>Previous Section:</strong> ${prevSection}</p>
    <p><strong>Previous Subcategory:</strong> ${prevSubcat}</p>
    <p><strong>Previous Rack:</strong> ${prevRack}</p>

    <hr style="margin:10px 0;">

    <p><strong>Added By:</strong> ${rec.added_by || "-"}</p>
    <p><strong>Moved By:</strong> ${rec.moved_by || "-"}</p>
    <p><strong>Status:</strong> ${status}</p>
  `;

  modal.style.display = "flex";
}

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
    }, 300); // debounce
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      currentPage = 1;
      fetchRecords(1);
    }
  });
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
    "File Name","BD No","Section","Subcategory","Rack",
    "Serial No","Added By","Moved By","Status"
  ];

  const rows = allRecords.map(r => ([
    r.file_name || "",
    r.bd_no || "",
    r.Section?.name || "",
    r.Subcategory?.name || "",
    r.Rack?.name || "",
    r.serial_no ?? "",
    r.added_by || "",
    r.moved_by || "",
    r.status || "active",
  ]));

  let csv = headers.join(",") + "\n";
  csv += rows.map(row =>
    row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
  ).join("\n");

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

/* make export accessible from button onclick */
window.exportToCSV = exportToCSV;

/* ================== INIT ================== */
document.addEventListener("DOMContentLoaded", () => {
  bindSearch();
  bindPageSize();
  bindPaginationButtons();
  bindEditForm();
  bindSingleMove();
  bindBulkMove();
  loadConfig();
});
