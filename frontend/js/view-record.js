console.log("view-record.js loaded");

let API_BASE = "";
let allRecords = [];
let singleMoveTargetId = null;
let currentPage = 1;
let totalPages = 1;
let totalRecords = 0;
let selectedSection = "";
let pageSize = 10; // default per-page size
let currentUser = localStorage.getItem("username") || "Unknown User"; // 🧩 logged user (optional)


// ✅ Simple Toast Notification
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.className = `toast ${type}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100); // animate in
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 💅 Add some quick CSS in your <style> (view-record.html)
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


// ================== LOAD CONFIG ==================
async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    API_BASE = data.apiBase ? `${data.apiBase}/api` : `${window.location.origin}/api`;
    console.log("API Base loaded:", API_BASE);
  } catch (err) {
    console.error("Could not load backend config:", err);
    API_BASE = `${window.location.origin}/api`;
  }

  await Promise.all([loadSections(), loadCentralRacks()]);
  await fetchRecords();
}

// ================== FETCH RECORDS ==================
async function fetchRecords(page = 1) {
  try {
    const q = document.getElementById("searchInput")?.value || "";
    const sectionParam = selectedSection ? `&section=${selectedSection}` : "";
    const res = await fetch(`${API_BASE}/records?page=${page}&limit=${pageSize}&q=${q}${sectionParam}`);
    const data = await res.json();

    allRecords = data.data || [];
    currentPage = data.page || 1;
    totalPages = data.totalPages || 1;
    totalRecords = data.total || allRecords.length;

    renderTable(allRecords);
    updatePaginationInfo();
  } catch (err) {
    console.error("Failed to fetch records:", err);
  }
}

// ================== LOAD SECTION FILTER ==================
async function loadSections() {
  try {
    const res = await fetch(`${API_BASE}/sections`);
    const data = await res.json();
    const select = document.getElementById("sectionFilter");
    if (!select) return;
    select.innerHTML = `<option value="">All Sections</option>`;
    data.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      select.appendChild(opt);
    });

    select.addEventListener("change", (e) => {
      selectedSection = e.target.value;
      currentPage = 1;
      fetchRecords();
    });
  } catch (err) {
    console.error("Failed to load sections:", err);
  }
}

// ================== RENDER TABLE ==================
function renderTable(records) {
  const tbody = document.querySelector("#recordTable tbody");
  tbody.innerHTML = "";

  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;">No records found</td></tr>`;
    return;
  }

  const startIndex = (currentPage - 1) * pageSize;

  records.forEach((rec, idx) => {
    const tr = document.createElement("tr");
    const sectionName = rec.Section ? rec.Section.name : "-";
    const subName = rec.Subcategory ? rec.Subcategory.name : "-";
    const rackName = rec.Rack ? rec.Rack.name : "-";
    const serialNo = rec.serial_no != null ? rec.serial_no : "-";
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
      <td>
        ${
          rec.status === "central"
            ? `<button class="btn-move" disabled>Centralized</button>`
            : `<button class="btn-move" data-id="${rec.id}">Move</button>`
        }
      </td>
    `;

    tr.addEventListener("click", (e) => {
      if (e.target.tagName !== "BUTTON" && e.target.tagName !== "INPUT") showDetails(rec);
    });

    const moveBtn = tr.querySelector(".btn-move");
    if (moveBtn && !moveBtn.disabled) {
      moveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openSingleMove(rec);
      });
    }

    tbody.appendChild(tr);
  });
}

// ================== PAGINATION ==================
function updatePaginationInfo() {
  const info = document.getElementById("paginationInfo");
  const display = document.getElementById("pageDisplay");
  if (!info || !display) return;
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalRecords);
  info.textContent = `Showing ${start}-${end} of ${totalRecords} records`;
  display.textContent = `Page ${currentPage}`;
}

document.getElementById("prevPage")?.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    fetchRecords(currentPage);
  }
});

document.getElementById("nextPage")?.addEventListener("click", () => {
  if (currentPage < totalPages) {
    currentPage++;
    fetchRecords(currentPage);
  }
});

document.getElementById("pageSize")?.addEventListener("change", (e) => {
  pageSize = parseInt(e.target.value);
  currentPage = 1;
  fetchRecords();
});

// ================== EXPORT TO CSV ==================
function exportToCSV() {
  if (!allRecords || allRecords.length === 0) {
    alert("No records to export!");
    return;
  }

  const headers = [
    "File Name",
    "BD No",
    "Section",
    "Subcategory",
    "Rack",
    "Serial No",
    "Added By",
    "Moved By",
    "Status",
  ];

  const rows = allRecords.map((r) => [
    r.file_name || "",
    r.bd_no || "",
    r.Section ? r.Section.name : "",
    r.Subcategory ? r.Subcategory.name : "",
    r.Rack ? r.Rack.name : "",
    r.serial_no != null ? r.serial_no : "",
    r.added_by || "",
    r.moved_by || "",
    r.status === "central" ? "In Central" : "In Section",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `records_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ================== SEARCH ==================
document.getElementById("searchInput")?.addEventListener("input", () => {
  currentPage = 1;
  fetchRecords(currentPage);
});

// ================== DETAILS MODAL ==================
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
    <p><strong>Serial No:</strong> ${serial}</p>
    <p><strong>Added By:</strong> ${rec.added_by || "-"}</p>
  `;

  // 🟢 Show previous location if available
  if (rec.status === "central" && rec.previous_location) {
    const prevSec = rec.previous_location.section_name || "-";
    const prevRack = rec.previous_location.rack_name || "-";
    html += `<p><strong>Previous Location:</strong> ${prevSec} → ${prevRack}</p>`;
  }

  // 🟢 Show moved_by if moved to central
  if (rec.status === "central") {
    html += `<p><strong>Moved By:</strong> ${rec.moved_by || "-"}</p>`;
  }

  html += `<p><strong>Status:</strong> ${status}</p>`;

  body.innerHTML = html;
  modal.style.display = "flex";
}

function closeModal() {
  document.getElementById("recordModal").style.display = "none";
}

// ================== SINGLE MOVE ==================
function openSingleMove(rec) {
  if (!rec) return;
  singleMoveTargetId = rec.id;
  document.getElementById("currentLocation").textContent =
    `${rec.Section?.name || "-"} → Rack ${rec.Rack?.name || "-"}`;
  document.getElementById("singleMoveModal").style.display = "flex";

  loadCentralRacks().then(() => {
    const select = document.getElementById("singleMoveRack");
    if (select && select.options.length) {
      select.selectedIndex = 0;
      computeSingleAutoSerial();
    }
  });
}

// ================== BULK MOVE ==================
document.getElementById("openBulkMove")?.addEventListener("click", openBulkMove);
document.getElementById("bulkCancel")?.addEventListener("click", closeBulkMove);
document.getElementById("bulkClose")?.addEventListener("click", closeBulkMove);

function openBulkMove() {
  const selected = [...document.querySelectorAll(".record-select:checked")].map(
    (cb) => parseInt(cb.dataset.id)
  );

  if (selected.length === 0) {
    alert("⚠️ Please select at least one record to move.");
    return;
  }

  document.getElementById("bulkMoveModal").style.display = "flex";
  document.getElementById("bulkMoveModal").dataset.ids = JSON.stringify(selected);

  loadCentralRacks().then(() => {
    const select = document.getElementById("bulkRackId");
    if (select && select.options.length) {
      select.selectedIndex = 0;
      computeBulkAutoSerial();
    }
  });
}

function closeBulkMove() {
  document.getElementById("bulkMoveModal").style.display = "none";
  document.getElementById("bulkMoveModal").dataset.ids = "";
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

  if (!ids.length || !rackId) {
    alert("⚠️ Please select records and choose a rack.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/records/bulk-move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordIds: ids,
        newRackId: rackId,
        startSerialNo: startSerial,
        moved_by: localStorage.getItem("username") || "Unknown User",
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");

    showToast("✅ Records moved successfully!", "success");
    closeBulkMove();
    fetchRecords(currentPage);
  } catch (err) {
   showToast("❌ Failed to move records.", "error");
  }
});


function closeSingleMove() {
  singleMoveTargetId = null;
  document.getElementById("singleMoveModal").style.display = "none";
}

async function loadCentralRacks() {
  try {
    const res = await fetch(`${API_BASE}/sections/central/racks`);
    const racks = await res.json();

    // single move modal dropdown
    const singleSelect = document.getElementById("singleMoveRack");
    // bulk move modal dropdown
    const bulkSelect = document.getElementById("bulkRackId");

    // Clear both dropdowns before filling
    if (singleSelect) singleSelect.innerHTML = "";
    if (bulkSelect) bulkSelect.innerHTML = "";

    if (!Array.isArray(racks) || racks.length === 0) {
      const opt = document.createElement("option");
      opt.textContent = "-- No racks found --";
      opt.value = "";
      if (singleSelect) singleSelect.appendChild(opt);
      if (bulkSelect) bulkSelect.appendChild(opt.cloneNode(true));
      return;
    }

    // Populate both dropdowns
    racks.forEach((r) => {
      const opt1 = document.createElement("option");
      opt1.value = r.id;
      opt1.textContent = r.name;

      const opt2 = opt1.cloneNode(true);

      if (singleSelect) singleSelect.appendChild(opt1);
      if (bulkSelect) bulkSelect.appendChild(opt2);
    });
  } catch (err) {
    console.error("❌ loadCentralRacks error:", err);
  }
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

function setupSingleMoveEvents() {
  const rackSel = document.getElementById("singleMoveRack");
  if (rackSel) rackSel.addEventListener("change", computeSingleAutoSerial);

  const confirmBtn = document.getElementById("singleMoveConfirm");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      const rackId = document.getElementById("singleMoveRack").value;
      if (!singleMoveTargetId || !rackId) return;
      const serialPreview = document.getElementById("singleMoveSerial").value || "auto";

      try {
        const res = await fetch(`${API_BASE}/records/move/${singleMoveTargetId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newRackId: rackId,
            startSerialNo: serialPreview,
            moved_by: currentUser, // ✅ store user who moved
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        alert("✅ " + (data.message || "In Central"));
        closeSingleMove();
        fetchRecords(currentPage);
      } catch (err) {
        alert("❌ " + err.message);
      }
    });
  }
}

// ================== INIT ==================
document.addEventListener("DOMContentLoaded", () => {
  loadConfig();
  setupSingleMoveEvents();

  document.getElementById("recordModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("recordModal")) closeModal();
  });

  document.getElementById("singleMoveModal").style.display = "none";
});
