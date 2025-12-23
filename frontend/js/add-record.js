console.log("add-record.js loaded (fixed version)");

// ================== GLOBALS ==================
let API_BASE = "";
let bdOk = true;
let isSubmitting = false;
let lastBdCheckToken = 0;

// ================== CONFIG LOAD ==================
function normalizeApiBase(apiBaseFromServer) {
  let base = (apiBaseFromServer || window.location.origin || "").trim();
  if (base.endsWith("/")) base = base.slice(0, -1);
  if (base.toLowerCase().endsWith("/api")) return base;
  return `${base}/api`;
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) throw new Error("Config is not JSON");

    const data = await res.json();
    API_BASE = normalizeApiBase(data.apiBase);
    console.log("API Base loaded:", API_BASE);
  } catch (err) {
    console.error("Could not load backend config:", err);
    API_BASE = normalizeApiBase(null);
  }
  initPage(); // config load হোক বা না হোক, page init করবো
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

// ================== PAGE INIT ==================
async function initPage() {
  wirePrintButtonsOnce();

  const closingInput = document.getElementById("closing_date");
  if (closingInput) {
    closingInput.max = todayISO();
    closingInput.addEventListener("input", checkClosingDateLive);
  }

  await loadSections(); // sections load করার জন্য await করছি

  const form = document.getElementById("recordForm");
  if (form) form.addEventListener("submit", onAddRecord);

  const bd = document.getElementById("bd_no");
  const sub = document.getElementById("subcategory_id");
  if (bd) bd.addEventListener("input", () => checkBdNoLive());
  if (sub) sub.addEventListener("change", () => {
    checkSubcategoryRequiredLive();
    checkBdNoLive();
  });

  checkSubcategoryRequiredLive();
  checkClosingDateLive();
}

