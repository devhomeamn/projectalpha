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

  // প্রতি পেজে 4টা করে
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

          // শেষ পেজে যদি ৪টা না হয়, height ঠিক রাখতে empty
          const empties = 5 - group.length;
          const emptyLabels =
            empties > 0
              ? `<div class="label empty"></div>`.repeat(empties)
              : "";

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

      /* One A4 page */
      .page{
        width: 100%;
        min-height: calc(297mm - 20mm); /* A4 height minus margins */
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        page-break-after: always;
      }
      .page:last-child{ page-break-after: auto; }

      /* Each label (vertical stack) */
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

      .label.empty{
        border: 0;
      }

      .section{
        font-size: 16px;
        font-weight: 700;
        margin-bottom: 12px;
      }

      .rack{
        font-size: 52px;   /* বড় Rack No */
        font-weight: 900;
        line-height: 1;
        letter-spacing: 0.5px;
        text-align: center;
        white-space: nowrap;
      }

      .rackText, .rackNo{
        font-weight: 900;
      }

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
   Section-wise Accordion
========================= */
function renderSectionsAccordion(sections = []) {
  const root = document.getElementById("sectionList");
  if (!root) return;

  if (!Array.isArray(sections) || sections.length === 0) {
    root.innerHTML = `<div style="padding:10px;color:#6b7280;">No sections found.</div>`;
    return;
  }

  const getRackName = (r) => r?.rack_name || r?.name || r?.rackName || r?.title || "";
  const getSubName = (s) => s?.name || s?.sub_name || s?.subcategory_name || s?.title || "";

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

      const subNames = subsArr.map(getSubName).filter(Boolean);

      // section-level racks
      const sectionRacks =
        Array.isArray(sec.Racks) ? sec.Racks :
        Array.isArray(sec.racks) ? sec.racks :
        [];

      // subcategory-level racks (if any shape provides it)
      const subRacks = subsArr.flatMap((s) => {
        const rr =
          Array.isArray(s.Racks) ? s.Racks :
          Array.isArray(s.racks) ? s.racks :
          [];
        return rr;
      });

      const rackNames = [...new Set([...sectionRacks, ...subRacks].map(getRackName).filter(Boolean))];

      const badgeText = `${subNames.length} Sub • ${rackNames.length} Rack`;

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

            <div style="display:flex;align-items:center;gap:8px;">
                      <span
          class="rack-print-btn"
          role="button"
          tabindex="0"
          data-secname="${escapeHtml(name)}"
          data-racks="${escapeHtml(JSON.stringify(rackNames))}">
          Print Racks
        </span>


              <span class="acc-badge">${escapeHtml(badgeText)}</span>
              <span class="acc-chevron">▾</span>
            </div>
          </button>

          <div class="acc-body" id="${bid}" ${open ? "" : `style="display:none;"`}>
            <div class="acc-row">
              <h5>Subcategories</h5>
              ${
                subNames.length
                  ? `<ul>${subNames.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
                  : `<div style="color:#6b7280;font-size:13px;">No subcategories</div>`
              }
            </div>

            <div class="acc-row">
              <h5>Racks</h5>
              ${
                rackNames.length
                  ? `<ul>${rackNames.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
                  : `<div style="color:#6b7280;font-size:13px;">No racks</div>`
              }
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  // accordion toggle (one open)
  root.querySelectorAll(".acc-item .acc-head").forEach((headBtn) => {
    headBtn.addEventListener("click", () => {
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

  // print binding once (delegated)
  initRackPrint(root);
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
    const res = await fetch(`${API_BASE}/sections`);
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
    alert("Failed to load sections!");
  }
}

/* =========================
   ADD SECTION
========================= */
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

/* =========================
   ADD SUBCATEGORY
========================= */
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

/* =========================
   ADD RACK
========================= */
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
    fetchSections();
  } catch (err) {
    alert(err.message);
  }
}

/* =========================
   ADD CENTRAL ROOM RACK
========================= */
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
    fetchSections();
  } catch (err) {
    alert(err.message);
  }
}

/* =========================
   FETCH CENTRAL ROOM RACKS
========================= */
async function fetchCentralRacks() {
  try {
    const res = await fetch(`${API_BASE}/sections/central/racks`);
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
              ? `<div style="font-size:12.5px;color:#6b7280;">${escapeHtml(r.description)}</div>`
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
  el.setSelectionRange(start, start); // cursor jump prevent
});
