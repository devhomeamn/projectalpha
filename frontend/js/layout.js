// js/layout.js

export async function initLayout(activePage) {
  // Load topbar & sidebar HTML
  const [topbarRes, sidebarRes] = await Promise.all([
    fetch("components/topbar.html"),
    fetch("components/sidebar.html"),
  ]);

  document.getElementById("topbar").innerHTML = await topbarRes.text();
  document.getElementById("sidebar").innerHTML = await sidebarRes.text();

  // Wait briefly for elements to render
  await new Promise((r) => setTimeout(r, 50));

  // Retrieve user info
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const username = localStorage.getItem("username");
  const name = localStorage.getItem("name");

  if (!token) return (window.location.href = "login.html");

  // Define sidebar items
  const menuItems = [
    { name: "Dashboard", roles: ["Admin", "Master", "General"], link: "dashboard.html" },
    { name: "Add Record", roles: ["Admin", "Master", "General"], link: "add-record.html" },
    { name: "View Record", roles: ["Admin", "Master", "General"], link: "view-record.html" },
    { name: "View Central Record", roles: ["Admin", "Master", "General"], link: "central-record.html" },
    { name: "Add Section", roles: ["Admin", "Master"], link: "add-section.html" },
    { name: "Approve User", roles: ["Admin"], link: "approve-user.html" },
    { name: "All Users", roles: ["Admin"], link: "all-users.html" },
    { name: "Help", roles: ["Admin", "Master", "General"], link: "help.html" }
  ];

  // Filter by role
  const allowed = menuItems.filter(i => i.roles.includes(role));
  const menuList = document.getElementById("menuList");

  // Determine current page filename (e.g. "dashboard.html")
  const currentPage = activePage || window.location.pathname.split("/").pop();

  if (menuList) {
    menuList.innerHTML = allowed.map(item => {
      const isActive = currentPage === item.link ? "active" : "";
      return `
        <li class="menu-item ${isActive}">
          <a href="${item.link}">${item.name}</a>
        </li>
      `;
    }).join("");
  }

  // ✅ OPTIONAL: if you have a submenu (like “Reports” inside Dashboard)
  // Example structure:
  const dashboardWithSubmenu = `
    <li class="menu-item has-submenu ${["reports.html", "analytics.html"].includes(currentPage) ? "active" : ""}">
      <button class="submenu-toggle" onclick="toggleSubmenu(0)">Dashboard</button>
      <ul class="submenu ${["reports.html", "analytics.html"].includes(currentPage) ? "open" : ""}" id="submenu-0">
        <li class="submenu-item"><a href="reports.html">Reports</a></li>
        <li class="submenu-item"><a href="analytics.html">Analytics</a></li>
      </ul>
    </li>
  `;

  // Insert submenu before menuList if needed
  // menuList.insertAdjacentHTML('afterbegin', dashboardWithSubmenu);

  // Fill topbar info
  document.getElementById("name").textContent = name || "User";
  document.getElementById("username").textContent = username || "Not available";
  document.getElementById("role").textContent = role || "Unknown";
  document.getElementById("roleLabel").textContent = `Your Role: ${role || "Guest"}`;

  // Logout function
  window.logout = function () {
    localStorage.clear();
    window.location.href = "login.html";
  };

  // Submenu toggle function
  window.toggleSubmenu = function (index) {
    document.getElementById(`submenu-${index}`).classList.toggle("open");
  };
}
