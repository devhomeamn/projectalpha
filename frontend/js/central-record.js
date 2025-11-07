document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ central-record.js loaded (DOM ready)");

  let API_BASE = "";
  let allCentralRecords = [];
  let searchTimeout = null;

  // 🧭 Load backend config first
  async function loadConfig() {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      API_BASE = data.apiBase
        ? `${data.apiBase}/api`
        : `${window.location.origin}/api`;
      console.log("✅ API Base:", API_BASE);
      fetchCentralRecords();
    } catch (err) {
      console.error("⚠️ Config load failed:", err);
    }
  }

  // 🗂 Fetch central records from backend
  async function fetchCentralRecords(searchQuery = "") {
    try {
      const res = await fetch(
        `${API_BASE}/records/central?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      allCentralRecords = data;
      renderTable(allCentralRecords);
    } catch (err) {
      console.error("❌ Failed to fetch central records:", err);
    }
  }

  // 🔍 Search input listener (auto / enter)
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        fetchCentralRecords(e.target.value.trim());
      }, 400); // debounce for smooth typing
    });

    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        fetchCentralRecords(e.target.value.trim());
      }
    });
  }

  // 🧾 Render table
  function renderTable(records) {
    const tbody = document.getElementById("recordsBody");
    tbody.innerHTML = "";

    if (!records || records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">No records found</td></tr>`;
      return;
    }

    records.forEach((rec) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${rec.id}</td>
        <td>${rec.file_name}</td>
        <td>${rec.bd_no || "-"}</td>
        <td>${rec.Section?.name || "-"}</td>
        <td>${rec.Rack?.name || "-"}</td>
        <td>${rec.description || "-"}</td>
        <td>${rec.added_by || "-"}</td>
        <td><span class="status central">${rec.status}</span></td>
      `;

      // click → show modal details
      tr.addEventListener("click", () => showRecordModal(rec));
      tbody.appendChild(tr);
    });
  }
//search 
document.getElementById("searchInput").addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = allRecords.filter(
    (r) =>
      r.file_name.toLowerCase().includes(term) ||
      (r.Section && r.Section.name.toLowerCase().includes(term)) ||
      (r.Rack && r.Rack.name.toLowerCase().includes(term))
  );
  renderTable(filtered);
});

  // 📤 Export CSV (from backend)
  async function exportToCSV() {
    try {
      const q = document.getElementById("searchInput").value.trim();
      const url = `${API_BASE}/records/central?export=csv&q=${encodeURIComponent(
        q
      )}`;
      const res = await fetch(url);

      if (!res.ok) throw new Error("Server error while exporting CSV");

      const blob = await res.blob();
      const urlObject = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = urlObject;
      a.download = `central_records_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      a.click();

      URL.revokeObjectURL(urlObject);
    } catch (err) {
      console.error("❌ Export CSV failed:", err);
      alert("Export failed! Check console for details.");
    }
  }

  // 🪟 Modal open / close
  function showRecordModal(record) {
    const modal = document.getElementById("recordModal");
    const body = document.getElementById("modalBody");

    body.innerHTML = `
      <p><strong>File Name:</strong> ${record.file_name}</p>
      <p><strong>BD No:</strong> ${record.bd_no || "-"}</p>
      <p><strong>Section:</strong> ${record.Section?.name || "-"}</p>
      <p><strong>Rack:</strong> ${record.Rack?.name || "-"}</p>
      <p><strong>Description:</strong> ${record.description || "-"}</p>
      <p><strong>Added By:</strong> ${record.added_by || "-"}</p>
      <p><strong>Status:</strong> ${record.status}</p>
    `;

    modal.style.display = "flex";
  }

  function closeModal() {
    document.getElementById("recordModal").style.display = "none";
  }

  // Close modal when clicking outside
  window.addEventListener("click", (e) => {
    const modal = document.getElementById("recordModal");
    if (e.target === modal) closeModal();
  });

  // Make export function accessible to HTML button
  window.exportToCSV = exportToCSV;

  // 🚀 Init
  loadConfig();
});
