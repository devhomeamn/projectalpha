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
  const email = localStorage.getItem("email");
  const serviceid = localStorage.getItem("serviceid");

  if (!token) return (window.location.href = "login.html");

  role = role
    ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
    : "";

  /* ------------------------------
        Sidebar Menu Items
  ------------------------------ */
  const menuItems = [
    { name: "Dashboard",     icon: "dashboard",    roles: ["Admin", "Master", "General"], link: "dashboard.html" },
    { name: "Add Record",    icon: "library_add",  roles: ["Admin", "Master", "General"], link: "add-record.html" },
    { name: "View Record",   icon: "visibility",   roles: ["Admin", "Master", "General"], link: "view-record.html" },
    { name: "Central Record",icon: "folder",       roles: ["Admin", "Master", "General"], link: "central-record.html" },
    { name: "Add Section",   icon: "add_circle",   roles: ["Admin", "Master"],            link: "add-section.html" },
    { name: "Approve User",  icon: "verified_user",roles: ["Admin"],                      link: "approve-user.html" },
    { name: "All Users",     icon: "group",        roles: ["Admin"],                      link: "all-users.html" },
    { name: "Reports",       icon: "bar_chart",    roles: ["Admin", "Master", "General"], link: "reports.html" },
    { name: "Help",          icon: "help",         roles: ["Admin", "Master", "General"], link: "help.html" }
  ];

  const allowed = menuItems.filter(i => i.roles.includes(role));
  const menuList = document.getElementById("menuList");
  const currentPage = activePage || window.location.pathname.split("/").pop();

  menuList.innerHTML = allowed.map(item => {
    const isActive = currentPage === item.link;
    return `
      <li class="menu-item ${isActive ? "active" : ""}">
        <a href="${item.link}" class="${isActive ? "active" : ""}">
          <span class="material-symbols-rounded menu-icon">${item.icon}</span>
          <span>${item.name}</span>
        </a>
      </li>
    `;
  }).join("");

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
const chipNameEl = document.getElementById("username"); // chip main line in topbar.html
const roleEl = document.getElementById("role");
const umNameEl = document.getElementById("umName");
const umEmailEl = document.getElementById("umEmail");
const umServiceIdEl = document.getElementById("umServiceId");

// Chip
if (chipNameEl) chipNameEl.textContent = username || "User";
if (roleEl) roleEl.textContent = role || "Role";

// Dropdown header
if (umNameEl) umNameEl.textContent = name  || "User";
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

/* ------------------------------
      Settings: Coming soon message
------------------------------ */
(function initSettingsSoonMessage() {
  const settingsLink = document.querySelector('.user-menu-item[href="settings.html"]');
  if (!settingsLink) return;

  function showSimpleToast(msg) {
    // use global showToast if exists (from auth/add-record), else fallback
    if (typeof window.showToast === "function") return window.showToast(msg, "info");
    const host = document.getElementById("toastHost") || document.body;
    const t = document.createElement("div");
    t.className = "toast info";
    t.textContent = msg;
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
      t.classList.remove("show");
      t.addEventListener("transitionend", () => t.remove(), { once: true });
    }, 2500);
  }

  settingsLink.addEventListener("click", (e) => {
    e.preventDefault();
    showSimpleToast("⚙️ Settings: Soon will be developed.");
    // keep dropdown open/close natural
    const dd = document.querySelector(".user-dropdown");
    dd?.classList.remove("open");
  });
})();

  // ===== Topbar profile dropdown =====
(function () {
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
         Logout
  ------------------------------ */
  window.logout = function () {
    localStorage.clear();
    window.location.href = "login.html";
  };

  document.body.classList.add("layout-ready");
}
