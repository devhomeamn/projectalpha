(async function () {
  // page flash বন্ধ
  document.documentElement.style.visibility = "hidden";

  const token = localStorage.getItem("token");
  if (!token) {
    window.location.replace("login.html");
    return;
  }

  // API base load
  let API_BASE = window.location.origin;
  try {
    const c = await fetch("/api/config");
    const d = await c.json();
    API_BASE = d.apiBase || window.location.origin;
  } catch (_) {}

  // ✅ JWT verify + role from server (/me)
  let role = "";
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("unauthorized");
    const data = await res.json();
    role = String(data.user?.role || "").toLowerCase();
  } catch (e) {
    localStorage.clear();
    window.location.replace("login.html");
    return;
  }

  // ✅ page-wise access map
  const page = location.pathname.split("/").pop();
  const pageRoles = {
    "approve-user.html": ["admin"],
    "all-users.html": ["admin"],
    "add-section.html": ["admin", "master"],
    "ao-clearance-requests.html": ["admin"],
    "inventory-items.html": ["admin", "inventory manager"],
    "create-requisition.html": ["admin", "general"],
    "my-requisitions.html": ["admin", "general"],
    "requisition-review.html": ["admin", "master"],
    "inventory-approval.html": ["admin", "inventory manager"],
    "inventory-issue.html": ["admin", "inventory manager"],
    "inventory-reports.html": ["admin", "inventory manager"],
  };

  const allowedRoles = pageRoles[page];
  if (Array.isArray(allowedRoles) && !allowedRoles.includes(role)) {
    window.location.replace("dashboard.html");
    return;
  }

  // ok, show page
  document.documentElement.style.visibility = "visible";
})();
