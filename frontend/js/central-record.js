document.addEventListener("DOMContentLoaded", () => {
  console.log("central-record.js loaded (DOM ready)");

  let API_BASE = "";
  let allCentralRecords = [];
  let searchTimeout = null;

  // Load backend config first
  async function loadConfig() {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      API_BASE = data.apiBase
        ? `${data.apiBase}/api`
        : `${window.location.origin}/api`;
      console.log("API Base:", API_BASE);
      fetchCentralRecords();
    } catch (err) {
      console.error("Config load failed:", err);
      API_BASE = `${window.location.origin}/api`;
      fetchCentralRecords();
    }
  }

  // Fetch central records from backend
  async function fetchCentralRecords(searchQuery = "") {
    try {
      const url = `${API_BASE}/records/central?q=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url);
      const data = await res.json();
      allCentralRecords = data;
      renderTable(allCentralRecords);
    } catch (err) {
      console.error("Failed to fetch central records:", err);
    }
  }

  // Render table
  function renderTable(records) {
    const tbody = document.getElementById("recordsBody");
    tbody.innerHTML = "";

    if (!records || records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No records found</td></tr>`;
      return;
    }

    records.forEach((rec) => {
      const tr = document.createElement("tr");

      const sectionName = rec.Section?.name || "-";
      const rackName = rec.Rack?.name || "-";
      const serialNo = rec.serial_no != null ? rec.serial_no : "-";

      tr.innerHTML = `
        <td>${rec.id}</td>
        <td>${rec.file_name}</td>
        <td>${rec.bd_no || "-"}</td>
        <td>${sectionName}</td>
        <td>${rackName}</td>
        <td><strong>${serialNo}</strong></td>
        <td>${rec.description || "-"}</td>
        <td>${rec.added_by || "-"}</td>
        <td><span class="status central">Moved to Central</span></td>
      `;

      tr.addEventListener("click", () => showRecordModal(rec));
      tbody.appendChild(tr);
    });
  }

  // Search input listener (debounced)
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      const term = e.target.value.trim();

      searchTimeout = setTimeout(() => {
        fetchCentralRecords(term);
      }, 400);
    });

    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        fetchCentralRecords(e.target.value.trim());
      }
    });
  }

 /* ================== EXPORT CSV (formatted like view-record) ================== */
function exportToCSV() {
  if (!allCentralRecords || allCentralRecords.length === 0) {
    alert("No records to export!");
    return;
  }

  // ✅ Column order exactly as your table
  const headers = [
    "ID",
    "File Name",
    "BD No",
    "Section",
    "Rack",
    "Serial No",
    "Description",
    "Added By",
    "Moved By",
    "Previous Section",
    "Previous Subcategory",
    "Previous Rack",
    "Status",
    "Moved At",
  ];

  const rows = allCentralRecords.map((r) => {
    const prev = r.previous_location || {};

    return [
      r.id ?? "",
      r.file_name ?? "",
      r.bd_no ?? "",
      r.Section?.name ?? "",
      r.Rack?.name ?? "",
      r.serial_no ?? "",
      r.description ?? "",
      r.added_by ?? "",
      r.moved_by ?? "",
      prev.section_name ?? "",
      prev.subcategory_name ?? "",
      prev.rack_name ?? "",
      r.status ?? "central",
      r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "",
    ];
  });

  // ✅ build CSV
  let csv = headers.map(csvEscape).join(",") + "\n";
  csv += rows.map((row) => row.map(csvEscape).join(",")).join("\n");

  // ✅ download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `central_records_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

// ✅ CSV escape helper (handles comma, quote, newline)
function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/"/g, '""');
  return /[",\n]/.test(str) ? `"${str}"` : str;
}

  // Modal: Show Details
  function showRecordModal(record) {
    const modal = document.getElementById("recordModal");
    const body = document.getElementById("modalBody");

    const sectionName = record.Section?.name || "-";
    const subName = record.Subcategory?.name || "-";
    const rackName = record.Rack?.name || "-";
    const serialNo = record.serial_no != null ? record.serial_no : "-";

    const prevSection = record.previous_location?.section_name || "-";
    const prevSub = record.previous_location?.subcategory_name || "-";
    const prevRack = record.previous_location?.rack_name || "-";

    body.innerHTML = `
      <p><strong>File Name:</strong> ${record.file_name}</p>
      <p><strong>BD No:</strong> ${record.bd_no || "-"}</p>

      <hr style="margin:10px 0; border:none; border-top:1px dashed #ddd;" />

      <p><strong>Current Location:</strong></p>
      <p>📌 <strong>Section:</strong> ${sectionName}</p>
      <p>🗂️ <strong>Subcategory:</strong> ${subName}</p>
      <p>🗄️ <strong>Rack:</strong> ${rackName}</p>
      <p><strong>Serial No:</strong> <strong>${serialNo}</strong></p>

      <hr style="margin:10px 0; border:none; border-top:1px dashed #ddd;" />

      <p><strong>Previous Location (Before Central):</strong></p>
      <p>⬅️ <strong>Section:</strong> ${prevSection}</p>
      <p>⬅️ <strong>Subcategory:</strong> ${prevSub}</p>
      <p>⬅️ <strong>Rack:</strong> ${prevRack}</p>

      <hr style="margin:10px 0; border:none; border-top:1px dashed #ddd;" />

      <p><strong>Description:</strong> ${record.description || "-"}</p>
      <p><strong>Added By:</strong> ${record.added_by || "-"}</p>
      <p><strong>Moved By:</strong> ${record.moved_by || "-"}</p>
      <p><strong>Status:</strong> Moved to Central</p>
      <p><strong>Moved At:</strong> ${
        record.updatedAt ? new Date(record.updatedAt).toLocaleString() : "-"
      }</p>
    `;

    modal.style.display = "flex";
  }

  // ✅ Close Modal (now global + safe)
  function closeModal() {
    const modal = document.getElementById("recordModal");
    modal.style.display = "none";
  }

  // ✅ make closeModal available for inline onclick
  window.closeModal = closeModal;

  // ✅ close button click (extra safety, if inline removed later)
  document.querySelector("#recordModal .close-btn")
    ?.addEventListener("click", closeModal);

  // Click outside modal to close
  window.addEventListener("click", (e) => {
    const modal = document.getElementById("recordModal");
    if (e.target === modal) closeModal();
  });

  // ✅ ESC press to close
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // Make export accessible
  window.exportToCSV = exportToCSV;

  // Init
  loadConfig();
});
