// js/profile.js
console.log("profile.js loaded");

// Toast fallback
function toast(msg, type = "success") {
  if (typeof window.showToast === "function") return window.showToast(msg, type);
  console.log(`[${type}]`, msg);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(val ?? "0");
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

async function apiFetchJson(url) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = typeof data === "string" ? data : (data?.error || "Request failed");
    throw new Error(msg);
  }
  return data;
}

function fillUserCardFromLocal() {
  const name = localStorage.getItem("name") || localStorage.getItem("username") || "User";
  const role = localStorage.getItem("role") || "User";
  const email = localStorage.getItem("email") || "--";
  const serviceid = localStorage.getItem("serviceid") || "--";
  const username = localStorage.getItem("username") || "--";
  const sectionId = localStorage.getItem("section_id") || "";

  setText("pNameText", name);
  setText("pRoleText", role);
  setText("pEmailText", email);
  setText("pServiceIdText", serviceid);
  setText("pUsernameText", username);

  // Assigned section (fallback text; name will be resolved from API below)
  const roleLower = String(role || "").toLowerCase();
  if (roleLower === "admin" || roleLower === "master") {
    setText("pSectionText", "All Sections");
  } else if (sectionId) {
    setText("pSectionText", `Section #${sectionId}`);
  } else {
    setText("pSectionText", "Not assigned");
  }

  const seed = encodeURIComponent(email !== "--" ? email : username);
  const av = document.getElementById("pAvatar");
  if (av) av.src = `https://robohash.org/${seed}.png?size=140x140`;
}

// Resolve section name for General users (and anyone who has a section_id)
async function loadAssignedSectionName() {
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const sectionId = (localStorage.getItem("section_id") || "").trim();
  if (!sectionId) return;

  // Admin/Master are not restricted to a single section
  if (role === "admin" || role === "master") return;

  try {
    // Using /api/sections list to map id -> name
    const sections = await apiFetchJson("/api/sections");
    const found = Array.isArray(sections)
      ? sections.find(s => String(s.id) === String(sectionId))
      : null;

    if (found?.name) {
      setText("pSectionText", found.name);
    } else {
      setText("pSectionText", `Section #${sectionId}`);
    }
  } catch (err) {
    console.warn("Assigned section name load failed:", err);
    // keep fallback
  }
}

function renderRecent(recent) {
  if (!Array.isArray(recent) || recent.length === 0) {
    setHtml("stRecent", '<div class="muted">No recent activity</div>');
    return;
  }

  const html = recent
    .map((r) => {
      const action = (r.action || "Activity").toUpperCase();
      const bd = r.bd_no || "-";
      const fn = r.file_name || r.filename || "-";
      const when = r.when ? `<div class="muted">${r.when}</div>` : "";

      return `
        <div class="item">
          <span class="badge">${action}</span>
          BD: <b>${bd}</b> — ${fn}
          ${when}
        </div>
      `;
    })
    .join("");

  setHtml("stRecent", html);
}

// Global chart instances
let statusChart = null;
let monthlyChart = null;

function initCharts() {
  // Doughnut Chart - Entry Status Distribution
  const statusCtx = document.getElementById('statusChart');
  if (statusCtx) {
    statusChart = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Ongoing', 'Closed', 'In Section', 'In Central'],
        datasets: [{
          data: [0, 0, 0, 0],
          backgroundColor: ['#f59e0b', '#6b7280', '#8b5cf6', '#ef4444'],
          borderWidth: 0,
          hoverOffset: 12
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 20, font: { size: 14 } } },
          tooltip: { backgroundColor: 'rgba(17, 24, 39, 0.9)' }
        }
      }
    });
  }

  // Bar Chart - Monthly Activity (Demo data initially)
  const monthlyCtx = document.getElementById('monthlyChart');
  if (monthlyCtx) {
    monthlyChart = new Chart(monthlyCtx, {
      type: 'bar',
      data: {
        labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
        datasets: [
          {
            label: 'Added',
            data: [0, 0, 0, 0, 0, 0],
            backgroundColor: '#10b981',
            borderRadius: 8
          },
          {
            label: 'Moved',
            data: [0, 0, 0, 0, 0, 0],
            backgroundColor: '#3b82f6',
            borderRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#e5e7eb' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
}

function updateCharts(data) {
  // Update Doughnut Chart with real status data
  if (statusChart) {
    statusChart.data.datasets[0].data = [
      data.ongoing ?? 0,
      data.closed ?? 0,
      data.inSection ?? 0,
      data.inCentral ?? 0
    ];
    statusChart.update('quiet'); // Smooth update without animation flash
  }

  // If backend sends monthly data (optional enhancement)
  if (data.monthly && monthlyChart) {
    const labels = Object.keys(data.monthly);
    const added = labels.map(m => data.monthly[m].added || 0);
    const moved = labels.map(m => data.monthly[m].moved || 0);

    monthlyChart.data.labels = labels;
    monthlyChart.data.datasets[0].data = added;
    monthlyChart.data.datasets[1].data = moved;
    monthlyChart.update('quiet');
  }
  // Else keep demo data or zero
}

async function loadMyStats() {
  // Loading states
  setText("stAdded", "…");
  setText("stMoved", "…");
  setText("stOngoing", "…");
  setText("stClosed", "…");
  setText("stInSection", "…");
  setText("stInCentral", "…");
  setHtml("stRecent", "Loading...");

  try {
    const data = await apiFetchJson("/api/dashboard/my-stats");

    // Update stats cards
    setText("stAdded", data.totalAdded ?? 0);
    setText("stMoved", data.totalMoved ?? 0);
    setText("stOngoing", data.ongoing ?? 0);
    setText("stClosed", data.closed ?? 0);
    setText("stInSection", data.inSection ?? 0);
    setText("stInCentral", data.inCentral ?? 0);

    // Update recent activity
    renderRecent(data.recent || []);

    // Update charts (if initialized)
    if (statusChart || monthlyChart) {
      updateCharts(data);
    }

    toast("✅ Stats updated successfully");
  } catch (err) {
    console.error("Stats load error:", err);
    toast("❌ Failed to load stats", "error");

    // Reset to zero on error
    setText("stAdded", 0);
    setText("stMoved", 0);
    setText("stOngoing", 0);
    setText("stClosed", 0);
    setText("stInSection", 0);
    setText("stInCentral", 0);
    setHtml("stRecent", '<div class="muted">Failed to load</div>');
  }
}


// Live Date & Time in header
function updateDateTime() {
  const now = new Date();

  const optionsDate = { day: '2-digit', month: 'long', year: 'numeric' };
  const formattedDate = now.toLocaleDateString('bn-BD', optionsDate); // বাংলায়: ০৩ জানুয়ারি ২০২৬

  const formattedTime = now.toLocaleTimeString('bn-BD', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  setText("currentDate", formattedDate);
  setText("currentTime", formattedTime);
}

// Update immediately and every minute


document.addEventListener("DOMContentLoaded", () => {
  fillUserCardFromLocal();
  loadAssignedSectionName();
  
  // Initialize charts first
  initCharts();
  
  // Then load data
  loadMyStats();
  updateDateTime();
setInterval(updateDateTime, 60000);


  // Refresh button
  document.getElementById("btnRefresh")?.addEventListener("click", () => {
    fillUserCardFromLocal();
    loadAssignedSectionName();
    loadMyStats();
  });
});