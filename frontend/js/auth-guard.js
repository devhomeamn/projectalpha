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

  // ✅ admin-only pages list
  const page = location.pathname.split("/").pop();
  const adminOnly = new Set([
    "approve-user.html",
    "all-users.html",
    "add-section.html",
    "ao-clearance-requests.html",
  ]);

  if (adminOnly.has(page) && role !== "admin") {
    // admin না হলে ঢুকতেই দেবে না
    window.location.replace("dashboard.html");
    return;
  }

  // ok, show page
  document.documentElement.style.visibility = "visible";
})();
