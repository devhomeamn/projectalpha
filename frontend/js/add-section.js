console.log("add-section.js loaded");

let API_BASE = "";

/* =========================
   Helpers
========================= */
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   Toast
========================= */
function showToast(msg, type = "success", ms = 3000) {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);

  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    t.addEventListener("transitionend", () => t.remove(), { once: true });
  }, ms);
}

function askConfirm(message, title = "Confirm Action", okText = "Delete") {
  return new Promise((resolve) => {
    const modal = document.getElementById("asConfirmModal");
    const msgEl = document.getElementById("asConfirmMessage");
    const titleEl = document.getElementById("asConfirmTitle");
    const okBtn = document.getElementById("asConfirmOk");
    const cancelBtn = document.getElementById("asConfirmCancel");

    if (!modal || !msgEl || !titleEl || !okBtn || !cancelBtn) {
      resolve(window.confirm(message));
      return;
    }

    msgEl.textContent = message;
    titleEl.textContent = title;
    okBtn.textContent = okText;

    const close = (val) => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onEsc);
      resolve(val);
    };

    const onOk = () => close(true);
    const onCancel = () => close(false);
    const onBackdrop = (e) => {
      if (e.target === modal) close(false);
    };
    const onEsc = (e) => {
      if (e.key === "Escape") close(false);
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    modal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onEsc);

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  });
}

/* =========================
   JWT Auth Fetch Wrapper
   - Adds Authorization header
   - Handles 401/403
========================= */
function getToken() {
  return localStorage.getItem("token") || "";
}

function redirectToLogin() {
  localStorage.clear();
  window.location.href = "login.html";
}

function redirectToUserDashboard() {
  // admin page -> non-admin should go to user dashboard
  window.location.href = "dashboard-user.html";
}

async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  // JSON header unless FormData
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  // Token missing/expired
  if (res.status === 401) {
    showToast("Session expired. Please login again.", "error", 3500);
    setTimeout(redirectToLogin, 900);
    throw new Error("Unauthorized");
  }

  // Logged in but not admin
  if (res.status === 403) {
    showToast("Access denied. Admin only.", "error", 3500);
    setTimeout(redirectToUserDashboard, 900);
    throw new Error("Forbidden");
  }

  return res;
}

/* =========================
   Collapse toggles
========================= */
function initListCollapse() {
  document.querySelectorAll(".list-toggle").forEach((btn) => {
    const targetSel = btn.getAttribute("data-target");
    const target = document.querySelector(targetSel);
    if (!target) return;

    btn.addEventListener("click", () => {
      const collapsed = target.classList.toggle("is-collapsed");
      btn.textContent = collapsed ? "Expand" : "Collapse";
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
  });
}

/* =========================
   Print Racks (event delegate)
========================= */
function initRackPrint(root) {
  // avoid binding multiple times on re-render
  if (root.dataset.rackPrintBound === "1") return;
  root.dataset.rackPrintBound = "1";

  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".rack-print-btn");
    if (!btn) return;

    // prevent accordion toggle
    e.preventDefault();
    e.stopPropagation();

    const secName = btn.getAttribute("data-secname") || "Section";
    let racks = [];
    try {
      racks = JSON.parse(btn.getAttribute("data-racks") || "[]");
    } catch {
      racks = [];
    }

    startPrintRacks(secName, racks);
  });
}

