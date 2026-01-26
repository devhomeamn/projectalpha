console.log("view-record.js loaded");

let API_BASE = "";
let allRecords = [];
let singleMoveTargetId = null;
let singleMoveTargetRec = null; // ✅ keep selected record for status check

let currentPage = 1;
let totalPages = 1;
let totalRecords = 0;

let selectedSection = "";
let selectedRack = ""; // ✅ NEW (Rack filter)
let pageSize = 10;

let currentUser = localStorage.getItem("username") || "Unknown User";
let lastViewedRecordForPrint = null;

/* ================== AUTH HELPER (copy from add-record.js) ================== */
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

    /* ✅ AO badge */
    .ao-badge{
      display:inline-flex;
      align-items:center;
      gap:6px;
      font-size:11px;
      font-weight:800;
      padding:2px 8px;
      border-radius:999px;
      border:1px solid #ef4444;
      color:#ef4444;
      margin-left:8px;
      vertical-align:middle;
    }
    .ao-badge::before{
      content:"●";
      font-size:10px;
      line-height:1;
    }

    /* ✅ Attachment preview */
    .attach-preview{
      margin-top:10px;
      border:1px solid #ddd;
      border-radius:10px;
      overflow:hidden;
      background:#fff;
    }
    .attach-preview iframe{
      width:100%;
      height:460px;
      border:0;
      display:block;
    }
    .attach-preview img{
      width:100%;
      height:auto;
      display:block;
    }
    .attach-meta{
      font-size:12px;
      opacity:.8;
      margin-top:6px;
    }
  `;
  document.head.appendChild(style);
})();

function normalizeApiBase(apiBaseFromServer) {
  let base = (apiBaseFromServer || window.location.origin || "").trim();
  if (base.endsWith("/")) base = base.slice(0, -1);
  if (base.toLowerCase().endsWith("/api")) return base;
  return `${base}/api`;
}

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/* ================== safe fetch ================== */
async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = typeof data === "string" ? data : (data?.error || JSON.stringify(data));
    throw new Error(`${res.status} ${res.statusText} - ${msg}`);
  }
  return data;
}

/* ================== LOAD CONFIG ================== */
async function loadConfig() {
  try {
    const data = await fetch("/api/config").then(r => r.json());
    API_BASE = normalizeApiBase(data.apiBase);
    console.log("API Base loaded:", API_BASE);

    await Promise.all([
      loadSections(),
      loadCentralRacks(),
    ]);

    await fetchRecords(1);
  } catch (err) {
    console.error("Config load error:", err);
    API_BASE = normalizeApiBase(null);

    await Promise.all([
      loadSections(),
      loadCentralRacks(),
    ]);

    await fetchRecords(1);
  }
}

//notif to filter ongoing rec for 
function getRecordStatusParam() {
  try {
    const params = new URLSearchParams(window.location.search);
    return (params.get("record_status") || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function getUrlParam(name) {
  try {
    const params = new URLSearchParams(window.location.search);
    return (params.get(name) || "").trim();
  } catch {
    return "";
  }
}

/* =============== CENTRAL ROOM RACKS → MOVE TO CENTRAL MODAL =============== */
async function loadCentralRacks() {
  const singleSelect = document.getElementById("singleMoveRack");
  const bulkSelect   = document.getElementById("bulkRackId");

  if (!singleSelect && !bulkSelect) return;

  [singleSelect, bulkSelect].forEach((sel) => {
    if (!sel) return;
    sel.innerHTML = "";
    sel.disabled = true;
    sel.add(new Option("Loading central racks...", ""));
  });

  try {
    const secRes = await authFetch(`${API_BASE}/sections`);
    const sections = await secRes.json();
    if (!Array.isArray(sections)) throw new Error("Invalid sections data");

    const centralSection = sections.find(
      (s) => (s.name || "").trim().toLowerCase() === "central room"
    );

    if (!centralSection) {
      [singleSelect, bulkSelect].forEach((sel) => {
        if (!sel) return;
        sel.innerHTML = "";
        sel.disabled = true;
        sel.add(new Option("Central Room section পাওয়া যায়নি", ""));
      });
      console.warn("Central Room section পাওয়া যায়নি");
      return;
    }

    const rackRes = await authFetch(
      `${API_BASE}/sections/racks/${centralSection.id}`
    );
    const racks = await rackRes.json();

    console.log("Central Room racks for move:", racks);

    [singleSelect, bulkSelect].forEach((sel) => {
      if (!sel) return;
      sel.innerHTML = "";
      sel.disabled = false;
    });

    if (!Array.isArray(racks) || racks.length === 0) {
      const txt = "-- Central Room এ এখনও কোনো rack নেই --";
      if (singleSelect) singleSelect.add(new Option(txt, ""));
      if (bulkSelect)   bulkSelect.add(new Option(txt, ""));
      return;
    }

    function fill(sel) {
      if (!sel) return;
      sel.add(new Option("Select Central Rack", ""));
      racks.forEach((r) => {
        const id   = r.id;
        const name = r.name || `Rack ${r.id}`;
        if (!id) return;
        sel.add(new Option(name, id));
      });
    }

    fill(singleSelect);
    fill(bulkSelect);
  } catch (err) {
    console.error("loadCentralRacks (central room) error:", err);
    [singleSelect, bulkSelect].forEach((sel) => {
      if (!sel) return;
      sel.innerHTML = "";
      sel.disabled = true;
      sel.add(new Option("⚠ Central racks load failed", ""));
    });
    showToast("Central Room-er rack load করতে সমস্যা হচ্ছে", "error");
  }
}

/* ================== SECTIONS ================== */
async function loadSections() {
  try {
    const data = await fetchJson(`${API_BASE}/sections`, { headers: { ...getAuthHeaders() } });

    const select = document.getElementById("sectionFilter");
    if (!select) return;

    select.innerHTML = `<option value="">All Sections</option>`;
    data.forEach((s) => select.appendChild(new Option(s.name, s.id)));

    select.onchange = async (e) => {
      selectedSection = e.target.value;
      currentPage = 1;

      // ✅ reset + reload rack filter when section changes
      selectedRack = "";
      const rf = document.getElementById("rackFilter");
      if (rf) rf.value = "";
      await loadRacksForSection(selectedSection);

      fetchRecords(1);
    };
  } catch (err) {
    console.error("loadSections error:", err);
  }
}

/* ================== RACKS (FILTER) ================== */
async function loadRacksForSection(sectionId) {
  const sel = document.getElementById("rackFilter");
  if (!sel) return;

  sel.innerHTML = "";
  sel.add(new Option("All Racks", ""));
  sel.disabled = true;
  selectedRack = "";

  if (!sectionId) return;

  sel.disabled = false;
  sel.innerHTML = "";
  sel.add(new Option("Loading racks...", ""));

  const endpoints = [
    `${API_BASE}/sections/${sectionId}/racks`,
    `${API_BASE}/sections/${sectionId}/rack`,
    `${API_BASE}/sections/racks?sectionId=${encodeURIComponent(sectionId)}`,
  ];

  let racks = null;
  let lastErr = null;

  for (const url of endpoints) {
    try {
      const out = await fetchJson(url, { headers: { ...getAuthHeaders() } });
      if (Array.isArray(out)) {
        racks = out;
        break;
      }
    } catch (e) {
      lastErr = e;
    }
  }

  sel.innerHTML = "";
  sel.add(new Option("All Racks", ""));

  if (!Array.isArray(racks) || racks.length === 0) {
    sel.add(new Option("-- No racks found --", ""));
    sel.disabled = true;
    if (lastErr) console.error("loadRacksForSection error:", lastErr);
    return;
  }

  racks.forEach((r) => {
    const id = r.id ?? r.rack_id ?? "";
    const name = r.name ?? r.rack_name ?? `Rack ${id}`;
    sel.add(new Option(name, id));
  });
}

/* ================== RACK-WISE A4 + QR BULK PRINT ================== */
async function printLabelsForCurrentRack() {
  if (!selectedSection || !selectedRack) {
    showToast("⚠️ আগে Section এবং Rack নির্বাচন করুন", "warn");
    return;
  }

  let records = [];

  try {
    const url =
      `${API_BASE}/records` +
      `?page=1` +
      `&limit=1000` +
      `&q=` +
      `&section=${encodeURIComponent(selectedSection)}` +
      `&rack=${encodeURIComponent(selectedRack)}`;

    const data = await fetchJson(url, { headers: { ...getAuthHeaders() } });
    records = Array.isArray(data.data) ? data.data : [];
  } catch (err) {
    console.error("printLabelsForCurrentRack error:", err);
    showToast("❌ Rack data আনতে সমস্যা হয়েছে", "error");
    return;
  }

  if (!Array.isArray(records) || records.length === 0) {
    showToast("⚠️ এই Rack এ কোনো record পাওয়া যায়নি", "warn");
    return;
  }

  const pagesHtml = records
    .map((r) => {
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
        "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" +
        encodeURIComponent(qrText);

      return `
        <div class="a4">
          <h1 class="title">SFC Air FRMS</h1>
          <div class="subtitle">File & Record Management System</div>

          <div class="grid">
            <div class="secBlock">
              <div class="secLabel">Section :</div>
              <div class="secVal">${sectionName}</div>

              <div class="secLabel">Subcategory:</div>
              <div class="secVal">${subName}</div>
            </div>

            <div class="qrBox">
              <div class="qrTitle">QR CODE</div>
              <img src="${qrUrl}" alt="QR"
                  onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
              <div class="qrFallback" style="display:none;">QR</div>
            </div>

            <div class="card rackCard">
              <div class="cardLabel">Rack No.</div>
              <div class="cardValue">${rackNo}</div>
            </div>

            <div class="card serialCard">
              <div class="cardLabel">Serial No.</div>
              <div class="cardValue">${serialNo}</div>
            </div>
          </div>

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
    })
    .join("");

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
        <title>Rack Records Print</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body{ font-family: Arial, sans-serif; color:#000; margin:0; }

          .a4{
            width:100%;
            margin-bottom: 30px;
            page-break-inside: avoid;
          }

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

          .rackCard{ grid-column: 1 / 2; margin-top: -160px; }
          .serialCard{ grid-column: 2 / 3; margin-top: -160px; }

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
      <body>${pagesHtml}</body>
    </html>
  `);
  doc.close();

  frame.onload = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };
}

/* ================== FETCH RECORDS ================== */
async function fetchRecords(page = 1) {
  try {
    const q = document.getElementById("searchInput")?.value?.trim() || "";
    const sectionParam = selectedSection ? `&section=${selectedSection}` : "";
    const rackParam = selectedRack ? `&rack=${selectedRack}` : "";

    const rsRaw = getUrlParam("record_status").toLowerCase();
    const allowed = ["ongoing", "closed"];
    const safeRS = allowed.includes(rsRaw) ? rsRaw : "";

    const mine = getUrlParam("mine") === "1" ? "1" : "";

    const recordStatusParam = safeRS ? `&record_status=${encodeURIComponent(safeRS)}` : "";
    const mineParam = mine ? `&mine=1` : "";

    const data = await fetchJson(
      `${API_BASE}/records?page=${page}&limit=${pageSize}&q=${encodeURIComponent(q)}${sectionParam}${rackParam}${recordStatusParam}${mineParam}`,
      { headers: { ...getAuthHeaders() } }
    );

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

/* ================== AO HELPER ================== */
function isAuditObjection(rec) {
  return rec?.audit_objection === true ||
    rec?.audit_objection === 1 ||
    String(rec?.audit_objection || "").toLowerCase() === "true" ||
    String(rec?.audit_objection || "").toLowerCase() === "yes";
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

    // ✅ AO badge in list (no new column)
    const aoBadge = isAuditObjection(rec) ? `<span class="ao-badge" title="Audit Objection">AO</span>` : "";

    tr.innerHTML = `
<td>${tableSerial}</td>
  <td><input type="checkbox" class="record-select" data-id="${rec.id}"></td>
 
 <td class="file-cell" title="View details">${rec.file_name}${aoBadge}</td>

  <td>${rec.bd_no || "-"}</td>
  <td>${sectionName}</td>
  <td>${subName}</td>

  <td class="rack-red">${rackName}</td>
  <td class="rsl-red">${serialNo}</td>

  <td><span class="status ${currentClass}">${currentText}</span></td>
  <td><span class="status ${locationClass}">${locationText}</span></td>
  <td>${openingDate}</td>
  <td>${closingDate}</td>

  <td class="action-icons">
  <i class="fa-solid fa-pen-to-square action-icon action-icon--edit icon-edit"
     data-id="${rec.id}" title="Edit"></i>

  <i class="fa-solid fa-truck-moving action-icon action-icon--move icon-move"
     data-id="${rec.id}" title="Move to Central"></i>

  ${canDelete ? `
    <i class="fa-solid fa-trash action-icon action-icon--delete icon-delete"
       data-id="${rec.id}" title="Delete"></i>
  ` : ""}
</td> `;

    const fileCell = tr.querySelector(".file-cell");
    fileCell.addEventListener("click", (e) => {
      e.stopPropagation();
      showDetails(rec);
    });

    tr.querySelector(".icon-edit")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(rec);
    });

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

    tr.querySelector(".icon-delete")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Are you sure you want to delete this record?")) return;
      try {
        const res = await fetch(`${API_BASE}/records/delete/${rec.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
async function openSingleMove(rec) {
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

  await loadCentralRacks();
  computeSingleAutoSerial();
}

async function computeSingleAutoSerial() {
  const rackId = document.getElementById("singleMoveRack")?.value;
  const serialInput = document.getElementById("singleMoveSerial");
  if (!serialInput) return;
  if (!rackId) {
    serialInput.value = "";
    return;
  }

  try {
    const records = await fetchJson(`${API_BASE}/records/by-rack/${rackId}`, {
      headers: { ...getAuthHeaders() },
    });

    const used = (records || [])
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
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
  if (!serialInput) return;
  if (!rackId) {
    serialInput.value = "";
    return;
  }

  try {
    const records = await fetchJson(`${API_BASE}/records/by-rack/${rackId}`, {
      headers: { ...getAuthHeaders() },
    });

    const used = (records || [])
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
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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

/* ================== DETAILS MODAL HELPERS (AO + Attachment) ================== */
function renderAuditObjectionBlock(rec) {
  const yes = isAuditObjection(rec);
  if (!yes) return `<div class="block"><p><strong>🧾 Audit Objection:</strong> No</p></div>`;

  const no = rec.objection_no || "-";
  const title = rec.objection_title || "-";
  const details = rec.objection_details || "-";

  const bd = (rec.bd_no || "").trim();
  const historyUrl = bd
    ? `bd-objection-history.html?bd_no=${encodeURIComponent(bd)}`
    : `bd-objection-history.html`;

  return `
    <div class="block">
      <p><strong>🧾 Audit Objection:</strong> <span class="ao-badge">AO</span></p>
      <p><strong>Objection No:</strong> ${no}</p>
      <p><strong>Title:</strong> ${title}</p>
      <p><strong>Details:</strong><br>${details}</p>

      <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
        <a class="btn btn-primary" href="${historyUrl}" target="_blank" rel="noopener">
          BD Objection History
        </a>
      </div>
    </div>
  `;
}


function renderAttachmentBlock(rec) {
  const path = rec?.attachment_path || "";
  if (!path) {
    return `<div class="block"><p><strong>📎 Attachment:</strong> None</p></div>`;
  }

  const name = rec.attachment_name || "Attachment";
  const mime = (rec.attachment_mime || "").toLowerCase();

  let preview = "";
  if (mime.startsWith("image/")) {
    preview = `
      <div class="attach-preview">
        <img src="${path}" alt="${name}">
      </div>
    `;
  } else if (mime === "application/pdf") {
    preview = `
      <div class="attach-preview">
        <iframe src="${path}"></iframe>
      </div>
    `;
  }

  return `
    <div class="block">
      <p><strong>📎 Attachment:</strong>
        <a href="${path}" target="_blank" rel="noopener">View / Download</a>
      </p>
      <div class="attach-meta">${name}</div>
      ${preview}
    </div>
  `;
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

    ${renderAuditObjectionBlock(rec)}
    ${renderAttachmentBlock(rec)}

    <div class="block" id="sameBdAoBlock">
      <p><strong>🧾 Same BD - Other Audit Objections</strong></p>
      <div id="sameBdAoList" style="opacity:.75;">Loading...</div>
    </div>
  `;

  bindWorkflowControls(rec);
  modal.style.display = "flex";

  // ✅ call AFTER html injected
  loadSameBdAuditObjections(rec);
}



function truthyAO(v) {
  return v === true || v === 1 || String(v || "").toLowerCase() === "true" || String(v || "").toLowerCase() === "yes";
}

async function loadSameBdAuditObjections(rec) {
  const wrap = document.getElementById("sameBdAoBlock");
  const list = document.getElementById("sameBdAoList");
  if (!wrap || !list) return;

  const bd = (rec?.bd_no || "").trim();
  if (!bd) {
    list.textContent = "BD No নেই";
    return;
  }

  const secName = (rec?.Section?.name || "").trim().toLowerCase();
  const cleaned = secName.replace(/\s+/g, "");
  const isLALAO = cleaned === "la/lao" || cleaned === "la-lao" || cleaned === "lalao";
  if (!isLALAO) {
    list.textContent = "এই ফিচারটা শুধু LA/LAO এর জন্য";
    return;
  }

  try {
    const url = `${API_BASE}/records?page=1&limit=300&q=${encodeURIComponent(bd)}`;
    const data = await fetchJson(url, { headers: { ...getAuthHeaders() } });

    const rows = Array.isArray(data?.data) ? data.data : [];
    const sameBd = rows.filter(r => String(r?.bd_no || "").trim() === bd);

    const others = sameBd
      .filter(r => r?.id !== rec?.id && truthyAO(r?.audit_objection))
      .sort((a, b) => {
        const ao = String(a?.objection_no || "");
        const bo = String(b?.objection_no || "");
        return ao.localeCompare(bo);
      });

    if (others.length === 0) {
      list.textContent = "No other objections found for this BD.";
      return;
    }

    const esc = (s) =>
      String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const short = (s, n = 90) => {
      const t = String(s || "").trim();
      if (!t) return "-";
      return t.length > n ? t.slice(0, n) + "…" : t;
    };

    list.innerHTML = `
      <div style="margin-top:8px;display:flex;flex-direction:column;gap:10px;">
        ${others.map((r) => {
          const no = r.objection_no || "-";
          const title = r.objection_title || "(No title)";
          const openDate = r.opening_date || "-";
          const details = short(r.objection_details || r.description || "", 100);

          const hasFile = !!r.attachment_path;
          const fileIcon = hasFile ? ` <span title="Attachment">📎</span>` : "";

          const viewFileBtn = hasFile
            ? `<a class="btn" href="${r.attachment_path}" target="_blank" rel="noopener" style="margin-left:8px;">Open File</a>`
            : "";

          return `
            <div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;background:#fff;">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:900;">
                    ${esc(no)} — ${esc(title)}${fileIcon}
                  </div>
                  <div style="font-size:12px;opacity:.8;margin-top:4px;">
                    <b>Opening:</b> ${esc(openDate)} &nbsp; • &nbsp; <b>ID:</b> ${esc(r.id)}
                  </div>
                  <div style="font-size:12px;opacity:.9;margin-top:6px;line-height:1.35;">
                    <b>Details:</b> ${esc(details)}
                  </div>
                </div>

                <div style="display:flex;gap:8px;align-items:center;white-space:nowrap;">
                  <button class="btn btn-primary" data-open-ao="${r.id}">
                    Open
                  </button>
                  ${viewFileBtn}
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    list.querySelectorAll("[data-open-ao]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-open-ao"));
        const found = sameBd.find(x => x.id === id);
        if (found) showDetails(found);
        else showToast("Record not found in list", "error");
      });
    });

  } catch (err) {
    console.error("loadSameBdAuditObjections error:", err);
    list.textContent = "Failed to load same BD objections.";
  }
}


/* ================== PRINT (View – Single) ================== */
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

  const html = `
    <div class="a4">
      <h1 class="title">SFC Air FRMS</h1>
      <div class="subtitle">File & Record Management System</div>

      <div class="grid">
        <div class="secBlock">
          <div class="secLabel">Section :</div>
          <div class="secVal">${sectionName}</div>

          <div class="secLabel">Subcategory:</div>
          <div class="secVal">${subName}</div>
        </div>

        <div class="qrBox">
          <div class="qrTitle">QR CODE</div>
          <img src="${qrUrl}" alt="QR"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="qrFallback" style="display:none;">QR</div>
        </div>

        <div class="card rackCard">
          <div class="cardLabel">Rack No.</div>
          <div class="cardValue">${rackNo}</div>
        </div>

        <div class="card serialCard">
          <div class="cardLabel">Serial No.</div>
          <div class="cardValue">${serialNo}</div>
        </div>
      </div>

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

          .rackCard{ grid-column: 1 / 2; margin-top: -160px; }
          .serialCard{ grid-column: 2 / 3; margin-top: -160px; }

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

window.addEventListener("click", (e) => {
  const modal = document.getElementById("recordModal");
  if (e.target === modal) closeModal();
});

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
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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

// ✅ Apply search from URL (?q=...)
const urlQ = getUrlParam("q");
if (urlQ) {
  const input = document.getElementById("searchInput");
  if (input) input.value = urlQ;
}

/* ================== INIT ================== */
document.addEventListener("DOMContentLoaded", () => {
  bindSearch();
  bindPageSize();
  bindPaginationButtons();
  bindEditForm();
  bindSingleMove();
  bindBulkMove();

  const rackSel = document.getElementById("rackFilter");
  if (rackSel) {
    rackSel.innerHTML = "";
    rackSel.add(new Option("All Racks", ""));
    rackSel.disabled = true;

    rackSel.addEventListener("change", () => {
      selectedRack = rackSel.value || "";
      currentPage = 1;
      fetchRecords(1);
    });
  }

  document
    .getElementById("printFromViewBtn")
    ?.addEventListener("click", startPrintFromView);

  document
    .getElementById("printLabelsBtn")
    ?.addEventListener("click", printLabelsForCurrentRack);

  loadConfig();
});
