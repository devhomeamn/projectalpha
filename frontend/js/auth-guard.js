// ✅ Role-based route protection for all pages
(function () {
  const token = localStorage.getItem("token");
  const roleRaw = localStorage.getItem("role") || "";
  const role = roleRaw.trim(); // keep original case for matching

  // 🚫 Hide body immediately (prevent flash of content)
  document.documentElement.style.display = "none";

  // 1️⃣ Check login status
  if (!token) {
    window.location.replace("login.html");
    return;
  }

  // 2️⃣ Define restricted pages
  const currentPage = window.location.pathname.split("/").pop();

  const restrictedPages = {
    "add-section.html": ["Admin", "Master"],
    "approve-user.html": ["Admin"],
    "all-users.html": ["Admin"],
  };

  // 3️⃣ Access control check
  if (restrictedPages[currentPage]) {
    const allowedRoles = restrictedPages[currentPage];

    if (!allowedRoles.includes(role)) {
      alert("Access Denied: You do not have permission to view this page.");
      window.location.replace("dashboard.html");
      return;
    }
  }

  // 4️⃣ Unhide page for authorized users
  document.documentElement.style.display = "";

  // 5️⃣ Hide restricted menu items dynamically (NO :contains)
  document.addEventListener("DOMContentLoaded", () => {
    const lowerRole = role.toLowerCase();

    // যেসব মেনু admin/master ছাড়া দেখাবে না
    const restrictedMenus = ["Add Section", "Approve User", "All Users"];

    // সব sidebar li নাও (sidebar load হলে কাজ করবে)
    const allLis = [...document.querySelectorAll(".sidebar-menu li")];

    allLis.forEach((li) => {
      const text = (li.innerText || "").trim();

      if (restrictedMenus.includes(text)) {
        if (!(lowerRole === "admin" || lowerRole === "master")) {
          li.style.display = "none";
        }
      }
    });
  });
})();
