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
      const serialNo = rec.serial_no != null ? rec.serial_no : "-"; // নতুন

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

  // Export CSV (from backend)
  async function exportToCSV() {
    try {
      const q = document.getElementById("searchInput")?.value.trim() || "";
      const url = `${API_BASE}/records/central?export=csv&q=${encodeURIComponent(q)}`;
      const res = await fetch(url);

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const urlObject = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = urlObject;
      a.download = `central_records_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();

      URL.revokeObjectURL(urlObject);
    } catch (err) {
      console.error("Export CSV failed:", err);
      alert("Export failed! Check console.");
    }
  }

  // Modal: Show Details
  function showRecordModal(record) {
    const modal = document.getElementById("recordModal");
    const body = document.getElementById("modalBody");

    const sectionName = record.Section?.name || "-";
    const rackName = record.Rack?.name || "-";
    const serialNo = record.serial_no != null ? record.serial_no : "-";

    body.innerHTML = `
      <p><strong>File Name:</strong> ${record.file_name}</p>
      <p><strong>BD No:</strong> ${record.bd_no || "-"}</p>
      <p><strong>Section:</strong> ${sectionName}</p>
      <p><strong>Rack:</strong> ${rackName}</p>
      <p><strong>Serial No:</strong> <strong>${serialNo}</strong></p>
      <p><strong>Description:</strong> ${record.description || "-"}</p>
      <p><strong>Added By:</strong> ${record.added_by || "-"}</p>
      <p><strong>Status:</strong> Moved to Central</p>
      <p><strong>Moved At:</strong> ${new Date(record.updatedAt).toLocaleString()}</p>
    `;

    modal.style.display = "flex";
  }

  // Close Modal
  function closeModal() {
    document.getElementById("recordModal").style.display = "none";
  }

  // Click outside modal to close
  window.addEventListener("click", (e) => {
    const modal = document.getElementById("recordModal");
    if (e.target === modal) closeModal();
  });

  // Make export accessible
  window.exportToCSV = exportToCSV;

  // Init
  loadConfig();
});