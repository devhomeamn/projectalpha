console.log("✅ add-section.js loaded");

let API_BASE = "";

// 🔧 Load backend API base from server (.env -> /api/config)
async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    API_BASE = data.apiBase ? `${data.apiBase}/api` : `${window.location.origin}/api`;
    console.log("✅ API Base loaded:", API_BASE);
    initPage();
  } catch (err) {
    console.error("⚠️ Could not load backend config:", err);
    API_BASE = `${window.location.origin}/api`;
    initPage();
  }
}

// ================== PAGE INIT ==================
function initPage() {
  const sectionForm = document.getElementById("sectionForm");
  if (sectionForm) sectionForm.addEventListener("submit", onAddSection);

  const subForm = document.getElementById("subForm");
  if (subForm) subForm.addEventListener("submit", onAddSubcategory);

  const rackForm = document.getElementById("rackForm");
  if (rackForm) rackForm.addEventListener("submit", onAddRack);

  fetchSections();
}

// ================== FETCH SECTIONS ==================
async function fetchSections() {
  try {
    console.log("📡 Fetching sections...");
    const res = await fetch(`${API_BASE}/sections`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const sectionSelect = document.getElementById("sectionSelect");
    const sectionSelectRack = document.getElementById("sectionSelectRack");
    const sectionList = document.getElementById("sectionList");

    if (sectionSelect) sectionSelect.innerHTML = "";
    if (sectionSelectRack) sectionSelectRack.innerHTML = "";
    if (sectionList) sectionList.innerHTML = "";

    data.forEach((sec) => {
      // dropdown for subcategory
      if (sectionSelect) {
        const opt1 = document.createElement("option");
        opt1.value = sec.id;
        opt1.textContent = sec.name;
        sectionSelect.appendChild(opt1);
      }

      // dropdown for rack
      if (sectionSelectRack) {
        const opt2 = document.createElement("option");
        opt2.value = sec.id;
        opt2.textContent = sec.name;
        sectionSelectRack.appendChild(opt2);
      }

      // section display
      if (sectionList) {
        const subs = sec.Subcategories?.map((s) => `<li>${s.name}</li>`).join("") || "";
        sectionList.innerHTML += `
          <div class="section-block">
            <h4>${sec.name}</h4>
            <ul>${subs}</ul>
          </div>`;
      }
    });
  } catch (err) {
    console.error("❌ fetchSections error:", err);
    alert("Server error — check if backend is running!");
  }
}

// ================== ADD NEW SECTION ==================
async function onAddSection(e) {
  e.preventDefault();
  const name = document.getElementById("sectionName").value.trim();
  const description = document.getElementById("sectionDesc").value.trim();

  try {
    const res = await fetch(`${API_BASE}/sections/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.json();
    alert("✅ Section added successfully!");

    e.target.reset();
    fetchSections();
  } catch (err) {
    console.error("❌ addSection error:", err);
  }
}

// ================== ADD SUBCATEGORY ==================
async function onAddSubcategory(e) {
  e.preventDefault();
  const sectionId = document.getElementById("sectionSelect").value;
  const name = document.getElementById("subName").value.trim();

  if (!sectionId || !name) {
    alert("⚠️ Please select a section and enter subcategory name!");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/sections/add-sub`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId, name }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.json();
    alert("✅ Subcategory added!");

    e.target.reset();
    fetchSections();
  } catch (err) {
    console.error("❌ addSubcategory error:", err);
  }
}

// ================== ADD RACK ==================
async function onAddRack(e) {
  e.preventDefault();
  const sectionId = document.getElementById("sectionSelectRack").value;
  const name = document.getElementById("rackName").value.trim();
  const description = document.getElementById("rackDesc").value.trim();

  if (!sectionId || !name) {
    alert("⚠️ Please select a section and enter rack name!");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/sections/add-rack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId, name, description }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.json();

    alert("✅ Rack added successfully!");
    e.target.reset();
  } catch (err) {
    console.error("❌ addRack error:", err);
    alert("Server error while adding rack!");
  }
}

// ================== LOGOUT ==================
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}

// ================== BOOT ==================
document.addEventListener("DOMContentLoaded", loadConfig);
