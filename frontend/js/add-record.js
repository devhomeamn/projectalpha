console.log("add-record.js loaded");

/* ================== TOAST (Add Record) ================== */
function showToast(message, type = "success", ms = 3000) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, ms);
}

// optional: expose globally if needed
window.showToast = showToast;

// ================== GLOBALS ==================
let API_BASE = "";
let bdOk = true;
let isSubmitting = false;
let lastBdCheckToken = 0;

// for “required msg only when needed”
let subTouched = false;
let subSubmitAttempted = false;

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

  if (mode === "warn") el.style.color = "#b36b00";
  else el.style.color = ok ? "green" : "red";
}

// ================== PAGE INIT ==================
function initPage() {
  wirePrintButtonsOnce();
  
  const fileInput = document.getElementById("file_name");
if (fileInput) {
  fileInput.addEventListener("input", () => {
    fileInput.value = fileInput.value.toUpperCase();
  });
}


  const userInfo = document.getElementById("userInfo");
  if (userInfo) {
    userInfo.textContent = `Logged in as: ${
      localStorage.getItem("username") || "Unknown User"
    }`;
  }

  // Opening date max = today
  const openingInput = document.getElementById("opening_date");
  if (openingInput) {
    openingInput.max = todayISO();
    openingInput.addEventListener("input", () => {
      checkOpeningDateLive(true);
      checkClosingDateLive(false); // opening বদলালে closing validity re-check
    });
    checkOpeningDateLive(false); // initial = no message
  }

  // Closing date max = today
  const closingInput = document.getElementById("closing_date");
  if (closingInput) {
    closingInput.max = todayISO();
    closingInput.addEventListener("input", () => checkClosingDateLive(true));
    checkClosingDateLive(false); // initial = no message
  }

  // record_status -> closing date show/hide
  const rs = document.getElementById("record_status");
  const closingWrap =
    document.getElementById("closing_date")?.closest(".form-group") ||
    document.getElementById("closing_date")?.parentElement;

  function syncClosingVisibility() {
    const v = (rs?.value || "ongoing").toLowerCase();
    if (!closingWrap) return;

    if (v === "closed") {
      closingWrap.style.display = "";
    } else {
      closingWrap.style.display = "none";
      const c = document.getElementById("closing_date");
      if (c) c.value = "";
      setMsg(ensureClosingMsg(), "", true);
    }
  }

  if (rs) {
    rs.addEventListener("change", () => {
      syncClosingVisibility();
      checkOpeningDateLive(false);
      checkClosingDateLive(false);
    });
    syncClosingVisibility();
  }

  loadSections();

  const form = document.getElementById("recordForm");
  if (form) form.addEventListener("submit", onAddRecord);

  const bd = document.getElementById("bd_no");
  const sub = document.getElementById("subcategory_id");

  if (bd) bd.addEventListener("input", () => checkBdNoLive());
  if (sub) {
    sub.addEventListener("focus", () => (subTouched = true));
    sub.addEventListener("change", () => {
      subTouched = true;
      checkSubcategoryRequiredLive(false);
      checkBdNoLive();
    });
  }

  // ✅ initial load এ subcategory msg দেখাবে না
  checkSubcategoryRequiredLive(false);
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

    sectionSelect.innerHTML = '<option value="">-- Select Section --</option>';
    subSelect.innerHTML = '<option value="">-- Select Subcategory --</option>';
    rackSelect.innerHTML = '<option value="">-- Select Rack --</option>';
    serialInput.value = "";

    data.forEach((sec) => {
      if ((sec.name || "").trim().toLowerCase() === "central room") return;
      const opt = document.createElement("option");
      opt.value = sec.id;
      opt.textContent = sec.name;
      sectionSelect.appendChild(opt);
    });

    sectionSelect.addEventListener("change", async () => {
      const sectionId = sectionSelect.value;

      subSelect.innerHTML = '<option value="">-- Select Subcategory --</option>';
      rackSelect.innerHTML = '<option value="">-- Select Rack --</option>';
      serialInput.value = "";

      // section change হলে state reset
      subTouched = false;
      subSubmitAttempted = false;
      setMsg(ensureSubMsg(), "", true);

      // BD msg clear
      setMsg(ensureBdMsg(), "", true);
      bdOk = true;

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
        showToast("❌ Rack load করা যায়নি", "error");
      }
    });

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
    showToast("❌ Failed to load sections or racks!", "error");
  }
}

// ================== SUBCATEGORY REQUIRED ==================
function ensureSubMsg() {
  return ensureMsg("subcategory_id", "sub_msg");
}

