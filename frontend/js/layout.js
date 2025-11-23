// js/layout.js

export async function initLayout(activePage) {
  // Load topbar & sidebar HTML
  const [topbarRes, sidebarRes] = await Promise.all([
    fetch("components/topbar.html"),
    fetch("components/sidebar.html"),
  ]);

  document.getElementById("topbar").innerHTML = await topbarRes.text();
  document.getElementById("sidebar").innerHTML = await sidebarRes.text();

  // Small delay to ensure DOM is loaded
  await new Promise((r) => setTimeout(r, 50));

  // Retrieve user info
 // Retrieve user info
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");   // FIXED
const username = localStorage.getItem("username");
const name = localStorage.getItem("name");

if (!token) return (window.location.href = "login.html");


  /* ------------------------------
        Sidebar Menu Items
  ------------------------------ */
  const menuItems = [
    { name: "Dashboard", icon: "dashboard", roles: ["Admin", "Master" ], link: "dashboard.html" },
    { name: "Dashboard", icon: "dashboard", roles: ["Admin", "Master", "General"], link: "dashboard-user.html" },
    { name: "Add Record", icon: "library_add", roles: ["Admin", "Master", "General"], link: "add-record.html" },
    { name: "View Record", icon: "visibility", roles: ["Admin", "Master", "General"], link: "view-record.html" },
    { name: "Central Record", icon: "folder", roles: ["Admin", "Master", "General"], link: "central-record.html" },
    { name: "Add Section", icon: "add_circle", roles: ["Admin", "Master"], link: "add-section.html" },
    { name: "Approve User", icon: "verified_user", roles: ["Admin"], link: "approve-user.html" },
    { name: "All Users", icon: "group", roles: ["Admin"], link: "all-users.html" },
    { name: "Help", icon: "help", roles: ["Admin", "Master", "General"], link: "help.html" }
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
 if (menuList) {
  menuList.innerHTML = allowed.map(item => {
    const isActive = currentPage === item.link;
    return `
      <li class="menu-item ${isActive ? "active" : ""}">
        <a href="${item.link}" class="${isActive ? "active" : ""}">
          ${item.name}
        </a>
      </li>
    `;
  }).join("");
}


  /* ------------------------------
        Fill Topbar User Info
  ------------------------------ */
  document.getElementById("name").textContent = name || "User";
  document.getElementById("username").textContent = username || "Unknown";
  document.getElementById("role").textContent = role || "Unknown";
  document.getElementById("roleLabel").textContent = `Your Role: ${role}`;

  /* ------------------------------
        Sidebar Toggle (Mobile)
  ------------------------------ */
window.toggleSidebar = function () {
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.getElementById("overlay");

    sidebar.classList.toggle("open");

    if (sidebar.classList.contains("open")) {
        overlay.classList.add("show");
    } else {
        overlay.classList.remove("show");
    }
};

document.getElementById("overlay").addEventListener("click", () => {
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.getElementById("overlay");

    sidebar.classList.remove("open");
    overlay.classList.remove("show");
});



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
    submenu.classList.toggle("open");
  };
}
