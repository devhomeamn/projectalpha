// reports.js

let API_BASE = "";
let configLoaded = false;

async function loadConfig() {
  if (configLoaded) return;
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    API_BASE = data.apiBase
      ? `${data.apiBase}/api`
      : `${window.location.origin}/api`;
  } catch {
    API_BASE = `${window.location.origin}/api`;
  } finally {
    configLoaded = true;
  }
}

// ✅ global init (but openReport still awaits to be safe)
loadConfig();

window.openReport = async function (type) {
  // ✅ ensure API base ready
  await loadConfig();

  const reportArea = document.getElementById("reportArea");
  reportArea.style.display = "block";
  reportArea.innerHTML = `<p>Loading...</p>`;

  let url = "";
  let title = "";

  if (type === "section") {
    url = `${API_BASE}/reports/section-wise`;
    title = "Section Wise Records Report";
  }
  if (type === "central") {
    url = `${API_BASE}/reports/central`;
    title = "Central Records Report";
  }
  if (type === "movement") {
    url = `${API_BASE}/reports/movement-history`;
    title = "Movement History Report";
  }
  if (type === "user") {
    url = `${API_BASE}/reports/user-activity`;
    title = "User Activity Report";
  }
  if (type === "monthly") {
    url = `${API_BASE}/reports/monthly-summary`;
    title = "Monthly Summary Report";
  }

  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("📦 Monthly report raw response =", data);

    reportArea.innerHTML = `
      <h3>${title}</h3>
      <div class="report-actions">
        <button class="btn-primary" onclick="downloadPDF('${title}')">⬇️ Download PDF</button>
      </div>
      ${renderReportHTML(type, data)}
    `;
  } catch (err) {
    console.error("Report fetch error:", err);
    reportArea.innerHTML = `<p style="color:red;">❌ Report load failed.</p>`;
  }
};

function renderReportHTML(type, data) {
  if (type === "section") {
    let html = "";
    Object.keys(data || {}).forEach((secName) => {
      const sec = data[secName];
      html += `<h4>📌 ${secName} (Total: ${sec.count})</h4>`;
      html += tableHTML(sec.items, true);
    });
    return html || "<p>No section data found.</p>";
  }

  if (type === "central") {
    return tableHTML(data, true, true);
  }

  if (type === "movement") {
    return tableHTML(data, true, true, true);
  }

  if (type === "user") {
    const addedRows = (data.added || [])
      .map((a) => {
        const user = a.added_by || a.dataValues?.added_by || "Unknown";
        const totalAdded =
          a.total_added ??
          a.dataValues?.total_added ??
          a.get?.("total_added") ??
          a.count ??
          a.total ??
          0;

        return `<tr><td>${user}</td><td>${totalAdded}</td></tr>`;
      })
      .join("");

    const movedRows = (data.moved || [])
      .map((m) => {
        const user = m.moved_by || m.dataValues?.moved_by || "Unknown";
        const totalMoved =
          m.total_moved ??
          m.dataValues?.total_moved ??
          m.get?.("total_moved") ??
          m.count ??
          m.total ??
          0;

        return `<tr><td>${user}</td><td>${totalMoved}</td></tr>`;
      })
      .join("");

    return `
      <h4>➕ Added By Summary</h4>
      <table>
        <thead><tr><th>User</th><th>Total Added</th></tr></thead>
        <tbody>${addedRows || `<tr><td colspan="2">No data</td></tr>`}</tbody>
      </table>
      <br/>
      <h4>🚚 Moved By Summary</h4>
      <table>
        <thead><tr><th>User</th><th>Total Moved</th></tr></thead>
        <tbody>${movedRows || `<tr><td colspan="2">No data</td></tr>`}</tbody>
      </table>
    `;
  }

  if (type === "monthly") {
    return renderMonthlyReport(data);
  }

  return "<p>No data</p>";
}

// ✅ table helper
function tableHTML(records, showLocation = false, showCentral = false, showPrev = false) {
  if (!records || records.length === 0) return "<p>No records found.</p>";

  const rows = records
    .map(
      (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.file_name}</td>
        <td>${r.bd_no || "-"}</td>
        ${showLocation ? `<td>${r.Section?.name || "-"}</td>` : ""}
        ${showLocation ? `<td>${r.Subcategory?.name || "-"}</td>` : ""}
        ${showLocation ? `<td>${r.Rack?.name || "-"}</td>` : ""}
        <td>${r.serial_no ?? "-"}</td>
        ${showCentral ? `<td>${r.moved_by || "-"}</td>` : ""}
        ${showCentral ? `<td>${r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "-"}</td>` : ""}
        ${
          showPrev
            ? `<td>${r.previous_location?.section_name || "-"} / ${r.previous_location?.subcategory_name || "-"} / ${r.previous_location?.rack_name || "-"}</td>`
            : ""
        }
      </tr>
    `
    )
    .join("");

  return `
    <table>
      <thead>
        <tr>
          <th>SL</th>
          <th>File</th>
          <th>BD No</th>
          ${showLocation ? `<th>Section</th>` : ""}
          ${showLocation ? `<th>Subcategory</th>` : ""}
          ${showLocation ? `<th>Rack</th>` : ""}
          <th>Serial</th>
          ${showCentral ? `<th>Moved By</th>` : ""}
          ${showCentral ? `<th>Moved At</th>` : ""}
          ${showPrev ? `<th>Previous Location</th>` : ""}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ✅ Monthly renderer (robust keys)
function renderMonthlyReport(data) {
  const created = Array.isArray(data?.createdByMonth) ? data.createdByMonth : [];
  const moved = Array.isArray(data?.movedByMonth) ? data.movedByMonth : [];

  const map = new Map();

  // created month merge
  created.forEach((r) => {
    const month = r.month || r.Month || r.created_month;
    const total = Number(
      r.total_created ??
        r.total_added ??
        r.created_count ??
        r.count ??
        r.total ??
        0
    );
    if (!month) return;
    map.set(month, { month, total_created: total, total_moved: 0 });
  });

  // moved month merge
  // moved month merge
moved.forEach((r) => {
  const month = r.month || r.Month || r.moved_month;

  const total = Number(
    r.total_moved_central ??   // ✅ NEW KEY from your backend
    r.total_moved ??
    r.total_central ??
    r.moved_count ??
    r.count ??
    r.total ??
    0
  );

  if (!month) return;

  if (!map.has(month)) {
    map.set(month, { month, total_created: 0, total_moved: total });
  } else {
    map.get(month).total_moved = total;
  }
});


  const rows = [...map.values()].sort((a, b) =>
    String(a.month).localeCompare(String(b.month))
  );

  if (!rows.length) return `<p>No monthly data found</p>`;

  return `
    <h4>📅 Monthly Summary</h4>
    <table>
      <thead>
        <tr>
          <th>Month</th>
          <th>Total Created</th>
          <th>Total Moved to Central</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td>${r.month}</td>
            <td>${r.total_created}</td>
            <td>${r.total_moved}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

// ✅ PDF download
window.downloadPDF = function (title) {
  const reportArea = document.getElementById("reportArea");

  const opt = {
    margin: 0.4,
    filename: `${title
      .replace(/\s+/g, "_")
      .toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
  };

  html2pdf().set(opt).from(reportArea).save();
};
