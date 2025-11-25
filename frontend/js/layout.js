// js/layout.js

export async function initLayout(activePage) {
  // Load topbar & sidebar HTML
  const [topbarRes, sidebarRes] = await Promise.all([
    fetch("components/topbar.html"),
    fetch("components/sidebar.html"),
  ]);

// ✅ Sidebar profile fill
const sidebarNameEl = document.getElementById("sidebarName");
const sidebarRoleEl = document.getElementById("sidebarRole");
const sidebarAvatarEl = document.getElementById("sidebarAvatar");

if (sidebarNameEl) sidebarNameEl.textContent = name || "User";
if (sidebarRoleEl) sidebarRoleEl.textContent = role || "Role";

// চাইলে username ভিত্তিক robohash
if (sidebarAvatarEl) {
  const u = username || "sfrms";
  sidebarAvatarEl.src = `https://robohash.org/${encodeURIComponent(u)}.png?size=80x80`;
}



  document.getElementById("topbar").innerHTML = await topbarRes.text();
  document.getElementById("sidebar").innerHTML = await sidebarRes.text();

  // Small delay to ensure DOM is loaded
  await new Promise((r) => setTimeout(r, 50));

  // Retrieve user info
  const token = localStorage.getItem("token");
  let role = localStorage.getItem("role");  // FIXED
  const username = localStorage.getItem("username");
  const name = localStorage.getItem("name");

  if (!token) return (window.location.href = "login.html");

  // ✅ normalize role to match menuItems ("Admin"/"Master"/"General")
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
    { name: "Reports", icon: "bar_chart", roles: ["Admin", "Master", "General"], link: "reports.html" },

    { name: "Help",          icon: "help",         roles: ["Admin", "Master", "General"], link: "help.html" }
  ];

  /* ------------------------------
        Filter According to Role
  ------------------------------ */
  const allowed = menuItems.filter(i => i.roles.includes(role));
  const menuList = document.getElementById("menuList");

  // Determine page
  const currentPage = activePage || window.location.pathname.split("/").pop();

  /* ------------------------------
        Render Sidebar Menu
  ------------------------------ */
 menuList.innerHTML = allowed.map(item => {
  const isActive = currentPage === item.link;

  return `
    <li class="menu-item ${isActive ? "active" : ""}">
      <a href="${item.link}" class="${isActive ? "active" : ""}">
        <span class="material-symbols-rounded menu-icon">${item.icon}</span>
        <span>${item.name}</span>
        ${item.badge ? `<span class="menu-badge">${item.badge}</span>` : ""}
      </a>
    </li>
  `;
}).join("");

  /* ------------------------------
        Fill Topbar User Info
  ------------------------------ */
  document.getElementById("name").textContent = name || "User";
  document.getElementById("username").textContent = username || "Unknown";
  document.getElementById("role").textContent = role || "Unknown";
  document.getElementById("roleLabel").textContent = `Your Role: ${role}`;

  /* ------------------------------
        Sidebar Toggle (Mobile + Desktop)
  ------------------------------ */
  window.toggleSidebar = function () {
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.getElementById("overlay");
    if (!sidebar) return;

    // mobile behavior
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle("open");
      if (overlay) overlay.classList.toggle("show");
      return;
    }

    // desktop behavior (drawer style)
    document.body.classList.toggle("sidebar-collapsed");
  };

  // ✅ overlay click safe (if overlay exists)
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

  /* ------------------------------
         Submenu Support (Optional)
  ------------------------------ */
  window.toggleSubmenu = function (id) {
    const submenu = document.getElementById(`submenu-${id}`);
    submenu?.classList.toggle("open");
  };

  /* ✅ IMPORTANT: layout load done -> show page */
  document.body.classList.add("layout-ready");
}
