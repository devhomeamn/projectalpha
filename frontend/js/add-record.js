console.log("add-record.js loaded");

let API_BASE = "";
let bdOk = true;

// ✅ prevent double submit on slow network
let isSubmittingRecord = false;

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

// ================== HELPERS ==================
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function ensureMsg(afterElId, msgId) {
  let el = document.getElementById(msgId);
  if (!el) {
    el = document.createElement("div");
    el.id = msgId;
    el.style.marginTop = "6px";
    el.style.fontSize = "13px";
    const target = document.getElementById(afterElId);
    if (target) target.insertAdjacentElement("afterend", el);
  }
  return el;
}

function setMsg(el, text, ok) {
  if (!el) return;
  el.textContent = text || "";
  el.style.color = ok ? "green" : "red";
}

// ================== PAGE INIT ==================
function initPage() {
  const userInfo = document.getElementById("userInfo");
  if (userInfo) {
    userInfo.textContent = `Logged in as: ${localStorage.getItem("username") || "Unknown User"}`;
  }

  // ✅ Closing date: prevent future date at input level
  const closingInput = document.getElementById("closing_date");
  if (closingInput) {
    closingInput.max = todayISO(); // ✅ আজকের পরে select করা যাবে না
    closingInput.addEventListener("change", checkClosingDateLive);
    closingInput.addEventListener("input", checkClosingDateLive);
  }

  loadSections();

  const form = document.getElementById("recordForm");
  if (form) form.addEventListener("submit", onAddRecord);

  // BD live check + subcategory required
  const bdEl = document.getElementById("bd_no");
  const subEl = document.getElementById("subcategory_id");

  if (bdEl) bdEl.addEventListener("input", checkBdNoLive);

  if (subEl) {
    subEl.addEventListener("change", () => {
      checkSubcategoryRequiredLive();
      checkBdNoLive();
    });
    subEl.addEventListener("blur", checkSubcategoryRequiredLive);
  }
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
      if (sec.name?.trim().toLowerCase() === "central room") return;
      const opt = document.createElement("option");
      opt.value = sec.id;
      opt.textContent = sec.name;
      sectionSelect.appendChild(opt);
    });

    // SECTION CHANGE
    sectionSelect.addEventListener("change", async () => {
      const sectionId = sectionSelect.value;

      subSelect.innerHTML = '<option value="">-- Select Subcategory --</option>';
      rackSelect.innerHTML = '<option value="">-- Select Rack --</option>';
      serialInput.value = "";

      // refresh messages
      checkSubcategoryRequiredLive();
      checkBdNoLive();

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

      // Load racks
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

    // RACK CHANGE → AUTO SERIAL
    rackSelect.addEventListener("change", async () => {
      const rackId = rackSelect.value;
      if (!rackId) {
        serialInput.value = "";
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/records/by-rack/${rackId}`);
        const records = await res.json();

        const used = records
          .map((r) => r.serial_no)
          .filter((n) => n != null)
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

// ================== SUBCATEGORY REQUIRED (LIVE) ==================
function ensureSubMsg() {
  return ensureMsg("subcategory_id", "sub_msg");
}

function checkSubcategoryRequiredLive() {
  const subcategory_id = document.getElementById("subcategory_id")?.value || "";
  const msg = ensureSubMsg();

  if (!subcategory_id) {
    setMsg(msg, "❌ Subcategory অবশ্যই সিলেক্ট করতে হবে", false);
    return false;
  }

  setMsg(msg, "✅ Subcategory ঠিক আছে", true);
  return true;
}

// ================== BD UNIQUE (LIVE) ==================
function ensureBdMsg() {
  return ensureMsg("bd_no", "bd_msg");
}

async function checkBdNoLive() {
  const bd_no = document.getElementById("bd_no")?.value.trim() || "";
  const subcategory_id = document.getElementById("subcategory_id")?.value || "";
  const msg = ensureBdMsg();

  // update subcategory required too
  checkSubcategoryRequiredLive();

  if (!bd_no || !subcategory_id) {
    bdOk = true;
    setMsg(msg, "", true);
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
      setMsg(msg, "✅ BD No available", true);
    } else {
      bdOk = false;
      setMsg(msg, "❌ এই Subcategory-তে এই BD No আগে থেকেই আছে", false);
    }
  } catch (e) {
    bdOk = false;
    setMsg(msg, "❌ BD No check করা যায়নি", false);
  }
}

// ================== CLOSING DATE (LIVE) ==================
function ensureClosingMsg() {
  return ensureMsg("closing_date", "closing_msg");
}

function checkClosingDateLive() {
  const input = document.getElementById("closing_date");
  const msg = ensureClosingMsg();
  if (!input) return true;

  const v = (input.value || "").trim();
  const t = todayISO();

  if (!v) {
    setMsg(msg, "❌ Closing Date অবশ্যই দিতে হবে", false);
    return false;
  }

  // ✅ future date not allowed
  if (v > t) {
    setMsg(msg, "❌ Closing Date আজকের পরে দেওয়া যাবে না", false);
    return false;
  }

  setMsg(msg, "✅ Closing Date ঠিক আছে", true);
  return true;
}

// ================== ADD RECORD ==================
async function onAddRecord(e) {
  e.preventDefault();

  // ✅ prevent double submit (slow net / double click)
  if (isSubmittingRecord) return;
  isSubmittingRecord = true;

  const form = document.getElementById("recordForm");
  const submitBtn = form?.querySelector('button[type="submit"]');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset.oldText = submitBtn.textContent;
    submitBtn.textContent = "Saving...";
    submitBtn.style.opacity = "0.7";
    submitBtn.style.cursor = "not-allowed";
  }

  try {
    const file_name = document.getElementById("file_name").value.trim();
    const bd_no = document.getElementById("bd_no").value.trim();
    const section_id = document.getElementById("section_id").value;
    const subcategory_id = document.getElementById("subcategory_id").value;
    const rack_id = document.getElementById("rack_id").value;
    const serial_no = document.getElementById("serial_no").value.trim();
    const description = document.getElementById("description").value.trim();
    const closing_date = document.getElementById("closing_date").value || null;

    const added_by = localStorage.getItem("username") || "Unknown User";

    // Required base
    if (!file_name || !section_id || !rack_id) {
      alert("Please fill in all required fields!");
      return;
    }

    // ✅ Subcategory required + message
    if (!checkSubcategoryRequiredLive()) {
      alert("Subcategory সিলেক্ট করুন!");
      return;
    }

    // ✅ Closing date required + not future
    if (!checkClosingDateLive()) {
      alert("Closing Date ঠিক করে দিন (আজকের পরে দেওয়া যাবে না)!");
      return;
    }

    // BD + Subcategory required
    if (!bd_no || !subcategory_id) {
      alert("BD No এবং Subcategory অবশ্যই দিতে হবে!");
      return;
    }

    // BD unique ok?
    if (!bdOk) {
      alert("এই BD No এই Subcategory-তে আগে থেকেই আছে। অন্য BD No দিন।");
      return;
    }

    if (!serial_no) {
      alert("Please select a Rack to generate Serial No.");
      return;
    }

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
        closing_date,
        added_by,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to add record");

    alert("✅ Record Added Successfully!");
    form.reset();

    // reset serial
    const serialEl = document.getElementById("serial_no");
    if (serialEl) serialEl.value = "";

    // reset messages
    setMsg(ensureBdMsg(), "", true);
    setMsg(ensureSubMsg(), "", true);
    setMsg(ensureClosingMsg(), "", true);
    bdOk = true;
  } catch (err) {
    console.error("addRecord error:", err);
    alert("❌ " + err.message);
  } finally {
    // ✅ ALWAYS unlock
    isSubmittingRecord = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.oldText || "Add Record";
      submitBtn.style.opacity = "1";
      submitBtn.style.cursor = "pointer";
    }
  }
}

// ================== LOGOUT ==================
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}