// ================== LOAD SECTIONS & RACKS ==================
async function loadSections() {
  try {
    const res = await fetch(`${API_BASE}/sections`);
    if (!res.ok) throw new Error("Failed to fetch sections");
    const data = await res.json();

    const sectionSelect = document.getElementById("section_id");
    const subSelect = document.getElementById("subcategory_id");
    const rackSelect = document.getElementById("rack_id");
    const serialInput = document.getElementById("serial_no");

    sectionSelect.innerHTML = '<option value="">-- Select Section --</option>';
    subSelect.innerHTML = '<option value="">-- Select Subcategory --</option>';
    rackSelect.innerHTML = '<option value="">-- Select Rack --</option>';
    serialInput.value = "";

    // Populate sections (skip Central Room)
    data.forEach((sec) => {
      if ((sec.name || "").trim().toLowerCase() === "central room") return;
      const opt = document.createElement("option");
      opt.value = sec.id;
      opt.textContent = sec.name;
      sectionSelect.appendChild(opt);
    });

    // Section change → load subcategories & racks
    sectionSelect.addEventListener("change", async () => {
      const sectionId = sectionSelect.value;
      subSelect.innerHTML = '<option value="">-- Select Subcategory --</option>';
      rackSelect.innerHTML = '<option value="">-- Select Rack --</option>';
      serialInput.value = "";

      checkSubcategoryRequiredLive();
      checkBdNoLive();

      if (!sectionId) return;

      const selected = data.find((s) => s.id == sectionId);
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
        if (!resRack.ok) throw new Error("Racks fetch failed");
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
        alert("Failed to load racks for this section.");
      }
    });

    // Rack change → auto serial
    rackSelect.addEventListener("change", async () => {
      const rackId = rackSelect.value;
      if (!rackId) {
        serialInput.value = "";
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/records/by-rack/${rackId}`);
        if (!res.ok) throw new Error("Serial fetch failed");
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
    console.error("Error loading sections:", err);
    alert("Failed to load sections. Please refresh the page.");
  }
}

// ================== VALIDATIONS (LIVE) ==================
function ensureMsg(afterId, msgId) {
  let el = document.getElementById(msgId);
  if (!el) {
    el = document.createElement("p");
    el.id = msgId;
    el.style.margin = "6px 0 0 0";
    el.style.fontSize = "13px";
    const target = document.getElementById(afterId);
    if (target && target.parentNode) {
      target.parentNode.insertBefore(el, target.nextSibling);
    }
  }
  return el;
}

function checkSubcategoryRequiredLive() {
  const val = document.getElementById("subcategory_id")?.value || "";
  const msg = ensureMsg("subcategory_id", "sub_msg");
  if (!val) {
    msg.textContent = "❌ Subcategory অবশ্যই সিলেক্ট করতে হবে";
    msg.style.color = "red";
    return false;
  }
  msg.textContent = "✅ Subcategory ঠিক আছে";
  msg.style.color = "green";
  return true;
}

function checkClosingDateLive() {
  const input = document.getElementById("closing_date");
  const msg = ensureMsg("closing_date", "closing_msg");
  const val = input?.value || "";
  if (!val) {
    msg.textContent = "";
    return true;
  }
  if (val > todayISO()) {
    msg.textContent = "❌ আজকের পরের date দেওয়া যাবে না";
    msg.style.color = "red";
    return false;
  }
  msg.textContent = "✅ Closing date ঠিক আছে";
  msg.style.color = "green";
  return true;
}

async function checkBdNoLive() {
  const bd_no = document.getElementById("bd_no")?.value.trim() || "";
  const subcategory_id = document.getElementById("subcategory_id")?.value || "";
  const msg = ensureMsg("bd_no", "bd_msg");

  if (!bd_no || !subcategory_id) {
    msg.textContent = "";
    bdOk = true;
    return;
  }

  const token = ++lastBdCheckToken;
  try {
    const url = `${API_BASE}/records/check-bd?bd_no=${encodeURIComponent(bd_no)}&subcategory_id=${encodeURIComponent(subcategory_id)}`;
    const res = await fetch(url);
    if (token !== lastBdCheckToken) return;

    const data = res.ok ? await res.json() : { available: false };

    if (data.available) {
      msg.textContent = "✅ BD No available";
      msg.style.color = "green";
      bdOk = true;
    } else {
      msg.textContent = "❌ এই Subcategory-তে এই BD No আগে থেকেই আছে";
      msg.style.color = "red";
      bdOk = false;
    }
  } catch (e) {
    msg.textContent = "⚠️ BD check failed (will validate on submit)";
    msg.style.color = "#b36b00";
    bdOk = true;
  }
}

// ================== SUBMIT ==================
async function onAddRecord(e) {
  e.preventDefault();
  if (isSubmitting) return;

  const payload = {
    file_name: document.getElementById("file_name")?.value.trim() || "",
    bd_no: document.getElementById("bd_no")?.value.trim() || "",
    section_id: document.getElementById("section_id")?.value || "",
    subcategory_id: document.getElementById("subcategory_id")?.value || "",
    rack_id: document.getElementById("rack_id")?.value || "",
    serial_no: document.getElementById("serial_no")?.value.trim() || "",
    description: document.getElementById("description")?.value.trim() || "",
    closing_date: document.getElementById("closing_date")?.value || null,
    added_by: localStorage.getItem("username") || "Unknown",
  };

  // Basic required check
  if (!payload.file_name || !payload.section_id || !payload.rack_id || !payload.bd_no || !payload.subcategory_id) {
    alert("সব required (*) ফিল্ড পূরণ করুন!");
    return;
  }

  if (!checkClosingDateLive() || !checkSubcategoryRequiredLive()) return;

  await checkBdNoLive();
  if (!bdOk) {
    alert("BD No already exists in this subcategory!");
    return;
  }

  if (!payload.serial_no) {
    alert("Rack select করুন যাতে Serial No auto-generate হয়।");
    return;
  }

  isSubmitting = true;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const oldText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  try {
    const res = await fetch(`${API_BASE}/records/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = res.ok ? await res.json() : { error: "Failed" };

    if (!res.ok) throw new Error(data.error || "Server error");

    const newId = data?.record?.id;
    if (newId) {
      // Fetch print data
      const printRes = await fetch(`${API_BASE}/records/print/${newId}`);
      if (printRes.ok) {
        const printData = await printRes.json();
        if (printData?.record) {
          renderPrintTemplate(printData.record);
          openPrintModal();
        }
      }
    }

    alert("✅ Record successfully added!");

    // Reset form but keep sections loaded
    e.target.reset();
    document.getElementById("serial_no").value = "";
    document.getElementById("subcategory_id").innerHTML = '<option value="">-- Select Subcategory --</option>';
    document.getElementById("rack_id").innerHTML = '<option value="">-- Select Rack --</option>';
    checkSubcategoryRequiredLive();
    checkClosingDateLive();

  } catch (err) {
    console.error(err);
    alert("❌ Error: " + (err.message || "Unknown error"));
  } finally {
    isSubmitting = false;
    submitBtn.disabled = false;
    submitBtn.textContent = oldText;
  }
}

// ================== PRINT MODAL ==================
function openPrintModal() {
  const modal = document.getElementById("printModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }
}

function closePrintModal() {
  const modal = document.getElementById("printModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }
}

function startPrintFromModal() {
  const area = document.getElementById("printArea");
  const root = document.getElementById("printRoot");

  if (!area || !root) {
    alert("Print area not found!");
    return;
  }

  // Copy content with full styling
  root.innerHTML = `
    <div class="print-area">
      <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h2 style="margin:0; font-size:24px; font-weight:bold;">SFC Air FRMS</h2>
          <div style="font-size:14px; opacity:0.8; margin-top:4px;">Record Print Copy</div>
        </div>
        <div style="text-align:right; font-size:15px;">
          <div><strong>BD No:</strong> ${area.querySelector('strong')?.parentElement?.textContent?.match(/BD No:.*$/) || ''}</div>
          <div><strong>Serial:</strong> ${area.querySelectorAll('strong')[1]?.parentElement?.textContent?.match(/Serial:.*$/) || ''}</div>
        </div>
      </div>
      ${area.innerHTML}
    </div>
  `;

  // Trigger print after small delay
  setTimeout(() => {
    window.print();
  }, 200);
}
window.addEventListener("afterprint", () => {
  document.getElementById("printRoot").innerHTML = "";
  document.body.classList.remove("printing");
});

function wirePrintButtonsOnce() {
  document.getElementById("btnClosePrint")?.addEventListener("click", closePrintModal);
  document.getElementById("btnPrintRecord")?.addEventListener("click", startPrintFromModal);

  const modal = document.getElementById("printModal");
  if (modal) modal.addEventListener("click", (e) => e.target === modal && closePrintModal());

  document.addEventListener("keydown", (e) => e.key === "Escape" && closePrintModal());
}

// ================== PRINT TEMPLATE ==================
function renderPrintTemplate(record) {
  const el = document.getElementById("printArea");
  if (!el) return;

  const createdAt = record.createdAt ? new Date(record.createdAt).toLocaleString("en-GB") : "";

  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
      <div>
        <h2 style="margin:0; font-size:20px;">SFC Air FRMS</h2>
        <div style="font-size:13px; opacity:0.75;">Record Print Copy</div>
      </div>
      <div style="text-align:right; font-size:14px;">
        <div><strong>BD No:</strong> ${record.bd_no || ""}</div>
        <div><strong>Serial:</strong> ${record.serial_no || ""}</div>
      </div>
    </div>

    <hr style="margin:16px 0; border-color:#ddd;" />

    <table style="width:100%; font-size:14px; border-collapse:collapse;">
      <tr><td style="padding:8px 0; width:180px; font-weight:600;">File Name</td><td>${record.file_name || ""}</td></tr>
      <tr><td style="padding:8px 0; font-weight:600;">Section</td><td>${record.Section?.name || ""}</td></tr>
      <tr><td style="padding:8px 0; font-weight:600;">Subcategory</td><td>${record.Subcategory?.name || ""}</td></tr>
      <tr><td style="padding:8px 0; font-weight:600;">Rack</td><td>${record.Rack?.name || ""}</td></tr>
      <tr><td style="padding:8px 0; font-weight:600;">Closing Date</td><td>${record.closing_date || ""}</td></tr>
      <tr><td style="padding:8px 0; font-weight:600;">Added By</td><td>${record.added_by || ""}</td></tr>
      <tr><td style="padding:8px 0; font-weight:600;">Created At</td><td>${createdAt}</td></tr>
      <tr><td style="padding:8px 0; font-weight:600; vertical-align:top;">Description</td><td>${(record.description || "").replace(/\n/g, "<br>")}</td></tr>
    </table>

    <hr style="margin:16px 0; border-color:#ddd;" />

    <div style="display:flex; justify-content:space-between; font-size:13px; margin-top:20px;">
      <div>Signature: _________________________</div>
      <div>Date: _________________________</div>
    </div>
  `;
}