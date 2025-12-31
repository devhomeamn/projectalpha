document.addEventListener("DOMContentLoaded", () => {
  console.log("central-record.js loaded (DOM ready)");

  let API_BASE = "";
  let allCentralRecords = [];      // full list returned from API (filtered by q)
  let searchTimeout = null;

  // Pagination state
  let currentPage = 1;
  let pageSize = 20;

  // DOM refs
  const searchInput = document.getElementById("searchInput");
  const tbody = document.getElementById("recordsBody");
  const pagerInfo = document.getElementById("pagerInfo");
  const paginationEl = document.getElementById("pagination");
  const pageSizeSelect = document.getElementById("pageSizeSelect");

  function getQueryParam() {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get("q") || "").trim();
    } catch {
      return "";
    }
  }

  // Load backend config first (then do initial fetch)
  async function loadConfig() {
    const qParam = getQueryParam();
    if (qParam && searchInput) searchInput.value = qParam;

    try {
      const res = await fetch("/api/config");
      const data = await res.json();

      API_BASE = data.apiBase
        ? `${data.apiBase}/api`
        : `${window.location.origin}/api`;

      console.log("API Base:", API_BASE);

      fetchCentralRecords(qParam); // ✅ initial load
    } catch (err) {
      console.error("Config load failed:", err);
      API_BASE = `${window.location.origin}/api`;
      fetchCentralRecords(qParam);
    }
  }

  // Fetch central records from backend
  async function fetchCentralRecords(searchQuery = "") {
    try {
      const url = `${API_BASE}/records/central?q=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url);
      const data = await res.json();

      allCentralRecords = Array.isArray(data) ? data : [];
      currentPage = 1; // ✅ reset page on new fetch/search
      render();
    } catch (err) {
      console.error("Failed to fetch central records:", err);
      allCentralRecords = [];
      currentPage = 1;
      render();
    }
  }

  function getTotalPages() {
    const total = allCentralRecords.length;
    return Math.max(1, Math.ceil(total / pageSize));
  }

  function getPageSlice() {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return allCentralRecords.slice(start, end);
  }

  // Render table + pagination
  function render() {
    renderTable(getPageSlice());
    renderPagination();
    renderPagerInfo();
  }

  function renderPagerInfo() {
    if (!pagerInfo) return;

    const total = allCentralRecords.length;
    if (total === 0) {
      pagerInfo.textContent = "Showing 0–0 of 0";
      return;
    }

    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, total);
    pagerInfo.textContent = `Showing ${start}–${end} of ${total}`;
  }

  function makeBtn(label, disabled, onClick, isActive = false) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.disabled = !!disabled;

    b.style.border = "1px solid #e5e7eb";
    b.style.background = isActive ? "#111827" : "#fff";
    b.style.color = isActive ? "#fff" : "#111827";
    b.style.borderRadius = "10px";
    b.style.padding = "7px 10px";
    b.style.cursor = disabled ? "not-allowed" : "pointer";
    b.style.fontWeight = "900";
    b.style.fontSize = "12.5px";
    b.style.opacity = disabled ? "0.55" : "1";

    b.addEventListener("click", () => !disabled && onClick());
    return b;
  }

  function renderPagination() {
    if (!paginationEl) return;

    paginationEl.innerHTML = "";
    const totalPages = getTotalPages();
    const total = allCentralRecords.length;

    // If empty, still show disabled buttons
    const prevDisabled = currentPage <= 1 || total === 0;
    const nextDisabled = currentPage >= totalPages || total === 0;

    paginationEl.appendChild(
      makeBtn("Prev", prevDisabled, () => {
        currentPage = Math.max(1, currentPage - 1);
        render();
      })
    );

    // Page numbers (windowed)
    const windowSize = 5;
    let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);

    if (start > 1) {
      paginationEl.appendChild(makeBtn("1", false, () => { currentPage = 1; render(); }, currentPage === 1));
      if (start > 2) {
        const dots = document.createElement("span");
        dots.textContent = "…";
        dots.style.padding = "0 6px";
        dots.style.color = "#6b7280";
        dots.style.fontWeight = "900";
        paginationEl.appendChild(dots);
      }
    }

    for (let p = start; p <= end; p++) {
      paginationEl.appendChild(
        makeBtn(String(p), false, () => {
          currentPage = p;
          render();
        }, p === currentPage)
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        const dots = document.createElement("span");
        dots.textContent = "…";
        dots.style.padding = "0 6px";
        dots.style.color = "#6b7280";
        dots.style.fontWeight = "900";
        paginationEl.appendChild(dots);
      }
      paginationEl.appendChild(makeBtn(String(totalPages), false, () => { currentPage = totalPages; render(); }, currentPage === totalPages));
    }

    paginationEl.appendChild(
      makeBtn("Next", nextDisabled, () => {
        currentPage = Math.min(totalPages, currentPage + 1);
        render();
      })
    );
  }

  // Render table (same as your current logic, but uses provided records slice)
  function renderTable(records) {
    if (!tbody) return;

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

        <td class="file-cell" style="cursor:pointer; font-weight:600; color:#111827;">
          ${rec.file_name}
        </td>

        <td>${rec.bd_no || "-"}</td>
        <td>${sectionName}</td>
        <td>${rackName}</td>
        <td><strong>${serialNo}</strong></td>
        <td>${rec.description || "-"}</td>
        <td>${rec.added_by || "-"}</td>
        <td><span class="status central">Moved to Central</span></td>
      `;

      const fileCell = tr.querySelector(".file-cell");
      fileCell?.addEventListener("click", (e) => {
        e.stopPropagation();
        showRecordModal(rec);
      });

      tbody.appendChild(tr);
    });
  }

  // Search input listener (debounced)
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

  // Page size change
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", () => {
      const n = parseInt(pageSizeSelect.value, 10);
      pageSize = Number.isFinite(n) && n > 0 ? n : 20;
      currentPage = 1;
      render();
    });
  }

  /* ================== EXPORT CSV ================== */
  function exportToCSV() {
    if (!allCentralRecords || allCentralRecords.length === 0) {
      alert("No records to export!");
      return;
    }

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

    let csv = headers.map(csvEscape).join(",") + "\n";
    csv += rows.map((row) => row.map(csvEscape).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `central_records_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    if (value === null || value === undefined) return "";
    const str = String(value).replace(/"/g, '""');
    return /[",\n]/.test(str) ? `"${str}"` : str;
  }

  // Modal: Show Details (your same modal UI)
  function showRecordModal(record) {
    const modal = document.getElementById("recordModal");
    const body = document.getElementById("modalBody");
    if (!modal || !body) return;

    const sectionName = record.Section?.name || "-";
    const subName     = record.Subcategory?.name || "-";
    const rackName    = record.Rack?.name || "-";
    const serialNo    = record.serial_no != null ? record.serial_no : "-";

    const prevSection = record.previous_location?.section_name || "-";
    const prevSub     = record.previous_location?.subcategory_name || "-";
    const prevRack    = record.previous_location?.rack_name || "-";

    body.innerHTML = `
      <div class="block">
        <p><strong>📁 File Name:</strong> ${record.file_name}</p>
        <p><strong>🆔 BD No:</strong> ${record.bd_no || "-"}</p>
      </div>

      <div class="block">
        <p><strong>📍 Current Location</strong></p>
        <p>• <strong>Section:</strong> ${sectionName}</p>
        <p>• <strong>Subcategory:</strong> ${subName}</p>
        <p>• <strong>Rack:</strong> ${rackName}</p>
        <p>• <strong>Serial No:</strong> <strong>${serialNo}</strong></p>
      </div>

      <div class="block">
        <p><strong>⏪ Previous Location (Before Central)</strong></p>
        <p>• <strong>Section:</strong> ${prevSection}</p>
        <p>• <strong>Subcategory:</strong> ${prevSub}</p>
        <p>• <strong>Rack:</strong> ${prevRack}</p>
      </div>

      <div class="block">
        <p><strong>📝 Description:</strong> ${record.description || "-"}</p>
        <p><strong>👤 Added By:</strong> ${record.added_by || "-"}</p>
        <p><strong>🚚 Moved By:</strong> ${record.moved_by || "-"}</p>
        <p><strong>📌 Status:</strong> Moved to Central</p>
        <p><strong>🕒 Moved At:</strong> ${
          record.updatedAt ? new Date(record.updatedAt).toLocaleString() : "-"
        }</p>
      </div>
    `;

    modal.style.display = "flex";
  }

  function closeModal() {
    const modal = document.getElementById("recordModal");
    if (modal) modal.style.display = "none";
  }

  window.closeModal = closeModal;
  window.exportToCSV = exportToCSV;

  document.querySelector("#recordModal .close-btn")?.addEventListener("click", closeModal);

  window.addEventListener("click", (e) => {
    const modal = document.getElementById("recordModal");
    if (e.target === modal) closeModal();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // Init
  loadConfig();
});
