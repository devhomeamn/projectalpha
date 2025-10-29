console.log("✅ add-record.js loaded");

let API_BASE = "";

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

loadConfig();

// ================== PAGE INIT ==================
function initPage() {
  const userInfo = document.getElementById("userInfo");
  if (userInfo) {
    userInfo.textContent = `Logged in as: ${localStorage.getItem("username") || "Unknown User"}`;
  }

  loadSections();
  document.getElementById("recordForm").addEventListener("submit", onAddRecord);
}

// ================== LOAD SECTIONS & RACKS ==================
async function loadSections() {
  try {
    const res = await fetch(`${API_BASE}/sections`);
    const data = await res.json();

    const sectionSelect = document.getElementById("section_id");
    const subSelect = document.getElementById("subcategory_id");
    const rackSelect = document.getElementById("rack_id");

    sectionSelect.innerHTML = '<option value="">-- Select Section --</option>';
    subSelect.innerHTML = '<option value="">-- Select Subcategory --</option>';
    rackSelect.innerHTML = '<option value="">-- Select Rack --</option>';

    data.forEach((sec) => {
      const opt = document.createElement("option");
      opt.value = sec.id;
      opt.textContent = sec.name;
      sectionSelect.appendChild(opt);
    });

    // When section changes
    sectionSelect.addEventListener("change", async () => {
      const sectionId = sectionSelect.value;
      subSelect.innerHTML = '<option value="">-- Select Subcategory --</option>';
      rackSelect.innerHTML = '<option value="">-- Select Rack --</option>';

      if (!sectionId) return;

      const selected = data.find((s) => s.id == sectionId);
      if (selected && selected.Subcategories) {
        selected.Subcategories.forEach((sub) => {
          const opt = document.createElement("option");
          opt.value = sub.id;
          opt.textContent = sub.name;
          subSelect.appendChild(opt);
        });
      }

      // 🧩 Load racks dynamically
      const resRack = await fetch(`${API_BASE}/sections/racks/${sectionId}`);
      const racks = await resRack.json();
      racks.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = r.name;
        rackSelect.appendChild(opt);
      });
    });
  } catch (err) {
    console.error("❌ Error loading sections/racks:", err);
    alert("Failed to load sections or racks!");
  }
}

// ================== ADD RECORD ==================
async function onAddRecord(e) {
  e.preventDefault();

  const file_name = document.getElementById("file_name").value.trim();
  const bd_no = document.getElementById("bd_no").value.trim();
  const section_id = document.getElementById("section_id").value;
  const subcategory_id = document.getElementById("subcategory_id").value;
  const rack_id = document.getElementById("rack_id").value;
  const description = document.getElementById("description").value.trim();
  const added_by = localStorage.getItem("username") || "Unknown User";

  if (!file_name || !section_id || !rack_id) {
    alert("⚠️ Please fill in all required fields!");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/records/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name,
        bd_no,
        section_id,
        subcategory_id,
        rack_id,
        description,
        added_by,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      alert("✅ Record Added Successfully!");
      e.target.reset();
    } else {
      alert(`❌ Failed to Add Record: ${data.error || "Unknown error"}`);
    }
  } catch (err) {
    console.error("❌ addRecord error:", err);
    alert("Server error while adding record!");
  }
}

// ================== LOGOUT ==================
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}
