// js/layout.js
export async function initLayout(activePage) {
  // 1) Load topbar & sidebar HTML first
  const [topbarRes, sidebarRes] = await Promise.all([
    fetch("components/topbar.html"),
    fetch("components/sidebar.html"),
  ]);

  document.getElementById("topbar").innerHTML = await topbarRes.text();
  document.getElementById("sidebar").innerHTML = await sidebarRes.text();

  // Small delay to ensure DOM is loaded
  await new Promise((r) => setTimeout(r, 50));

  // 2) Retrieve user info (NOW variables exist)
  const token = localStorage.getItem("token");
  let role = localStorage.getItem("role");

  const username = localStorage.getItem("username");
  const name = localStorage.getItem("name");

  // ✅ FIX: key mismatch safe fallback
  const email =
    localStorage.getItem("email") ||
    localStorage.getItem("userEmail") ||
    localStorage.getItem("user_email") ||
    "";

  const serviceid =
    localStorage.getItem("serviceid") ||
    localStorage.getItem("service_id") ||
    localStorage.getItem("serviceId") ||
    "";

  if (!token) return (window.location.href = "login.html");

  role = role
    ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
    : "";

  // Section-based visibility helpers
  const userSectionId = Number(localStorage.getItem("section_id") || 0);

  function normalizeSectionName(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[\/\-_]/g, "");
  }

  async function getSectionsCached() {
    if (window.__LAYOUT_SECTIONS_CACHE__) return window.__LAYOUT_SECTIONS_CACHE__;
    try {
      const res = await fetch("/api/sections", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      const rows = data.sections || data.data || data || [];
      window.__LAYOUT_SECTIONS_CACHE__ = Array.isArray(rows) ? rows : [];
      return window.__LAYOUT_SECTIONS_CACHE__;
    } catch {
      return [];
    }
  }

  async function getSectionIdCached(storageKey, predicate) {
    const cached = localStorage.getItem(storageKey);
    if (cached) return Number(cached);

    const rows = await getSectionsCached();
    const found = rows.find((r) => predicate(normalizeSectionName(r?.name), r)) || null;
    if (found?.id) {
      localStorage.setItem(storageKey, String(found.id));
      return Number(found.id);
    }
    return null;
  }

  async function getChequeSectionIdCached() {
    return getSectionIdCached("cheque_section_id", (normalizedName) => {
      return normalizedName.includes("cheque") || normalizedName.startsWith("d");
    });
  }

  async function getLALAOSectionIdCached() {
    return getSectionIdCached("lalao_section_id", (normalizedName) => {
      return normalizedName === "lalao";
    });
  }

  const chequeSectionId = await getChequeSectionIdCached();
  const lalaoSectionId = await getLALAOSectionIdCached();
  const isChequeUser = role !== "General" || (chequeSectionId && userSectionId === Number(chequeSectionId));
  const isLALAOUser = role === "General" && !!lalaoSectionId && userSectionId === Number(lalaoSectionId);


  // ------------------------------
  // Auto Logout (Idle + JWT expiry)
  // ------------------------------
  (function initAutoLogout() {
    // login/forgot/reset page-এ না (যদি কখনো initLayout call হয়)
    const p = (window.location.pathname || "").toLowerCase();
    if (p.endsWith("login.html") || p.endsWith("forgot-password.html") || p.endsWith("reset-password.html")) return;

    // already loaded?
    if (window.__SESSION_AUTO_LOGOUT_LOADED__) return;
    window.__SESSION_AUTO_LOGOUT_LOADED__ = true;

    // session.js inject
    const s = document.createElement("script");
    s.src = "js/session.js"; // ✅ session.js কে frontend/js/session.js এ রাখবেন
    s.defer = true;

    // optional: configure after load (if your session.js exposes init)
    s.onload = () => {
      // if your session.js exposes something like window.SessionManager.init
      if (window.SessionManager && typeof window.SessionManager.init === "function") {
        window.SessionManager.init({
          idleTimeoutMs: 30 * 60 * 1000,   // 30 min (change if needed)
          logoutUrl: "login.html",
          storageTokenKey: "token",
          storageUserKey: "username" // or "user" if you use that
        });
      }
    };

    document.head.appendChild(s);
  })();




  /* ------------------------------
        Sidebar Menu Items
  ------------------------------ */
  // Menu schema supports:
  //  - single item: { name, icon, roles, link }
  //  - group item : { group: true, name, icon, roles, children:[...] }
  const menuItems = [
    { name: "Dashboard",      icon: "dashboard",     roles: ["Admin", "Master", "General"], link: "dashboard.html" },
    { name: "Add Record",     icon: "library_add",   roles: ["Admin", "Master", "General"], link: "add-record.html" },
    { name: "View Record",    icon: "visibility",    roles: ["Admin", "Master", "General"], link: "view-record.html" },
    { name: "Central Record", icon: "folder",        roles: ["Admin", "Master", "General"], link: "central-record.html" },
    { name: "Cheque Register", icon: "receipt_long", roles: ["Admin", "Master", "General"], link: "cheque-register.html", onlyChequeUser: true },
    {
      group: true,
      name: "Audit Objections",
      icon: "gavel",
      roles: ["Admin", "Master", "General"],
      children: [
        { name: "Objection Entry", icon: "post_add", roles: ["Admin", "Master", "General"], link: "add-record.html", onlyLALAOUser: true },
        { name: "BD History",     icon: "history",  roles: ["Admin", "Master", "General"], link: "bd-objection-history.html", onlyLALAOUser: true },
        { name: "All Objections", icon: "list_alt", roles: ["Admin", "Master", "General"], link: "audit-objections.html", onlyLALAOUser: true },
        { name: "Clearance Approvals", icon: "task", roles: ["Admin"], link: "ao-clearance-requests.html" },
      ],
    },
    { name: "Add Section",    icon: "add_circle",    roles: ["Admin", "Master"],            link: "add-section.html" },
    { name: "Approve User",   icon: "verified_user", roles: ["Admin"],                        link: "approve-user.html" },
    { name: "All Users",      icon: "group",         roles: ["Admin"],                        link: "all-users.html" },
    { name: "Reports",        icon: "bar_chart",     roles: ["Admin", "Master", "General"], link: "reports.html" },
    { name: "Admin Notice",   icon: "campaign",      roles: ["Admin"],                        link: "admin-notice.html" },
    { name: "Help",           icon: "help",          roles: ["Admin", "Master", "General"], link: "info-help.html" },
  ];

  const menuList = document.getElementById("menuList");
  const currentPage = activePage || window.location.pathname.split("/").pop();

  function isAllowedByRole(item) {
    if (!(item.roles || []).includes(role)) return false;
    if (item.onlyChequeUser && !isChequeUser) return false;
    if (item.onlyLALAOUser && !isLALAOUser) return false;
    return true;
  }

  function anyChildAllowed(children) {
    return (children || []).some((c) => isAllowedByRole(c));
  }

  function isAnyChildActive(children) {
    return (children || []).some((c) => c.link === currentPage);
  }

  function renderMenu(items) {
    return (items || [])
      .map((item, idx) => {
        if (item.group) {
          // group visible if the group itself is allowed AND at least one child is allowed
          if (!isAllowedByRole(item) || !anyChildAllowed(item.children)) return "";

          const groupId = `menuGroup_${idx}`;
          const childHtml = (item.children || [])
            .filter(isAllowedByRole)
            .map((c) => {
              const active = c.link === currentPage;
              return `
                <li class="submenu-item ${active ? "active" : ""}">
                  <a href="${c.link}" class="${active ? "active" : ""}">
                    <span class="material-symbols-rounded menu-icon">${c.icon}</span>
                    <span>${c.name}</span>
                  </a>
                </li>
              `;
            })
            .join("");

          const groupActive = isAnyChildActive(item.children);
          const expanded = groupActive ? "true" : "false";
          const openClass = groupActive ? "open" : "";
          return `
            <li class="menu-group ${openClass}" data-group-id="${groupId}">
              <button class="menu-group-btn" type="button" aria-expanded="${expanded}">
                <span class="material-symbols-rounded menu-icon">${item.icon}</span>
                <span class="menu-group-title">${item.name}</span>
                <span class="material-symbols-rounded menu-caret">expand_more</span>
              </button>
              <ul class="submenu submenu-nested">${childHtml}</ul>

            </li>
          `;
        }

        if (!isAllowedByRole(item)) return "";
        const isActive = currentPage === item.link;
        return `
          <li class="menu-item ${isActive ? "active" : ""}">
            <a href="${item.link}" class="${isActive ? "active" : ""}">
              <span class="material-symbols-rounded menu-icon">${item.icon}</span>
              <span>${item.name}</span>
            </a>
          </li>
        `;
      })
      .join("");
  }

  if (menuList) {
    menuList.innerHTML = renderMenu(menuItems);

    // Group toggle behavior
    menuList.querySelectorAll(".menu-group-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const li = btn.closest(".menu-group");
        if (!li) return;

        const isOpen = li.classList.toggle("open");
        btn.setAttribute("aria-expanded", String(isOpen));
      });
    });
  }

  /* ------------------------------
        Fill Sidebar Profile (AFTER HTML inserted)
  ------------------------------ */
  const sidebarNameEl = document.getElementById("sidebarName");
  const sidebarRoleEl = document.getElementById("sidebarRole");
  const sidebarAvatarEl = document.getElementById("sidebarAvatar");

  if (sidebarNameEl) sidebarNameEl.textContent = name || "User";
  if (sidebarRoleEl) sidebarRoleEl.textContent = role || "Role";

  if (sidebarAvatarEl) {
    const u = username || "sfrms";
    sidebarAvatarEl.src = `https://robohash.org/${encodeURIComponent(u)}.png?size=80x80`;
  }

  /* ------------------------------
      Fill Topbar User Info (SAFE)
  ------------------------------ */
  const chipNameEl = document.getElementById("username");
  const roleEl = document.getElementById("role");
  const umNameEl = document.getElementById("umName");
  const umEmailEl = document.getElementById("umEmail");
  const umServiceIdEl = document.getElementById("umServiceId");

  // Chip
  if (chipNameEl) chipNameEl.textContent = username || "User";
  if (roleEl) roleEl.textContent = role || "Role";

  // Dropdown header
  if (umNameEl) umNameEl.textContent = name || username || "User";
  if (umEmailEl) umEmailEl.textContent = email || "—";
  if (umServiceIdEl) umServiceIdEl.textContent = `Service ID: ${serviceid || "—"}`;

  /* ------------------------------
      Sidebar Toggle
  ------------------------------ */
  window.toggleSidebar = function () {
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.getElementById("overlay");
    if (!sidebar) return;

    if (window.innerWidth <= 768) {
      sidebar.classList.toggle("open");
      if (overlay) overlay.classList.toggle("show");
      return;
    }

    document.body.classList.toggle("sidebar-collapsed");
  };

  const overlayEl = document.getElementById("overlay");
  if (overlayEl) {
    overlayEl.addEventListener("click", () => {
      const sidebar = document.querySelector(".sidebar");
      overlayEl.classList.remove("show");
      sidebar?.classList.remove("open");
    });
  }

  // ===== Topbar profile dropdown =====
  (function initTopbarDropdown() {
    const ddWrap = document.querySelector(".user-dropdown");
    const ddBtn = document.getElementById("userDropdownBtn");

    if (!ddWrap || !ddBtn) return;

    function closeDd() {
      ddWrap.classList.remove("open");
      ddBtn.setAttribute("aria-expanded", "false");
    }

    ddBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = ddWrap.classList.toggle("open");
      ddBtn.setAttribute("aria-expanded", String(isOpen));
    });

    document.addEventListener("click", closeDd);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDd();
    });
  })();

  /* ------------------------------
        Global Topbar Search
        (BD No / File Name)
  ------------------------------ */
  (function initGlobalTopbarSearch() {
    const input = document.getElementById("topbarSearchInput");
    const box = document.getElementById("topbarSearchResults");

    // desktop dropdown requires input+box. mobile overlay only needs button.
    const searchBtn = document.getElementById("topbarSearchBtn");

    let t = null;
    let lastToken = 0;
    let lastResults = [];

    function escapeHtml(s) {
      return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function isCentral(r) {
      return String(r?.status || "active").toLowerCase() === "central";
    }

    function formatLocationPlain(r) {
      const section = r.section?.name || "—";
      const sub = r.subcategory?.name || "—";
      const rack = r.rack?.name || "—";
      const serial = r.serial_no ?? "—";
      const place = isCentral(r) ? "Central" : "Section";
      return `${place}: ${section} • ${sub} • ${rack} • Serial ${serial}`;
    }

    function showBox(html) {
      if (!box) return;
      box.innerHTML = html;
      box.classList.add("show");
      box.setAttribute("aria-hidden", "false");
    }
    function hideBox() {
      if (!box) return;
      box.classList.remove("show");
      box.setAttribute("aria-hidden", "true");
    }

    function openResultModal(r) {
      // desktop: close dropdown
      hideBox();
      if (input) input.blur();

      const overlay = document.createElement("div");
      overlay.className = "gs-modal-overlay";
      overlay.innerHTML = `
        <div class="gs-modal" role="dialog" aria-modal="true">
          <div class="gs-head">
            <h3>Record Location</h3>
            <button class="gs-close" type="button" aria-label="Close">✕</button>
          </div>
          <div class="gs-body">
            <div class="gs-kv">
              <div class="k">BD No</div><div class="v">${escapeHtml(r.bd_no || "—")}</div>
              <div class="k">File Name</div><div class="v">${escapeHtml(r.file_name || "—")}</div>
              <div class="k">Current Location</div><div class="v">${escapeHtml(formatLocationPlain(r))}</div>
              <div class="k">Record Status</div><div class="v">${escapeHtml((r.record_status || "ongoing").toString())}</div>
            </div>

            ${isCentral(r) && (r.previous_location?.section_name || r.previous_location?.rack_name)
              ? `
                <div style="margin-top:12px;border-top:1px dashed #e5e7eb;padding-top:12px;">
                  <div style="font-weight:900;color:#111827;margin-bottom:6px;">Previous Location</div>
                  <div style="font-size:13px;color:#374151;font-weight:800;">
                    ${escapeHtml(
                      `${r.previous_location?.section_name || "—"} • ${r.previous_location?.subcategory_name || "—"} • ${r.previous_location?.rack_name || "—"}`
                    )}
                  </div>
                </div>
              `
              : ""}
          </div>
          <div class="gs-actions">
            <button class="btn btn-secondary" type="button" data-gs="close">Close</button>
            <button class="btn btn-primary" type="button" data-gs="go">Open in Records</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add("show"));

      function close() {
        overlay.classList.remove("show");
        overlay.addEventListener("transitionend", () => overlay.remove(), { once: true });
      }

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
      });
      overlay.querySelector(".gs-close")?.addEventListener("click", close);
      overlay.querySelector('[data-gs="close"]')?.addEventListener("click", close);
      overlay.querySelector('[data-gs="go"]')?.addEventListener("click", () => {
        const place = isCentral(r) ? "central-record.html" : "view-record.html";
        window.location.href = `${place}?q=${encodeURIComponent(r.bd_no || r.file_name || "")}`;
      });

      document.addEventListener(
        "keydown",
        (ev) => {
          if (ev.key === "Escape") close();
        },
        { once: true }
      );
    }
async function lookup(value) {
  const q = String(value || "").trim();
  if (!q) return [];

  const token = ++lastToken;

  const jwt = localStorage.getItem("token") || "";
  const res = await fetch(`/api/records/lookup?q=${encodeURIComponent(q)}`, {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {}
  });

  // যদি token expire / 401 হয় → login এ পাঠাবে
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = "login.html";
    return [];
  }

  const data = await res.json().catch(() => []);
  if (token !== lastToken) return null; // stale

  return Array.isArray(data) ? data : [];
}

    // -------- Desktop dropdown search --------
    async function doDesktopSearch(value) {
      const q = String(value || "").trim();
      if (!q) {
        lastResults = [];
        hideBox();
        return;
      }

      try {
        const list = await lookup(q);
        if (list === null) return; // stale
        lastResults = list;

        if (!lastResults.length) {
          showBox(`<div class="sr-empty">No records found for <b>${escapeHtml(q)}</b></div>`);
          return;
        }

        const html = lastResults.map((r, idx) => {
          const central = isCentral(r);
          const place = central ? "Central" : "Section";
          const locClass = central ? "sr-loc-central" : "sr-loc-section";

          return `
            <div class="sr-item" data-idx="${idx}" title="Click to view location">
              <div class="sr-icon">
                <span class="material-symbols-rounded" style="font-size:18px;">folder</span>
              </div>

              <div class="sr-main">
                <div class="sr-title">
                  ${escapeHtml(r.bd_no || "—")} — ${escapeHtml(r.file_name || "")}
                </div>

                <div class="sr-sub">
                  ${place} :
                  <span class="${locClass}">
                    ${escapeHtml(r.section?.name || "—")}
                    • ${escapeHtml(r.subcategory?.name || "—")}
                    • ${escapeHtml(r.rack?.name || "—")}
                    • Serial ${escapeHtml(r.serial_no ?? "—")}
                  </span>
                </div>
              </div>

              <div class="sr-tag">${escapeHtml(place)}</div>
            </div>
          `;
        }).join("");

        showBox(html);
      } catch (e) {
        console.error("topbar lookup error", e);
        showBox(`<div class="sr-empty">Search failed. Please try again.</div>`);
      }
    }

    if (box) {
      box.addEventListener("click", (e) => {
        const item = e.target.closest(".sr-item");
        if (!item) return;
        const idx = parseInt(item.getAttribute("data-idx"), 10);
        const r = lastResults[idx];
        if (r) openResultModal(r);
      });
    }

    if (input && box) {
      input.addEventListener("input", () => {
        const v = input.value;
        clearTimeout(t);
        t = setTimeout(() => doDesktopSearch(v), 280);
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          if (lastResults.length) openResultModal(lastResults[0]);
          else doDesktopSearch(input.value);
        }
        if (e.key === "Escape") {
          hideBox();
          input.blur();
        }
      });

      document.addEventListener("click", (e) => {
        const wrap = document.querySelector(".topbar-search");
        if (!wrap) return;
        if (!wrap.contains(e.target)) hideBox();
      });
    }




  /* ------------------------------
        Notifications (Dropdown)
        Uses: /api/dashboard/my-stats
  ------------------------------ */
  let __myStatsCache = null;

  async function fetchMyStats() {
    const jwt = localStorage.getItem("token") || "";
    const res = await fetch("/api/dashboard/my-stats", {
      headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
    });

    if (res.status === 401) {
      localStorage.clear();
      window.location.href = "login.html";
      return null;
    }

    return await res.json().catch(() => null);
  }

  function updateNotifBadge(ongoing) {
    const badge = document.getElementById("notifBadge");
    const btn = document.getElementById("notifBtn");
    if (!badge || !btn) return;

    const n = Number(ongoing ?? 0);
    if (n > 0) {
      badge.style.display = "inline-flex";
      badge.textContent = n > 99 ? "99+" : String(n);
      btn.title = `Ongoing Records: ${n}`;
    } else {
      badge.style.display = "none";
      badge.textContent = "0";
      btn.title = "Notifications";
    }
  }

  function renderNotifDropdown(stats) {
    const pill = document.getElementById("notifOngoingPill");
    const body = document.getElementById("notifBody");
    if (!pill || !body) return;

    const ongoing = Number(stats?.ongoing ?? 0);
    pill.textContent = `${ongoing} Ongoing`;

    const recent = Array.isArray(stats?.recent) ? stats.recent : [];

    let html = "";

    // ✅ Clickable ongoing summary card
    html += `
      <div class="notif-item is-clickable" data-go="ongoing" title="Click to view ongoing records">
        <div class="ni-icon"><span class="material-symbols-rounded">task_alt</span></div>
        <div class="ni-main">
          <div class="ni-title">My Ongoing Records</div>
          <div class="ni-sub">You have ${ongoing} ongoing record(s). Click to view.</div>
          <div class="ni-time">Open filtered list</div>
        </div>
      </div>
    `;

    if (recent.length === 0) {
      html += `<div class="notif-empty">No recent activity.</div>`;
      body.innerHTML = html;
      return;
    }

    recent.forEach((r) => {
      const title = r.action === "Moved" ? "Moved a record" : "Added a record";
      const sub = `${r.file_name || "—"} • BD ${r.bd_no || "—"}`;
      const when = r.when || "";

      html += `
        <div class="notif-item">
          <div class="ni-icon"><span class="material-symbols-rounded">history</span></div>
          <div class="ni-main">
            <div class="ni-title">${title}</div>
            <div class="ni-sub">${sub}</div>
            <div class="ni-time">${when}</div>
          </div>
        </div>
      `;
    });

    body.innerHTML = html;
  }

  async function refreshNotificationsUI() {
    try {
      const stats = await fetchMyStats();
      if (!stats) return;

      __myStatsCache = stats;
      updateNotifBadge(stats.ongoing);
      renderNotifDropdown(stats);
    } catch (e) {
      console.warn("Notifications refresh failed:", e);
    }
  }




  // 2nd portion for notif dropdown
    (function initNotifDropdown() {
    const wrap = document.getElementById("notifDropdownWrap");
    const btn = document.getElementById("notifBtn");
    const menu = document.getElementById("notifMenu");

    if (!wrap || !btn || !menu) return;

    function close() {
      wrap.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-hidden", "true");
    }

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();

      // close profile dropdown if open
      document.querySelector(".user-dropdown")?.classList.remove("open");

      const isOpen = wrap.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(isOpen));
      menu.setAttribute("aria-hidden", String(!isOpen));

      // when opening, refresh content instantly
      if (isOpen) {
        await refreshNotificationsUI();
      }
    });

    // ✅ Handle clicks inside menu (ongoing -> redirect)
    menu.addEventListener("click", (e) => {
      const ongoingCard = e.target.closest(".notif-item[data-go='ongoing']");
      if (ongoingCard) {
        // close dropdown then redirect
        close();
        window.location.href = "view-record.html?record_status=ongoing&mine=1";

        return;
      }

      // other clicks: don't close menu
      e.stopPropagation();
    });

    document.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  })();



    // initial + auto refresh every 60s
  refreshNotificationsUI();
  setInterval(refreshNotificationsUI, 60000);




    // -------- Mobile overlay search (icon tap) --------
    function openMobileOverlay() {
      if (document.querySelector(".msearch-overlay")) return;

      const overlay = document.createElement("div");
      overlay.className = "msearch-overlay";
      overlay.innerHTML = `
        <div class="msearch-box">
          <div class="msearch-row">
            <span class="material-symbols-rounded" style="color:#6b7280;">search</span>
            <input id="mSearchInput" type="text" placeholder="Input BD No / File Name..." autocomplete="off" />
            <button id="mSearchClose" type="button"
              style="border:1px solid #e5e7eb;background:#fff;border-radius:12px;padding:6px 8px;cursor:pointer;">✕</button>
          </div>
          <div class="msearch-results" id="mSearchResults">
            <div class="sr-empty" style="padding:12px 10px;">Type to search…</div>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const mInput = overlay.querySelector("#mSearchInput");
      const mRes = overlay.querySelector("#mSearchResults");

      const close = () => overlay.remove();
      overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
      overlay.querySelector("#mSearchClose")?.addEventListener("click", close);

      let timer = null;
      mInput.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const q = mInput.value.trim();
          if (!q) {
            mRes.innerHTML = `<div class="sr-empty" style="padding:12px 10px;">Type to search…</div>`;
            return;
          }

          try {
            const list = await lookup(q);
            if (list === null) return; // stale
            if (!Array.isArray(list) || !list.length) {
              mRes.innerHTML = `<div class="sr-empty" style="padding:12px 10px;">No records found</div>`;
              return;
            }

            mRes.innerHTML = list.map((r, idx) => {
              const central = isCentral(r);
              const place = central ? "Central" : "Section";
              const locClass = central ? "sr-loc-central" : "sr-loc-section";

              return `
                <div class="sr-item" data-idx="${idx}" style="padding:10px 12px;cursor:pointer;">
                  <div class="sr-title" style="font-weight:900;font-size:13.5px;color:#111827;">
                    ${escapeHtml(r.bd_no || "—")} — ${escapeHtml(r.file_name || "")}
                  </div>
                  <div class="sr-sub" style="font-size:12px;color:#6b7280;margin-top:2px;">
                    ${place} •
                    <span class="${locClass}">
                      ${escapeHtml(r.section?.name || "—")}
                      • ${escapeHtml(r.subcategory?.name || "—")}
                      • ${escapeHtml(r.rack?.name || "—")}
                      • Serial ${escapeHtml(r.serial_no ?? "—")}
                    </span>
                  </div>
                </div>
              `;
            }).join("");

            mRes.querySelectorAll(".sr-item").forEach((el, idx) => {
              el.addEventListener("click", () => {
                const picked = list[idx];
                close();
                openResultModal(picked);
              });
            });
          } catch (e) {
            console.error("mobile lookup error", e);
            mRes.innerHTML = `<div class="sr-empty" style="padding:12px 10px;">Search failed</div>`;
          }
        }, 250);
      });

      setTimeout(() => mInput.focus(), 30);
    }

    if (searchBtn) {
      searchBtn.addEventListener("click", openMobileOverlay);
    }
  })();

  /* ------------------------------
         Logout
  ------------------------------ */
  window.logout = function () {
    localStorage.clear();
    window.location.href = "login.html";
  };

  document.body.classList.add("layout-ready");
}


