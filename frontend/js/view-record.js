console.log("✅ view-record.js loaded");

let API_BASE = "";
let allRecords = [];



// 🧩 Load backend config first
async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    API_BASE = data.apiBase ? `${data.apiBase}/api` : `${window.location.origin}/api`;
    console.log("✅ API Base loaded:", API_BASE);
    fetchRecords();
  } catch (err) {
    console.error("⚠️ Could not load backend config:", err);
    API_BASE = `${window.location.origin}/api`;
    fetchRecords();
  }
}

// ============= FETCH RECORDS =============
async function fetchRecords() {
  try {
    const res = await fetch(`${API_BASE}/records`);
    const data = await res.json();
    allRecords = data;
    renderTable(allRecords);
  } catch (err) {
    console.error("❌ Failed to fetch records:", err);
  }
}

// ============= RENDER TABLE =============
function renderTable(records) {
  const tbody = document.querySelector("#recordTable tbody");
  tbody.innerHTML = "";

  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No records found</td></tr>`;
    return;
  }

  records.forEach((rec) => {
    const tr = document.createElement("tr");
    const sectionName = rec.Section ? rec.Section.name : "-";
    const subName = rec.Subcategory ? rec.Subcategory.name : "-";
    const rackName = rec.Rack ? rec.Rack.name : "-";

    // ✅ Use backend 'status' field
    const statusClass = rec.status === "central" ? "central" : "section";
    const statusText = rec.status === "central" ? "Moved to Central" : "In Section";

    tr.innerHTML = `
      <td>${rec.id}</td>
      <td>${rec.file_name}</td>
      <td>${rec.bd_no || "-"}</td>
      <td>${sectionName}</td>
      <td>${subName}</td>
      <td>${rackName}</td>
      <td>${rec.added_by || "-"}</td>
      <td><span class="status ${statusClass}">${statusText}</span></td>
      <td>
        ${
          rec.status === "central"
            ? `<button class="btn-move" disabled> Centralized</button>`
            : `<button class="btn-move" onclick="moveToCentral(${rec.id})">🏛 Move</button>`
        }
      </td>
    `;

    tr.addEventListener("click", (e) => {
      if (e.target.tagName !== "BUTTON") showDetails(rec);
    });

    tbody.appendChild(tr);
  });
}

// ============= SEARCH =============
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

// ============= MOVE TO CENTRAL =============
async function moveToCentral(id) {
  showConfirm({
    title: "Move Record",
    message: "Do you really want to move this record to the Central Record Room?",
    onConfirm: async () => {
      try {
        const res = await fetch(`${API_BASE}/records/move/${id}`, { method: "PUT" });
        const data = await res.json();
        showSuccess(data.message || " Record moved successfully!");
        fetchRecords();
      } catch (err) {
        console.error("❌ Failed to move record:", err);
      }
    },
  });
}


// ============= EXPORT TO CSV =============
function exportToCSV() {
  if (!allRecords.length) return alert("No records to export!");
  const headers = ["ID", "File Name", "BD No", "Section", "Subcategory", "Rack", "Added By", "Status"];
  const rows = allRecords.map((r) => [
    r.id,
    r.file_name,
    r.bd_no,
    r.Section ? r.Section.name : "",
    r.Subcategory ? r.Subcategory.name : "",
    r.Rack ? r.Rack.name : "",
    r.added_by,
    r.status === "central" ? "Moved to Central" : "In Section",
  ]);
  let csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "records_export.csv";
  link.click();
}

// ============= MODAL: Show Details =============
function showDetails(rec) {
  const modal = document.getElementById("recordModal");
  const body = document.getElementById("modalBody");
  const rackName = rec.Rack ? rec.Rack.name : "-";

  body.innerHTML = `
    <p><strong>File Name:</strong> ${rec.file_name}</p>
    <p><strong>BD No:</strong> ${rec.bd_no || "-"}</p>
    <p><strong>Section:</strong> ${rec.Section ? rec.Section.name : "-"}</p>
    <p><strong>Subcategory:</strong> ${rec.Subcategory ? rec.Subcategory.name : "-"}</p>
    <p><strong>Rack:</strong> ${rackName}</p>
    <p><strong>Description:</strong> ${rec.description || "-"}</p>
    <p><strong>Added By:</strong> ${rec.added_by}</p>
    <p><strong>Status:</strong> ${rec.status === "central" ? "Moved to Central" : "In Section"}</p>
    <p><strong>Created At:</strong> ${new Date(rec.createdAt).toLocaleString()}</p>
  `;

  modal.style.display = "flex";
}

function closeModal() {
  document.getElementById("recordModal").style.display = "none";
}

// ============= LOGOUT =============
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}

// ============= INIT =============
document.addEventListener("DOMContentLoaded", () => {
  const userInfo = document.getElementById("userInfo");
  if (userInfo)
    userInfo.textContent = `Logged in as: ${localStorage.getItem("username") || "Unknown User"}`;
  loadConfig();
});
