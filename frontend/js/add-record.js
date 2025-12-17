console.log("add-record.js loaded");

let API_BASE = "";
let bdOk = true;

// ================== CONFIG LOAD ==================
async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    API_BASE = data.apiBase ? `${data.apiBase}/api` : `${window.location.origin}/api`;
    console.log("API Base loaded:", API_BASE);
    initPage();
  } catch (err) {
    console.error("Could not load backend config:", err);
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
  
  document.getElementById("bd_no").addEventListener("input", checkBdNoLive);
document.getElementById("subcategory_id").addEventListener("change", checkBdNoLive);

}

// ================== LOAD SECTIONS & RACKS ==================
async function loadSections() {
  try {
    const res = await fetch(`${API_BASE}/sections`);
    const data = await res.json();

    const sectionSelect = document.getElementById("section_id");
    const subSelect = document.getElementById("subcategory_id");
    const rackSelect = document.getElementById("rack_id");
    const serialInput = document.getElementById("serial_no");

    // Clear options
    sectionSelect.innerHTML = '<option value="">-- Select Section --</option>';
    subSelect.innerHTML = '<option value="">-- Select Subcategory --</option>';
    rackSelect.innerHTML = '<option value="">-- Select Rack --</option>';
    serialInput.value = "";

    // ✅ Populate sections except “Central Room”
    data.forEach((sec) => {
      if (sec.name.trim().toLowerCase() === "central room") return; // hide central room
      const opt = document.createElement("option");
      opt.value = sec.id;
      opt.textContent = sec.name;
      sectionSelect.appendChild(opt);
    });

    // ================== SECTION CHANGE ==================
    sectionSelect.addEventListener("change", async () => {
      const sectionId = sectionSelect.value;

      subSelect.innerHTML = '<option value="">-- Select Subcategory --</option>';
      rackSelect.innerHTML = '<option value="">-- Select Rack --</option>';
      serialInput.value = "";

      if (!sectionId) return;

      const selected = data.find((s) => s.id == sectionId);

      // Subcategories
      if (selected?.Subcategories?.length) {
        selected.Subcategories.forEach((sub) => {
          const opt = document.createElement("option");
          opt.value = sub.id;
          opt.textContent = sub.name;
          subSelect.appendChild(opt);
        });
      }

      // Load Racks dynamically
      try {
        const resRack = await fetch(`${API_BASE}/sections/racks/${sectionId}`);
        const racks = await resRack.json();
        rackSelect.innerHTML = '<option value="">-- Select Rack --</option>';
        racks.forEach((r) => {
          const opt = document.createElement("option");
          opt.value = r.id;
          opt.textContent = r.name;
          rackSelect.appendChild(opt);
        });
      } catch (err) {
        console.error("Rack load error:", err);
      }
    });

    // ================== RACK CHANGE → AUTO SERIAL ==================
    rackSelect.addEventListener("change", async () => {
      const rackId = rackSelect.value;
      if (!rackId) {
        serialInput.value = "";
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/records/by-rack/${rackId}`);
        const records = await res.json();

        // get all existing serial numbers and calculate next available
        const used = records
          .map(r => r.serial_no)
          .filter(n => n != null)
          .map(Number)
          .sort((a, b) => a - b);

        let next = 1;
        for (let num of used) {
          if (num === next) next++;
          else break;
        }
        serialInput.value = next;
      } catch (err) {
        console.error("Serial fetch error:", err);
        serialInput.value = "1";
      }
    });
  } catch (err) {
    console.error("Error loading sections/racks:", err);
    alert("Failed to load sections or racks!");
  }
}


function ensureBdMsg() {
  let el = document.getElementById("bd_msg");
  if (!el) {
    el = document.createElement("div");
    el.id = "bd_msg";
    el.style.marginTop = "6px";
    el.style.fontSize = "13px";
    document.getElementById("bd_no").insertAdjacentElement("afterend", el);
  }
  return el;
}

async function checkBdNoLive() {
  const bd_no = document.getElementById("bd_no").value.trim();
  const subcategory_id = document.getElementById("subcategory_id").value;
  const msg = ensureBdMsg();

  if (!bd_no || !subcategory_id) {
    bdOk = true;
    msg.textContent = "";
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE}/records/check-bd?bd_no=${encodeURIComponent(bd_no)}&subcategory_id=${subcategory_id}`
    );
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Check failed");

    if (data.available) {
      bdOk = true;
      msg.textContent = "✅ BD No available";
      msg.style.color = "green";
    } else {
      bdOk = false;
      msg.textContent = "❌ এই Subcategory-তে এই BD No আগে থেকেই আছে";
      msg.style.color = "red";
    }
  } catch (e) {
    bdOk = false;
    msg.textContent = "❌ BD No check করা যায়নি";
    msg.style.color = "red";
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
  const serial_no = document.getElementById("serial_no").value.trim();
  const description = document.getElementById("description").value.trim();
  const added_by = localStorage.getItem("username") || "Unknown User";

  if (!file_name || !section_id || !rack_id) {
    alert("Please fill in all required fields!");
    return;
  }
  if (!bd_no || !subcategory_id) {
  alert("BD No এবং Subcategory অবশ্যই দিতে হবে!");
  return;
}

if (!bdOk) {
  alert("এই BD No এই Subcategory-তে আগে থেকেই আছে। অন্য BD No দিন।");
  return;
}


  if (!serial_no) {
    alert("Please select a Rack to generate Serial No.");
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
        serial_no,
        description,
        added_by,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to add record");

    alert("✅ Record Added Successfully!");
    e.target.reset();
    document.getElementById("serial_no").value = "";
  } catch (err) {
    console.error("addRecord error:", err);
    alert("❌ " + err.message);
  }
}

// ================== LOGOUT ==================
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}
