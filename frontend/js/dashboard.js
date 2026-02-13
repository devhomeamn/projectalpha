console.log("dashboard.js loaded");

let API_BASE = "";
let includeCentral = false;
let recordsChart = null;

function getCurrentRole() {
  const raw = localStorage.getItem("role") || "";
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : "General";
}

function getAuthHeaders() {
  const token = localStorage.getItem("token") || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    API_BASE = data.apiBase ? `${data.apiBase}/api` : `${window.location.origin}/api`;
  } catch {
    API_BASE = `${window.location.origin}/api`;
  }
}

async function fetchSummary() {
  try {
    const url = `${API_BASE}/dashboard/summary?includeCentral=${includeCentral}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch summary");
    return await res.json();
  } catch (err) {
    console.error("Summary fetch failed:", err);
    return null;
  }
}

async function fetchMyStats() {
  try {
    const res = await fetch(`${API_BASE}/dashboard/my-stats`, {
      headers: getAuthHeaders(),
    });

    if (res.status === 401) {
      return null;
    }

    if (!res.ok) throw new Error("Failed to fetch my stats");
    return await res.json();
  } catch (err) {
    console.error("My stats fetch failed:", err);
    return null;
  }
}

function setTopStats(data) {
  if (!data) return;

  document.getElementById("totalSections").textContent = data.totalSections || 0;
  document.getElementById("totalRecords").textContent = data.totalRecords || 0;

  document.getElementById("centralToggleLabel").textContent =
    includeCentral ? "Central Included" : "Central Excluded";
}

function renderSections(sections) {
  const box = document.getElementById("sectionsContainer");
  box.innerHTML = "";

  if (!sections.length) {
    box.innerHTML = `<p style="color:#6b7280; padding:8px;">No sections found.</p>`;
    return;
  }

  sections.forEach((s, idx) => {
    const card = document.createElement("div");
    card.className = "section-card";

    // header
    const head = document.createElement("div");
    head.className = "section-head";
    head.innerHTML = `
      <span class="section-badge">${idx + 1}</span>
      <span class="section-title">${s.name}</span>
      <span class="section-meta">${s.recordCount} records</span>
      <span class="chev">&rsaquo;</span>
    `;

    // sub-list
    const subList = document.createElement("div");
    subList.className = "sub-list";

    if (!s.subcategories || s.subcategories.length === 0) {
      subList.innerHTML = `<div class="sub-item" style="color:#6b7280;">No subcategories</div>`;
    } else {
      s.subcategories.forEach((sb) => {
        const row = document.createElement("div");
        row.className = "sub-item";
        row.innerHTML = `
          <span class="sub-dot"></span>
          <span>${sb.name}</span>
          <span class="sub-count">${sb.recordCount}</span>
        `;
        subList.appendChild(row);
      });
    }

    // actions
    const actions = document.createElement("div");
    actions.className = "section-actions";
    actions.innerHTML = `
      <a href="view-record.html?section=${s.id}">View records in this section</a>
    `;

    // toggle collapse
    head.addEventListener("click", () => {
      card.classList.toggle("open");
    });

    card.appendChild(head);
    card.appendChild(subList);
    card.appendChild(actions);
    box.appendChild(card);
  });
}

function renderChart(sections) {
  const canvas = document.getElementById("recordsChart");
  if (!canvas || typeof Chart === "undefined") return;

  const topSections = [...sections]
    .sort((a, b) => (b.recordCount || 0) - (a.recordCount || 0))
    .slice(0, 8);

  const labels = topSections.map((s) => s.name);
  const values = topSections.map((s) => s.recordCount || 0);

  if (recordsChart) {
    recordsChart.destroy();
    recordsChart = null;
  }

  recordsChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Records",
        data: values,
        borderRadius: 8,
        backgroundColor: [
          "#2563eb",
          "#0ea5e9",
          "#10b981",
          "#f59e0b",
          "#f97316",
          "#ef4444",
          "#14b8a6",
          "#6366f1",
        ],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#475569", maxRotation: 0 } },
        y: { beginAtZero: true, ticks: { color: "#475569", precision: 0 } },
      },
    },
  });
}

function buildRoleCards(role, summary, myStats) {
  const sections = summary?.sections || [];

  if (role === "Admin") {
    const busiest = sections.reduce(
      (acc, s) => (s.recordCount > acc.recordCount ? s : acc),
      { name: "-", recordCount: 0 }
    );
    const zeroSections = sections.filter((s) => (s.recordCount || 0) === 0).length;
    const avg = summary?.totalSections
      ? (Number(summary.totalRecords || 0) / Number(summary.totalSections || 1)).toFixed(1)
      : "0.0";

    return [
      { label: "Busiest Section", value: busiest.name || "-", note: `${busiest.recordCount || 0} records` },
      { label: "Empty Sections", value: String(zeroSections), note: "Need assignment or cleanup" },
      { label: "Avg Records / Section", value: String(avg), note: "Distribution health indicator" },
      { label: "Filter State", value: includeCentral ? "Including Central" : "Excluding Central", note: "Affects all section stats" },
    ];
  }

  if (role === "Master") {
    return [
      { label: "My Added", value: String(myStats?.totalAdded || 0), note: "Records you created" },
      { label: "My Moved", value: String(myStats?.totalMoved || 0), note: "Transfer operations done by you" },
      { label: "My Ongoing", value: String(myStats?.ongoing || 0), note: "Open files that need action" },
      { label: "My Closed", value: String(myStats?.closed || 0), note: "Completed files" },
    ];
  }

  return [
    { label: "My Ongoing", value: String(myStats?.ongoing || 0), note: "Files currently open" },
    { label: "My Closed", value: String(myStats?.closed || 0), note: "Closed records so far" },
    { label: "In Section", value: String(myStats?.inSection || 0), note: "Your files currently in section" },
    { label: "In Central", value: String(myStats?.inCentral || 0), note: "Your files moved to central room" },
  ];
}

function renderRoleInsights(role, summary, myStats) {
  const titleEl = document.getElementById("roleInsightsTitle");
  const subtitleEl = document.getElementById("roleInsightsSubtitle");
  const grid = document.getElementById("roleInsightsGrid");

  if (!grid || !titleEl || !subtitleEl) return;

  const subtitleMap = {
    Admin: "System-level section and distribution control panel",
    Master: "Your workload and movement snapshot",
    General: "Your personal records progress and focus stats",
  };

  titleEl.textContent = `${role} Insights`;
  subtitleEl.textContent = subtitleMap[role] || subtitleMap.General;

  const cards = buildRoleCards(role, summary, myStats);
  grid.innerHTML = cards.map((item) => `
    <article class="ri-card">
      <div class="ri-label">${item.label}</div>
      <div class="ri-value">${item.value}</div>
      <div class="ri-note">${item.note}</div>
    </article>
  `).join("");
}

function renderRecentActivity(role, myStats) {
  const section = document.getElementById("recentActivitySection");
  const list = document.getElementById("activityList");
  if (!section || !list) return;

  if (role === "Admin") {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  const recent = Array.isArray(myStats?.recent) ? myStats.recent : [];

  if (!recent.length) {
    list.innerHTML = `<div class="activity-item"><div class="activity-title">No recent activity found.</div><div class="activity-time">Now</div></div>`;
    return;
  }

  list.innerHTML = recent.map((item) => `
    <div class="activity-item">
      <div>
        <div class="activity-title">${item.action || "Updated"}: ${item.file_name || "-"}</div>
        <div class="activity-sub">BD No: ${item.bd_no || "-"}</div>
      </div>
      <div class="activity-time">${item.when || "-"}</div>
    </div>
  `).join("");
}

async function refreshDashboard() {
  const role = getCurrentRole();
  const summary = await fetchSummary();
  const needMyStats = role !== "Admin";
  const myStats = needMyStats ? await fetchMyStats() : null;

  if (!summary) return;

  setTopStats(summary);
  renderSections(summary.sections || []);
  renderChart(summary.sections || []);
  renderRoleInsights(role, summary, myStats);
  renderRecentActivity(role, myStats);
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadConfig();

  const toggle = document.getElementById("includeCentralToggle");
  if (toggle) {
    toggle.addEventListener("change", (e) => {
      includeCentral = e.target.checked;
      refreshDashboard();
    });
  }

  refreshDashboard();
});