/**
 * showMsg = true হলে message দেখাবে
 * showMsg = false হলে (initial load) message লুকানো থাকবে
 */
function checkSubcategoryRequiredLive(showMsg = true) {
  const subcategory_id = document.getElementById("subcategory_id")?.value || "";
  const msg = ensureSubMsg();

  const shouldShow = showMsg && (subTouched || subSubmitAttempted);

  if (!subcategory_id) {
    if (shouldShow) setMsg(msg, "❌ Subcategory অবশ্যই সিলেক্ট করতে হবে", false);
    else setMsg(msg, "", true);
    return false;
  }

  // selected হলে: touch/submit হলে success দেখাবে
  if (shouldShow) setMsg(msg, "✅ Subcategory ঠিক আছে", true);
  else setMsg(msg, "", true);

  return true;
}

// ================== OPENING DATE VALIDATION ==================
function ensureOpeningMsg() {
  return ensureMsg("opening_date", "opening_msg");
}

function checkOpeningDateLive(showMsg = true) {
  const openingInput = document.getElementById("opening_date");
  const msg = ensureOpeningMsg();
  if (!openingInput) return true;

  const v = (openingInput.value || "").trim();

  // required
  if (!v) {
    if (showMsg) setMsg(msg, "❌ Opening date দিতে হবে", false);
    else setMsg(msg, "", true);
    return false;
  }

  // not future
  const max = todayISO();
  if (v > max) {
    if (showMsg) setMsg(msg, "❌ আজকের পরের opening date দেওয়া যাবে না", false);
    else setMsg(msg, "", true);
    return false;
  }

  // if closing exists, opening cannot be after closing
  const closingInput = document.getElementById("closing_date");
  const c = (closingInput?.value || "").trim();
  if (c && c < v) {
    if (showMsg) setMsg(msg, "❌ Opening date closing date এর পরে হতে পারবে না", false);
    else setMsg(msg, "", true);
    return false;
  }

  if (showMsg) setMsg(msg, "✅ Opening date ঠিক আছে", true);
  else setMsg(msg, "", true);
  return true;
}

// ================== CLOSING DATE VALIDATION ==================
function ensureClosingMsg() {
  return ensureMsg("closing_date", "closing_msg");
}

