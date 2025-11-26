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
  const nameEl = document.getElementById("name");
  const usernameEl = document.getElementById("username");
  const roleEl = document.getElementById("role");
  const roleLabelEl = document.getElementById("roleLabel");

  if (nameEl) nameEl.textContent = name || "User";
  if (usernameEl) usernameEl.textContent = username || "Unknown";
  if (roleEl) roleEl.textContent = role || "Unknown";
  if (roleLabelEl) roleLabelEl.textContent = `Your Role: ${role}`;

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
         Logout
  ------------------------------ */
  window.logout = function () {
    localStorage.clear();
    window.location.href = "login.html";
  };

  document.body.classList.add("layout-ready");
}