// layout.js
export function renderPageHeader({
  mountId = "pageHeaderMount",
  icon = "dashboard",
  title = "Dashboard",
  subtitle = "",
  showClock = true,
} = {}) {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  mount.innerHTML = `
    <div class="page-header">
      <div class="header-content">
        <div class="header-main">
          <h1 class="header-title">
            <span class="material-symbols-rounded header-icon">${icon}</span>
            ${title}
          </h1>
          ${subtitle ? `<p class="header-subtitle">${subtitle}</p>` : ``}
        </div>

        ${
          showClock
            ? `<div class="header-meta">
                <div class="meta-item">
                  <span class="material-symbols-rounded">calendar_today</span>
                  <span id="currentDate">Loading...</span>
                </div>
                <div class="meta-item">
                  <span class="material-symbols-rounded">schedule</span>
                  <span id="currentTime">Loading...</span>
                </div>
              </div>`
            : ``
        }
      </div>
      <div class="header-wave"></div>
    </div>
  `;

  if (showClock) startHeaderClock();
}

function startHeaderClock() {
  const dateEl = document.getElementById("currentDate");
  const timeEl = document.getElementById("currentTime");
  if (!dateEl || !timeEl) return;

  const tick = () => {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString();
    timeEl.textContent = now.toLocaleTimeString();
  };
  tick();
  setInterval(tick, 1000);
}