function checkClosingDateLive(showMsg = true) {
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
    if (showMsg) setMsg(msg, "❌ আজকের পরের date দেওয়া যাবে না", false);
    else setMsg(msg, "", true);
    return false;
  }

  // opening date থাকলে closing >= opening হতে হবে
  const openingInput = document.getElementById("opening_date");
  const o = (openingInput?.value || "").trim();
  if (o && v < o) {
    if (showMsg) setMsg(msg, "❌ Closing date opening date এর আগে হতে পারবে না", false);
    else setMsg(msg, "", true);
    return false;
  }

  if (showMsg) setMsg(msg, "✅ Closing date ঠিক আছে", true);
  else setMsg(msg, "", true);

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

  // sub msg update (but only visible if touched/submit)
  checkSubcategoryRequiredLive(true);

  if (!bd_no || !subcategory_id) {
    bdOk = true;
    setMsg(msg, "", true);
    return true;
  }

  const token = ++lastBdCheckToken;

  try {
    const url = `${API_BASE}/records/check-bd?bd_no=${encodeURIComponent(
      bd_no
    )}&subcategory_id=${encodeURIComponent(subcategory_id)}`;

    const res = await fetch(url);

    const ct = res.headers.get("content-type") || "";
    let data = {};
    if (ct.includes("application/json")) data = await res.json();
    else data = { error: `Non-JSON response (status ${res.status})` };

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

// ================== SUBMIT DEDUPE ==================
function getDedupeKey(payload) {
  return [
    payload.file_name || "",
    payload.bd_no || "",
    payload.section_id || "",
    payload.subcategory_id || "",
    payload.rack_id || "",
    payload.serial_no || "",
    payload.opening_date || "",
    payload.record_status || "",
    payload.closing_date || "",
  ].join("|");
}

function recentlySubmitted(key, windowMs = 10000) {
  try {
    const raw = sessionStorage.getItem("addRecord_lastSubmit");
    if (!raw) return false;
    const obj = JSON.parse(raw);
    if (!obj || obj.key !== key) return false;
    return Date.now() - obj.ts < windowMs;
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

  subSubmitAttempted = true;

  const file_name = document.getElementById("file_name")?.value.trim() || "";
  const bd_no = document.getElementById("bd_no")?.value.trim() || "";
  const section_id = document.getElementById("section_id")?.value || "";
  const subcategory_id = document.getElementById("subcategory_id")?.value || "";
  const rack_id = document.getElementById("rack_id")?.value || "";
  const serial_no = document.getElementById("serial_no")?.value.trim() || "";
  const description = document.getElementById("description")?.value.trim() || "";
  const record_status = (
    document.getElementById("record_status")?.value || "ongoing"
  ).toLowerCase();
  const opening_date = document.getElementById("opening_date")?.value || "";
  let closing_date = document.getElementById("closing_date")?.value || null;
  if (record_status !== "closed") closing_date = null;

  const added_by = localStorage.getItem("username") || "Unknown User";

  if (!file_name || !section_id || !rack_id) {
    showToast("⚠️ Please fill in all required fields!", "warn");
    return;
  }

  // ✅ Opening date required
  if (!opening_date) {
    showToast("⚠️ Opening Date দিন।", "warn");
    return;
  }
  if (!checkOpeningDateLive(true)) {
    showToast("⚠️ Opening Date সঠিক নয়।", "warn");
    return;
  }

  // ✅ Closing date required only when Closed
  if (record_status === "closed") {
    if (!closing_date) {
      showToast("⚠️ Closed হলে Closing Date দিতে হবে।", "warn");
      return;
    }
    if (!checkClosingDateLive(true)) {
      showToast("⚠️ Closing Date সঠিক নয়।", "warn");
      return;
    }
    if (closing_date < opening_date) {
      showToast("⚠️ Closing Date, Opening Date এর আগে হতে পারবে না।", "warn");
      return;
    }
  }

  // ✅ required msg show only now
  const subOk = checkSubcategoryRequiredLive(true);

  if (!bd_no || !subcategory_id || !subOk) {
    showToast("⚠️ BD No এবং Subcategory অবশ্যই দিতে হবে!", "warn");
    return;
  }

  if (record_status === "closed" && !checkClosingDateLive(true)) {
    showToast("⚠️ Closing Date ঠিক করুন।", "error");
    return;
  }

  if (!serial_no) {
    showToast("⚠️ Please select a Rack to generate Serial No.", "warn");
    return;
  }

  await checkBdNoLive();
  if (!bdOk) {
    showToast("❌ এই BD No এই Subcategory-তে আগে থেকেই আছে। অন্য BD No দিন।", "error");
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
    opening_date,
    record_status,
    closing_date,
    added_by,
  };

  const key = getDedupeKey(payload);
  if (recentlySubmitted(key, 10000)) {
    showToast("⚠️ একই ডাটা একটু আগেই submit হয়েছে। আবার submit করবেন না।", "warn");
    return;
  }

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

    // ✅ after add: fetch print details and open modal preview
    const newId = data?.record?.id;

    if (newId) {
      try {
        const r2 = await fetch(`${API_BASE}/records/print/${newId}`);
        const ct2 = r2.headers.get("content-type") || "";
        const d2 = ct2.includes("application/json") ? await r2.json() : null;

        if (r2.ok && d2?.record) {
          renderPrintTemplate(d2.record);

          // ✅ Toast first, then open modal (so user sees message)
          showToast("✅ Record Added! Note: Print preview opened.", "success", 1600);
          setTimeout(() => openPrintModal(), 250);
        } else {
          showToast("✅ Record Added! (Print details not available)", "success");
        }
      } catch (e2) {
        console.error("print fetch error:", e2);
        showToast("✅ Record Added! (Print details fetch failed)", "success");
      }
    } else {
      showToast("✅ Record Added Successfully!", "success");
    }

    // reset form
    e.target.reset();
    const s = document.getElementById("serial_no");
    if (s) s.value = "";

    // reset messages (DON'T keep subcategory required line always)
    setMsg(ensureBdMsg(), "", true);
    setMsg(ensureSubMsg(), "", true);
    setMsg(ensureOpeningMsg(), "", true);
    setMsg(ensureClosingMsg(), "", true);

    bdOk = true;
    subTouched = false;
    subSubmitAttempted = false;

    // reset closing visibility (because record_status reset)
    const rs = document.getElementById("record_status");
    if (rs) {
      const closingWrap =
        document.getElementById("closing_date")?.closest(".form-group") ||
        document.getElementById("closing_date")?.parentElement;
      const v = (rs.value || "ongoing").toLowerCase();
      if (closingWrap) closingWrap.style.display = v === "closed" ? "" : "none";
    }
  } catch (err) {
    console.error("addRecord error:", err);
    showToast("❌ " + err.message, "error");

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

// ================== PRINT MODAL HELPERS ==================
function openPrintModal() {
  const m = document.getElementById("printModal");
  if (!m) return;
  m.classList.remove("hidden");
  m.setAttribute("aria-hidden", "false");
}

function closePrintModal() {
  const m = document.getElementById("printModal");
  if (!m) return;
  m.classList.add("hidden");
  m.setAttribute("aria-hidden", "true");
}

/**
 * ✅ iframe print (no duplicate/blank page)
 * Keeps your preview modal on screen, but print happens in iframe.
 */
function iframePrint(html) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Record Print</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color:#000; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; }
          td { padding: 6px 0; vertical-align: top; }
          hr { margin: 12px 0; }
          @page { margin: 10mm; }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 700);
  }, 250);
}

