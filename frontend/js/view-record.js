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
  await fetchRecords();
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
      fetchRecords();
    };
  } catch (err) {
    console.error("loadSections error:", err);
  }
}

/* ================== FETCH RECORDS ================== */
async function fetchRecords(page = 1) {
  try {
    const q = document.getElementById("searchInput")?.value || "";
    const sectionParam = selectedSection ? `&section=${selectedSection}` : "";
    const res = await fetch(`${API_BASE}/records?page=${page}&limit=${pageSize}&q=${encodeURIComponent(q)}${sectionParam}`);
    const data = await res.json();
    allRecords = data.data || [];
    currentPage = data.page || 1;
    totalPages = data.totalPages || 1;
    totalRecords = data.total || allRecords.length;
    renderTable(allRecords);
    updatePaginationInfo();
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
  const canDelete = ["admin", "master"].includes(localStorage.getItem("role")?.toLowerCase() || "");

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
      <td>${rec.file_name}</td>
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

document.addEventListener("DOMContentLoaded", () => {
  const editForm = document.getElementById("editRecordForm");
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("editRecordId").value;
      const file_name = document.getElementById("editFileName").value;
      const bd_no = document.getElementById("editBdNo").value;
      const description = document.getElementById("editDescription").value;

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
});



/* ================== SINGLE MOVE ================== */
function openSingleMove(rec) {
  singleMoveTargetId = rec.id;
  document.getElementById("singleMoveModal").style.display = "flex";
  document.getElementById("currentLocation").textContent = `${rec.Section?.name || "-"} → Rack ${rec.Rack?.name || "-"}`;
  computeSingleAutoSerial();
}

async function computeSingleAutoSerial() {
  const rackId = document.getElementById("singleMoveRack")?.value;
  const serialInput = document.getElementById("singleMoveSerial");
  if (!rackId) return (serialInput.value = "");
  try {
    const res = await fetch(`${API_BASE}/records/by-rack/${rackId}`);
    const records = await res.json();
    const used = records.map((r) => parseInt(r.serial_no)).filter(Boolean).sort((a, b) => a - b);
    let next = 1;
    for (const n of used) if (n === next) next++; else break;
    serialInput.value = next;
  } catch {
    serialInput.value = "1";
  }
}

document.getElementById("singleMoveRack")?.addEventListener("change", computeSingleAutoSerial);

document.getElementById("singleMoveConfirm")?.addEventListener("click", async () => {
  const rackId = document.getElementById("singleMoveRack").value;
  const serial = document.getElementById("singleMoveSerial").value || "auto";
  try {
    const res = await fetch(`${API_BASE}/records/move/${singleMoveTargetId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newRackId: rackId, startSerialNo: serial, moved_by: currentUser }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast("✅ Moved successfully!");
    document.getElementById("singleMoveModal").style.display = "none";
    fetchRecords(currentPage);
  } catch (err) {
    showToast("❌ " + err.message, "error");
  }
});

function closeSingleMove() {
  singleMoveTargetId = null;
  document.getElementById("singleMoveModal").style.display = "none";
}

/* ================== BULK MOVE ================== */
document.getElementById("openBulkMove")?.addEventListener("click", openBulkMove);
document.getElementById("bulkCancel")?.addEventListener("click", closeBulkMove);
document.getElementById("bulkClose")?.addEventListener("click", closeBulkMove);

function openBulkMove() {
  const selected = [...document.querySelectorAll(".record-select:checked")].map((cb) => parseInt(cb.dataset.id));
  if (selected.length === 0) return alert("⚠️ Please select at least one record!");
  document.getElementById("bulkMoveModal").dataset.ids = JSON.stringify(selected);
  document.getElementById("bulkMoveModal").style.display = "flex";
  computeBulkAutoSerial();
}

async function computeBulkAutoSerial() {
  const rackId = document.getElementById("bulkRackId")?.value;
  const serialInput = document.getElementById("bulkStartSerial");
  if (!rackId) return (serialInput.value = "");
  try {
    const res = await fetch(`${API_BASE}/records/by-rack/${rackId}`);
    const records = await res.json();
    const used = records.map((r) => parseInt(r.serial_no)).filter(Boolean).sort((a, b) => a - b);
    let next = 1;
    for (const n of used) if (n === next) next++; else break;
    serialInput.value = next;
  } catch {
    serialInput.value = "1";
  }
}

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
      body: JSON.stringify({ recordIds: ids, newRackId: rackId, startSerialNo: startSerial, moved_by: currentUser }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(data.message);
    closeBulkMove();
    fetchRecords(currentPage);
  } catch (err) {
    showToast("❌ " + err.message, "error");
  }
});

function closeBulkMove() {
  document.getElementById("bulkMoveModal").style.display = "none";
}

/* ================== OTHERS ================== */
function bindCheckAll() {
  const master = document.getElementById("checkAll");
  const boxes = document.querySelectorAll(".record-select");
  if (!master) return;
  master.checked = false;
  master.indeterminate = false;
  master.onchange = () => boxes.forEach((cb) => (cb.checked = master.checked));
}

function showDetails(rec) {
  const modal = document.getElementById("recordModal");
  const body = document.getElementById("modalBody");
  const section = rec.Section?.name || "-";
  const rack = rec.Rack?.name || "-";
  const serial = rec.serial_no ?? "-";
  const status = rec.status === "central" ? "In Central" : "In Section";
  let html = `
    <p><strong>File Name:</strong> ${rec.file_name}</p>
    <p><strong>BD No:</strong> ${rec.bd_no || "-"}</p>
    <p><strong>Section:</strong> ${section}</p>
    <p><strong>Rack:</strong> ${rack}</p>
    <p><strong>Serial:</strong> ${serial}</p>
    <p><strong>Added By:</strong> ${rec.added_by || "-"}</p>
    <p><strong>Status:</strong> ${status}</p>`;
  body.innerHTML = html;
  modal.style.display = "flex";
}

function closeModal() {
  document.getElementById("recordModal").style.display = "none";
}

/* ================== INIT ================== */
document.addEventListener("DOMContentLoaded", () => {
  loadConfig();
});
