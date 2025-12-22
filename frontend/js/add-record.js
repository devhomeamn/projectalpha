console.log("add-record.js loaded");

// ================== GLOBALS ==================
let API_BASE = "";
let bdOk = true;
let isSubmitting = false;
let lastBdCheckToken = 0;

// ================== CONFIG LOAD ==================
function normalizeApiBase(apiBaseFromServer) {
  // Server may send:
  // - "http://localhost:4000"  (no /api)
  // - "http://localhost:4000/api" (already /api)
  // - "" / undefined
  let base = (apiBaseFromServer || window.location.origin || "").trim();

  // remove trailing slash
  if (base.endsWith("/")) base = base.slice(0, -1);

  // If base already ends with /api, use it, otherwise append /api
  if (base.toLowerCase().endsWith("/api")) return base;

  return `${base}/api`;
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    // In some cases, backend might return non-JSON on error.
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) throw new Error("Config is not JSON");

    const data = await res.json();

    // IMPORTANT FIX:
    // previously you did: API_BASE = data.apiBase ? `${data.apiBase}/api` : `${origin}/api`;
    // If data.apiBase already had "/api", it became "/api/api" and broke BD check.
    API_BASE = normalizeApiBase(data.apiBase);

    console.log("API Base loaded:", API_BASE);
    initPage();
  } catch (err) {
    console.error("Could not load backend config:", err);
    API_BASE = normalizeApiBase(null);
    initPage();
  }
}
loadConfig();

// ================== SMALL UI HELPERS ==================
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function ensureMsg(afterElementId, msgId) {
  let el = document.getElementById(msgId);
  if (!el) {
    el = document.createElement("div");
    el.id = msgId;
    el.style.marginTop = "6px";
    el.style.fontSize = "13px";
    const target = document.getElementById(afterElementId);
    if (target) target.insertAdjacentElement("afterend", el);
  }
  return el;
}

function setMsg(el, text, ok = true, mode = "normal") {
  if (!el) return;
  el.textContent = text || "";
  if (!text) return;

  // mode: normal | warn
  if (mode === "warn") el.style.color = "#b36b00";
  else el.style.color = ok ? "green" : "red";
}

