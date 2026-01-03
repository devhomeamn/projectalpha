console.log("dashboard.js loaded");

let API_BASE = "";
let includeCentral = false;

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
  const url = `${API_BASE}/dashboard/summary?includeCentral=${includeCentral}`;
  const res = await fetch(url);
  const data = await res.json();

  document.getElementById("totalSections").textContent = data.totalSections || 0;
  document.getElementById("totalRecords").textContent = data.totalRecords || 0;

  document.getElementById("centralToggleLabel").textContent =
    includeCentral ? "Central Included" : "Central Excluded";

  renderSections(data.sections || []);
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
      <span class="chev">›</span>
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


// Live Date & Time
function updateDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString('bn-BD', { day: '2-digit', month: 'long', year: 'numeric' });
  const time = now.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', hour12: false });

  document.getElementById("currentDate").textContent = date;
  document.getElementById("currentTime").textContent = time;
}


document.addEventListener("DOMContentLoaded", async () => {
  await loadConfig();

  const toggle = document.getElementById("includeCentralToggle");
  if (toggle) {
    toggle.addEventListener("change", (e) => {
      includeCentral = e.target.checked;
      fetchSummary();
    });
  }

  fetchSummary();
  updateDateTime();
setInterval(updateDateTime, 60000);
});