function startPrintRacks(sectionName, racks) {
  const safeSection = escapeHtml(sectionName);
  const rackList = Array.isArray(racks) ? racks : [];

  // প্রতি পেজে 5টা করে
  const pages = [];
  for (let i = 0; i < rackList.length; i += 5) {
    pages.push(rackList.slice(i, i + 5));
  }

  const pageHtml = pages.length
    ? pages
        .map((group) => {
          const labels = group
            .map((rack) => {
              const r = escapeHtml(rack);
              return `
                <div class="label">
                  <div class="section">Section: ${safeSection}</div>
                  <div class="rack">
                    <span class="rackText">Rack No:</span>
                    <span class="rackNo">${r}</span>
                  </div>
                </div>
              `;
            })
            .join("");

          const empties = 5 - group.length;
          const emptyLabels =
            empties > 0 ? `<div class="label empty"></div>`.repeat(empties) : "";

          return `
            <div class="page">
              ${labels}
              ${emptyLabels}
            </div>
          `;
        })
        .join("")
    : `
      <div class="page">
        <div class="label">
          <div class="section">Section: ${safeSection}</div>
          <div class="rack">
            <span class="rackText">Rack No:</span>
            <span class="rackNo">N/A</span>
          </div>
        </div>
        <div class="label empty"></div>
        <div class="label empty"></div>
        <div class="label empty"></div>
        <div class="label empty"></div>
      </div>
    `;

  const html = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>Print Racks</title>
    <style>
      @page { size: A4; margin: 10mm; }
      body { font-family: Arial, sans-serif; margin: 0; color:#000; }

      .page{
        width: 100%;
        min-height: calc(297mm - 20mm);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        page-break-after: always;
      }
      .page:last-child{ page-break-after: auto; }

      .label{
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        flex: 1;
        margin-bottom: 6mm;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 6mm;
      }
      .label:last-child{ margin-bottom: 0; }
      .label.empty{ border: 0; }

      .section{
        font-size: 16px;
        font-weight: 700;
        margin-bottom: 12px;
      }

      .rack{
        font-size: 52px;
        font-weight: 900;
        line-height: 1;
        letter-spacing: 0.5px;
        text-align: center;
        white-space: nowrap;
      }

      .rackText, .rackNo{ font-weight: 900; }

      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
    ${pageHtml}
    <script>
      window.onload = () => {
        window.print();
        setTimeout(() => window.close(), 300);
      };
    </script>
  </body>
  </html>
  `;

  // iframe print
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => setTimeout(() => iframe.remove(), 1500);
}

/* =========================
   DELETE HANDLERS (delegated + bind once)
========================= */
function initSectionDelete(root) {
  if (root.dataset.sectionDeleteBound === "1") return;
  root.dataset.sectionDeleteBound = "1";

  async function runDelete(secId) {
    const ok = await askConfirm("Are you sure you want to delete this section?");
    if (!ok) return;

    const res = await authFetch(`${API_BASE}/sections/${secId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast(data.error || "Delete failed", "error");
      return;
    }

    showToast(data.message || "Section deleted");
    fetchSections();
  }

  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".section-delete-btn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    runDelete(btn.dataset.secid);
  });

  root.addEventListener("keydown", (e) => {
    const btn = e.target.closest(".section-delete-btn");
    if (!btn) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    runDelete(btn.dataset.secid);
  });
}