// ================== PAGE INIT ==================
function initPage() {
  const userInfo = document.getElementById("userInfo");
  if (userInfo) {
    userInfo.textContent = `Logged in as: ${
      localStorage.getItem("username") || "Unknown User"
    }`;
  }

  // Closing date max = today
  const closingInput = document.getElementById("closing_date");
  if (closingInput) {
    closingInput.max = todayISO();
    closingInput.addEventListener("input", checkClosingDateLive);
    // initial message clear
    checkClosingDateLive();
  }

  loadSections();

  const form = document.getElementById("recordForm");
  if (form) form.addEventListener("submit", onAddRecord);

  const bd = document.getElementById("bd_no");
  const sub = document.getElementById("subcategory_id");
  if (bd) bd.addEventListener("input", () => checkBdNoLive());
  if (sub) sub.addEventListener("change", () => {
    checkSubcategoryRequiredLive();
    checkBdNoLive();
  });

  // also show subcategory required message initially
  checkSubcategoryRequiredLive();
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

    if (!sectionSelect || !subSelect || !rackSelect || !serialInput) return;

    // Clear options
    sectionSelect.innerHTML = '<option value="">-- Select Section --</option>';
    subSelect.innerHTML = '<option value="">-- Select Subcategory --</option>';
    rackSelect.innerHTML = '<option value="">-- Select Rack --</option>';
    serialInput.value = "";

    // ✅ Populate sections except “Central Room”
    data.forEach((sec) => {
      if ((sec.name || "").trim().toLowerCase() === "central room") return;
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

      // refresh validation messages
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

        const used = (records || [])
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

// ================== CLOSING DATE VALIDATION (LIVE) ==================
function ensureClosingMsg() {
  return ensureMsg("closing_date", "closing_msg");
}

function checkClosingDateLive() {
  const closingInput = document.getElementById("closing_date");
  const msg = ensureClosingMsg();
  if (!closingInput) return true;

  const v = (closingInput.value || "").trim();
  if (!v) {
    setMsg(msg, "", true);
    return true;
  }

  const max = todayISO();
  if (v > max) {
    setMsg(msg, "❌ আজকের পরের date দেওয়া যাবে না", false);
    return false;
  }

  setMsg(msg, "✅ Closing date ঠিক আছে", true);
  return true;
}

// ================== BD UNIQUE (LIVE) ==================
function ensureBdMsg() {
  return ensureMsg("bd_no", "bd_msg");
}

/**
 * BD check: backend /records/check-bd returns: { available: true/false }
 * Fix: If fetch fails, do NOT show scary red error for first-time users.
 * We'll show a warning and allow submit; server will enforce uniqueness anyway.
 */
async function checkBdNoLive(force = false) {
  const bd_no = document.getElementById("bd_no")?.value.trim() || "";
  const subcategory_id = document.getElementById("subcategory_id")?.value || "";
  const msg = ensureBdMsg();

  // subcategory required msg update
  checkSubcategoryRequiredLive();

  if (!bd_no || !subcategory_id) {
    bdOk = true;
    setMsg(msg, "", true);
    return true;
  }

  // Token to ignore outdated responses (typing fast)
  const token = ++lastBdCheckToken;

  try {
    const url = `${API_BASE}/records/check-bd?bd_no=${encodeURIComponent(
      bd_no
    )}&subcategory_id=${encodeURIComponent(subcategory_id)}`;

    const res = await fetch(url);

    // Sometimes 404 returns HTML -> res.json() will throw
    const ct = res.headers.get("content-type") || "";
    let data = {};
    if (ct.includes("application/json")) data = await res.json();
    else data = { error: `Non-JSON response (status ${res.status})` };

    // If another newer request already happened, ignore this result
    if (token !== lastBdCheckToken) return bdOk;

    if (!res.ok) throw new Error(data.error || "Check failed");

    if (data.available) {
      bdOk = true;
      setMsg(msg, "✅ BD No available", true);
      return true;
    } else {
      bdOk = false;
      setMsg(msg, "❌ এই Subcategory-তে এই BD No আগে থেকেই আছে", false);
      return false;
    }
  } catch (e) {
    // IMPORTANT UX FIX:
    // don't block user on network/config glitch; server will still validate on submit.
    bdOk = true;
    setMsg(
      msg,
      "⚠️ BD No এখন verify করা যাচ্ছে না (server/connection)। Submit করলে server আবার যাচাই করবে।",
      true,
      "warn"
    );
    return true;
  }
}

// ================== SUBMIT DEDUPE (SLOW NET DOUBLE CLICK FIX) ==================
function getDedupeKey(payload) {
  // very simple stable key
  return [
    payload.file_name || "",
    payload.bd_no || "",
    payload.section_id || "",
    payload.subcategory_id || "",
    payload.rack_id || "",
    payload.serial_no || "",
    payload.closing_date || "",
  ].join("|");
}

function recentlySubmitted(key, windowMs = 10000) {
  try {
    const raw = sessionStorage.getItem("addRecord_lastSubmit");
    if (!raw) return false;
    const obj = JSON.parse(raw);
    if (!obj || obj.key !== key) return false;
    if (Date.now() - obj.ts < windowMs) return true;
    return false;
  } catch {
    return false;
  }
}

function markSubmitted(key) {
  try {
    sessionStorage.setItem(
      "addRecord_lastSubmit",
      JSON.stringify({ key, ts: Date.now() })
    );
  } catch {}
}

// ================== ADD RECORD ==================
async function onAddRecord(e) {
  e.preventDefault();
  if (isSubmitting) return;

  const file_name = document.getElementById("file_name")?.value.trim() || "";
  const bd_no = document.getElementById("bd_no")?.value.trim() || "";
  const section_id = document.getElementById("section_id")?.value || "";
  const subcategory_id = document.getElementById("subcategory_id")?.value || "";
  const rack_id = document.getElementById("rack_id")?.value || "";
  const serial_no = document.getElementById("serial_no")?.value.trim() || "";
  const description = document.getElementById("description")?.value.trim() || "";
  const closing_date = document.getElementById("closing_date")?.value || null;

  const added_by = localStorage.getItem("username") || "Unknown User";

  // Basic required checks
  if (!file_name || !section_id || !rack_id) {
    alert("Please fill in all required fields!");
    return;
  }

  // Subcategory + BD required (as per your controller requirement)
  if (!bd_no || !subcategory_id) {
    alert("BD No এবং Subcategory অবশ্যই দিতে হবে!");
    return;
  }

  // Closing date rule
  if (!checkClosingDateLive()) {
    alert("আজকের পরের closing date দেওয়া যাবে না।");
    return;
  }

  // Ensure serial exists
  if (!serial_no) {
    alert("Please select a Rack to generate Serial No.");
    return;
  }

  // Force a final BD check before submit (best effort)
  await checkBdNoLive(true);
  if (!bdOk) {
    alert("এই BD No এই Subcategory-তে আগে থেকেই আছে। অন্য BD No দিন।");
    return;
  }

  const payload = {
    file_name,
    bd_no,
    section_id,
    subcategory_id,
    rack_id,
    serial_no,
    description,
    closing_date,
    added_by,
  };

  // Client-side dedupe (10s)
  const key = getDedupeKey(payload);
  if (recentlySubmitted(key, 10000)) {
    alert("⚠️ একই ডাটা একটু আগেই submit হয়েছে। আবার submit করবেন না।");
    return;
  }

  // Disable submit UI
  const form = document.getElementById("recordForm");
  const submitBtn =
    form?.querySelector('button[type="submit"]') ||
    document.querySelector('button[type="submit"]');

  isSubmitting = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset._oldText = submitBtn.textContent;
    submitBtn.textContent = "Saving...";
  }

  try {
    // mark first to prevent double click while request in-flight
    markSubmitted(key);

    const res = await fetch(`${API_BASE}/records/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const ct = res.headers.get("content-type") || "";
    let data = {};
    if (ct.includes("application/json")) data = await res.json();
    else data = { error: `Non-JSON response (status ${res.status})` };

    if (!res.ok) throw new Error(data.error || "Failed to add record");

    alert("✅ Record Added Successfully!");
    e.target.reset();
    document.getElementById("serial_no").value = "";

    // reset messages
    setMsg(ensureBdMsg(), "", true);
    setMsg(ensureSubMsg(), "❌ Subcategory অবশ্যই সিলেক্ট করতে হবে", false);
    setMsg(ensureClosingMsg(), "", true);
    bdOk = true;
  } catch (err) {
    console.error("addRecord error:", err);
    alert("❌ " + err.message);

    // If failed, allow resubmission (remove recent submit mark)
    try {
      sessionStorage.removeItem("addRecord_lastSubmit");
    } catch {}
  } finally {
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset._oldText || "Add Record";
      delete submitBtn.dataset._oldText;
    }
  }
}

// ================== LOGOUT ==================
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}