function startPrintFromModal() {
  const area = document.getElementById("printArea");
  if (!area) return showToast("❌ Print area not found!", "error");
  iframePrint(area.innerHTML);
}

function wirePrintButtonsOnce() {
  const btnClose = document.getElementById("btnClosePrint");
  const btnPrint = document.getElementById("btnPrintRecord");
  const modal = document.getElementById("printModal");

  if (btnClose && !btnClose.dataset.bound) {
    btnClose.dataset.bound = "1";
    btnClose.addEventListener("click", closePrintModal);
  }

  if (btnPrint && !btnPrint.dataset.bound) {
    btnPrint.dataset.bound = "1";
    btnPrint.addEventListener("click", startPrintFromModal);
  }

  if (modal && !modal.dataset.bound) {
    modal.dataset.bound = "1";
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closePrintModal();
    });
  }

  if (!document.body.dataset.printEscBound) {
    document.body.dataset.printEscBound = "1";
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePrintModal();
    });
  }
}

function safeText(v) {
  return v == null ? "" : String(v);
}

function renderPrintTemplate(record) {
  const el = document.getElementById("printArea");
  if (!el) return;

  const createdAt = record.createdAt
    ? new Date(record.createdAt).toLocaleString()
    : "";

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
      <div>
        <h2 style="margin:0 0 6px 0;">SFC Air FRMS</h2>
        <div style="font-size:13px;opacity:.75;">Record Print Copy</div>
      </div>
      <div style="text-align:right;font-size:13px;">
        <div><b>BD No:</b> ${safeText(record.bd_no)}</div>
        <div style="font-size:22px;font-weight:900;"><b>Serial:</b> ${safeText(
          record.serial_no
        )}</div>
      </div>
    </div>

    <hr style="margin:12px 0;"/>

    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;width:180px;"><b>File Name</b></td><td>${safeText(
        record.file_name
      )}</td></tr>
      <tr><td style="padding:6px 0;"><b>Section</b></td><td>${safeText(
        record.Section?.name
      )}</td></tr>
      <tr><td style="padding:6px 0;"><b>Subcategory</b></td><td>${safeText(
        record.Subcategory?.name
      )}</td></tr>
      <tr><td style="padding:6px 0;"><b>Rack</b></td><td>${safeText(
        record.Rack?.name
      )}</td></tr>
      <tr><td style="padding:6px 0;"><b>Current Status</b></td><td>${safeText(
        record.record_status || "ongoing"
      )}</td></tr>
      <tr><td style="padding:6px 0;"><b>Location</b></td><td>${
        record.status === "central" ? "In Central" : "In Section"
      }</td></tr>
      <tr><td style="padding:6px 0;"><b>Opening Date</b></td><td>${safeText(
        record.opening_date || ""
      )}</td></tr>
      <tr><td style="padding:6px 0;"><b>Closing Date</b></td><td>${safeText(
        record.closing_date || ""
      )}</td></tr>
      <tr><td style="padding:6px 0;"><b>Added By</b></td><td>${safeText(
        record.added_by || ""
      )}</td></tr>
      <tr><td style="padding:6px 0;"><b>Created At</b></td><td>${safeText(
        createdAt
      )}</td></tr>
      <tr><td style="padding:6px 0;"><b>Description</b></td><td>${safeText(
        record.description || ""
      )}</td></tr>
    </table>

    <hr style="margin:12px 0;"/>
    <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;">
      <div>Signature: ____________________</div>
      <div>Date: ____________________</div>
    </div>
  `;
}

// ================== LOGOUT ==================
function logout() {
  localStorage.clear();
  window.location.href = "login.html";
}