function initSubDelete(root) {
  if (root.dataset.subDeleteBound === "1") return;
  root.dataset.subDeleteBound = "1";

  root.addEventListener("click", async (e) => {
    const btn = e.target.closest(".sub-delete-btn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const id = btn.dataset.subid;
    const ok = await askConfirm("Delete this subcategory?");
    if (!ok) return;

    const res = await authFetch(`${API_BASE}/sections/sub/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast(data.error || "Delete failed", "error");
      return;
    }

    showToast(data.message || "Subcategory deleted");
    fetchSections();
  });
}

function initRackDelete(root) {
  if (root.dataset.rackDeleteBound === "1") return;
  root.dataset.rackDeleteBound = "1";

  root.addEventListener("click", async (e) => {
    const btn = e.target.closest(".rack-delete-btn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const id = btn.dataset.rackid;
    const ok = await askConfirm("Delete this rack?");
    if (!ok) return;

    const res = await authFetch(`${API_BASE}/sections/rack/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showToast(data.error || "Delete failed", "error");
      return;
    }

    showToast(data.message || "Rack deleted");
    fetchSections();
  });
}

/* =========================
   Section-wise Accordion
========================= */
function renderSectionsAccordion(sections = []) {
  const root = document.getElementById("sectionList");
  if (!root) return;

  if (!Array.isArray(sections) || sections.length === 0) {
    root.innerHTML = `<div style="padding:10px;color:#6b7280;">No sections found.</div>`;
    return;
  }

  // flexible getters (support different shapes)
  const getRackName = (r) => r?.rack_name || r?.name || r?.rackName || r?.title || "";
  const getRackId = (r) => r?.id || r?.rack_id || r?.rackId || "";
  const getSubName = (s) => s?.name || s?.sub_name || s?.subcategory_name || s?.title || "";
  const getSubId = (s) => s?.id || s?.sub_id || s?.subcategory_id || s?.subId || "";

  root.innerHTML = sections
    .map((sec, idx) => {
      const name = sec.name || sec.section_name || `Section ${idx + 1}`;
      const desc = sec.description || sec.section_desc || "";

      // subcategories
      const subsArr =
        Array.isArray(sec.Subcategories) ? sec.Subcategories :
        Array.isArray(sec.subcategories) ? sec.subcategories :
        Array.isArray(sec.Subs) ? sec.Subs :
        [];

      // build sub objects with id+name
      const subObjs = subsArr
        .map((s) => ({ id: getSubId(s), name: getSubName(s) }))
        .filter((x) => x.id && x.name);

      // section-level racks
      const sectionRacks =
        Array.isArray(sec.Racks) ? sec.Racks :
        Array.isArray(sec.racks) ? sec.racks :
        [];

      // subcategory-level racks (if provided by API)
      const subRacks = subsArr.flatMap((s) => {
        const rr =
          Array.isArray(s.Racks) ? s.Racks :
          Array.isArray(s.racks) ? s.racks :
          [];
        return rr;
      });

      // build rack objects with id+name (unique by id)
      const rackObjsRaw = [...sectionRacks, ...subRacks]
        .map((r) => ({ id: getRackId(r), name: getRackName(r) }))
        .filter((x) => x.id && x.name);

      const rackMap = new Map();
      rackObjsRaw.forEach((r) => rackMap.set(String(r.id), r));
      const rackObjs = Array.from(rackMap.values());

      // for print we only need names
      const rackNamesForPrint = rackObjs.map((r) => r.name);

      const badgeText = `${subObjs.length} Sub | ${rackObjs.length} Rack`;

      const open = idx === 0;
      const hid = `acc_head_${sec.id || idx}`;
      const bid = `acc_body_${sec.id || idx}`;

      return `
        <div class="acc-item" data-open="${open ? "true" : "false"}">
          <button class="acc-head" id="${hid}" aria-controls="${bid}" aria-expanded="${open ? "true" : "false"}" type="button">
            <div class="acc-title">
              <strong>${escapeHtml(name)}</strong>
              ${desc ? `<small>${escapeHtml(desc)}</small>` : `<small>&nbsp;</small>`}
            </div>

            <div class="acc-actions">
              <span class="section-delete-btn"
                    role="button"
                    tabindex="0"
                    data-secid="${sec.id}"
                    title="Delete Section">
                <span class="material-symbols-rounded">delete</span>
              </span>

              <span class="rack-print-btn"
                    role="button"
                    tabindex="0"
                    data-secname="${escapeHtml(name)}"
                    data-racks="${escapeHtml(JSON.stringify(rackNamesForPrint))}">
                <span class="material-symbols-rounded">print</span>
              </span>

              <span class="acc-badge">${escapeHtml(badgeText)}</span>
              <span class="acc-chevron">&#9662;</span>
            </div>
          </button>

          <div class="acc-body" id="${bid}" ${open ? "" : `style="display:none;"`}>
            <div class="acc-row">
              <h5>Subcategories</h5>
              ${
                subObjs.length
                  ? `<ul>${subObjs
                      .map(
                        (s) => `
                          <li>
                            ${escapeHtml(s.name)}
                            <span class="sub-delete-btn"
                                  role="button"
                                  tabindex="0"
                                  data-subid="${escapeHtml(s.id)}"
                                  title="Delete Subcategory">&times;</span>
                          </li>`
                      )
                      .join("")}</ul>`
                  : `<div class="muted-note">No subcategories</div>`
              }
            </div>

            <div class="acc-row">
              <h5>Racks</h5>
              ${
                rackObjs.length
                  ? `<ul>${rackObjs
                      .map(
                        (r) => `
                          <li>
                            ${escapeHtml(r.name)}
                            <span class="rack-delete-btn"
                                  role="button"
                                  tabindex="0"
                                  data-rackid="${escapeHtml(r.id)}"
                                  title="Delete Rack">&times;</span>
                          </li>`
                      )
                      .join("")}</ul>`
                  : `<div class="muted-note">No racks</div>`
              }
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  // accordion toggle (one open)
  root.querySelectorAll(".acc-item .acc-head").forEach((headBtn) => {
    headBtn.addEventListener("click", (e) => {
      // prevent toggle when clicking action buttons
      if (e.target.closest(".section-delete-btn,.rack-print-btn,.sub-delete-btn,.rack-delete-btn")) return;

      const item = headBtn.closest(".acc-item");
      const body = item.querySelector(".acc-body");
      const isOpen = item.getAttribute("data-open") === "true";

      // close all
      root.querySelectorAll(".acc-item").forEach((it) => {
        it.setAttribute("data-open", "false");
        const b = it.querySelector(".acc-body");
        const h = it.querySelector(".acc-head");
        if (b) b.style.display = "none";
        if (h) h.setAttribute("aria-expanded", "false");
      });

      // open clicked if closed
      if (!isOpen) {
        item.setAttribute("data-open", "true");
        body.style.display = "";
        headBtn.setAttribute("aria-expanded", "true");
      }
    });
  });

  // delegated bindings (only once)
  initRackPrint(root);
  initSectionDelete(root);
  initSubDelete(root);
  initRackDelete(root);
}

/* =========================
   Load config
========================= */
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

  initListCollapse();

  fetchSections();
  fetchCentralRacks();
}

/* =========================
   FETCH SECTIONS
========================= */
async function fetchSections() {
  try {
    const res = await authFetch(`${API_BASE}/sections`);
    const data = await res.json();

    const sectionSelect = document.getElementById("sectionSelect");
    const sectionSelectRack = document.getElementById("sectionSelectRack");

    if (sectionSelect) sectionSelect.innerHTML = '<option value="">-- Select Section --</option>';
    if (sectionSelectRack) sectionSelectRack.innerHTML = '<option value="">-- Select Section --</option>';

    // Dropdown fill (hide Central Room)
    data.forEach((sec) => {
      if ((sec.name || "").toLowerCase() === "central room") return;

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
    });

    renderSectionsAccordion(data);
  } catch (err) {
    console.error("fetchSections error:", err);
    showToast("Failed to load sections!", "error");
  }
}

/* =========================
   ADD SECTION
========================= */
async function onAddSection(e) {
  e.preventDefault();
  const name = document.getElementById("sectionName").value.trim();
  const description = document.getElementById("sectionDesc").value.trim();

  if (!name) return showToast("Section name required!", "error");

  try {
    const res = await authFetch(`${API_BASE}/sections/add`, {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed");

    showToast(data.message || "Section added successfully!");
    e.target.reset();
    fetchSections();
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* =========================
   ADD SUBCATEGORY
========================= */
async function onAddSubcategory(e) {
  e.preventDefault();
  const sectionId = document.getElementById("sectionSelect").value;
  const name = document.getElementById("subName").value.trim();

  if (!sectionId || !name) return showToast("Select section and enter name!", "error");

  try {
    const res = await authFetch(`${API_BASE}/sections/add-sub`, {
      method: "POST",
      body: JSON.stringify({ sectionId, name }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed");

    showToast(data.message || "Subcategory added!");
    e.target.reset();
    fetchSections();
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* =========================
   ADD RACK
========================= */
async function onAddRack(e) {
  e.preventDefault();
  const sectionId = document.getElementById("sectionSelectRack").value;
  const name = document.getElementById("rackName").value.trim();
  const description = document.getElementById("rackDesc").value.trim();

  if (!sectionId || !name) return showToast("Select section and enter rack name!", "error");

  try {
    const res = await authFetch(`${API_BASE}/sections/add-rack`, {
      method: "POST",
      body: JSON.stringify({ sectionId, name, description }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed");

    showToast(data.message || "Rack added!");
    e.target.reset();
    fetchSections();
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* =========================
   ADD CENTRAL ROOM RACK
========================= */
async function onAddCentralRack(e) {
  e.preventDefault();
  const name = document.getElementById("centralRackName").value.trim();
  const description = document.getElementById("centralRackDesc").value.trim();
  if (!name) return showToast("Please enter rack name!", "error");

  try {
    const res = await authFetch(`${API_BASE}/sections/add-rack`, {
      method: "POST",
      body: JSON.stringify({ name, description, centralRoom: true }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed");

    showToast(data.message || "Central Rack added!");
    e.target.reset();
    fetchCentralRacks();
    fetchSections();
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* =========================
   FETCH CENTRAL ROOM RACKS
========================= */
async function fetchCentralRacks() {
  try {
    const res = await authFetch(`${API_BASE}/sections/central/racks`);
    const racks = await res.json();

    const list = document.getElementById("centralRackList");
    if (!list) return;

    if (!Array.isArray(racks) || racks.length === 0) {
      list.innerHTML = "<p>No racks in Central Room yet.</p>";
      return;
    }

    list.innerHTML = racks
      .map(
        (r) => `
        <div class="rack-item">
          <strong>${escapeHtml(r.rack_name || r.name || "Unnamed Rack")}</strong>
          ${
            r.description
              ? `<small>${escapeHtml(r.description)}</small>`
              : ""
          }
        </div>
      `
      )
      .join("");
  } catch (err) {
    console.error("fetchCentralRacks error:", err);
  }
}

document.addEventListener("DOMContentLoaded", loadConfig);

// ================== FORCE ALL CAPS INPUT ==================
document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el.classList || !el.classList.contains("force-upper")) return;

  const start = el.selectionStart;
  el.value = el.value.toUpperCase();
  el.setSelectionRange(start, start);
});

