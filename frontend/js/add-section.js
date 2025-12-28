console.log("add-section.js loaded");

let API_BASE = "";

// Load config
async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    API_BASE = data.apiBase ? `${data.apiBase}/api` : `${window.location.origin}/api`;
    console.log("API Base:", API_BASE);
    initPage();
  } catch (err) {
    console.error("Config load error:", err);
    API_BASE = `${window.location.origin}/api`;
    initPage();
  }
}

function initPage() {
  document.getElementById("sectionForm")?.addEventListener("submit", onAddSection);
  document.getElementById("subForm")?.addEventListener("submit", onAddSubcategory);
  document.getElementById("rackForm")?.addEventListener("submit", onAddRack);
  document.getElementById("centralRackForm")?.addEventListener("submit", onAddCentralRack);

  fetchSections();
  fetchCentralRacks();
}

// ================== FETCH SECTIONS ==================
async function fetchSections() {
  try {
    const res = await fetch(`${API_BASE}/sections`);
    const data = await res.json();

    const sectionSelect = document.getElementById("sectionSelect");
    const sectionSelectRack = document.getElementById("sectionSelectRack");
    const sectionList = document.getElementById("sectionList");

    if (sectionSelect) sectionSelect.innerHTML = '<option value="">-- Select Section --</option>';
    if (sectionSelectRack) sectionSelectRack.innerHTML = '<option value="">-- Select Section --</option>';
    if (sectionList) sectionList.innerHTML = "";

    data.forEach((sec) => {
      if (sec.name.toLowerCase() === "central room") return; // hide central room from dropdown

      if (sectionSelect) {
        const opt = document.createElement("option");
        opt.value = sec.id;
        opt.textContent = sec.name;
        sectionSelect.appendChild(opt);
      }

      if (sectionSelectRack) {
        const opt = document.createElement("option");
        opt.value = sec.id;
        opt.textContent = sec.name;
        sectionSelectRack.appendChild(opt);
      }

      if (sectionList) {
        const subs = sec.Subcategories?.map(s => `<li>${s.name}</li>`).join("") || "<li>No subcategories</li>";
        sectionList.innerHTML += `
          <div class="section-block">
            <h4>${sec.name}</h4>
            <p>${sec.description || "No description"}</p>
            <ul>${subs}</ul>
          </div>`;
      }
    });
  } catch (err) {
    console.error("fetchSections error:", err);
    alert("Failed to load sections!");
  }
}

// ================== ADD SECTION ==================
async function onAddSection(e) {
  e.preventDefault();
  const name = document.getElementById("sectionName").value.trim();
  const description = document.getElementById("sectionDesc").value.trim();

  if (!name) return alert("Section name required!");

  try {
    const res = await fetch(`${API_BASE}/sections/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });

    if (!res.ok) throw new Error((await res.json()).error);
    alert("Section added successfully!");
    e.target.reset();
    fetchSections();
  } catch (err) {
    alert(err.message);
  }
}

// ================== ADD SUBCATEGORY ==================
async function onAddSubcategory(e) {
  e.preventDefault();
  const sectionId = document.getElementById("sectionSelect").value;
  const name = document.getElementById("subName").value.trim();

  if (!sectionId || !name) return alert("Select section and enter name!");

  try {
    const res = await fetch(`${API_BASE}/sections/add-sub`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId, name }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    alert("Subcategory added!");
    e.target.reset();
    fetchSections();
  } catch (err) {
    alert(err.message);
  }
}

// ================== ADD RACK ==================
async function onAddRack(e) {
  e.preventDefault();
  const sectionId = document.getElementById("sectionSelectRack").value;
  const name = document.getElementById("rackName").value.trim();
  const description = document.getElementById("rackDesc").value.trim();

  if (!sectionId || !name) return alert("Select section and enter rack name!");

  try {
    const res = await fetch(`${API_BASE}/sections/add-rack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId, name, description }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    alert(data.message);
    e.target.reset();
  } catch (err) {
    alert(err.message);
  }
}

// ================== ADD CENTRAL ROOM RACK ==================
async function onAddCentralRack(e) {
  e.preventDefault();
  const name = document.getElementById("centralRackName").value.trim();
  const description = document.getElementById("centralRackDesc").value.trim();
  if (!name) return alert("Please enter rack name!");

  try {
    const res = await fetch(`${API_BASE}/sections/add-rack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, centralRoom: true }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    alert(data.message);
    e.target.reset();
    fetchCentralRacks();
  } catch (err) {
    alert(err.message);
  }
}

// ================== FETCH CENTRAL ROOM RACKS ==================
async function fetchCentralRacks() {
  try {
    const res = await fetch(`${API_BASE}/sections/central/racks`);
    const racks = await res.json();

    const list = document.getElementById("centralRackList");
    list.innerHTML = racks.length
      ? racks.map(r => `<div class="rack-item">${r.name} — ${r.description || ""}</div>`).join("")
      : "<p>No racks in Central Room yet.</p>";
  } catch (err) {
    console.error("fetchCentralRacks error:", err);
  }
}

document.addEventListener("DOMContentLoaded", loadConfig);