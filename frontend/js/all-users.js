// js/all-users.js
document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.querySelector("#usersTable tbody");
  const searchInput = document.getElementById("searchInput");

  let allUsers = [];

  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function redirectNonAdmin() {
    // admin page → non-admin হলে user dashboard এ পাঠান
    window.location.href = "dashboard-user.html";
  }

  function redirectLogin() {
    localStorage.clear();
    window.location.href = "login.html";
  }

  async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = { ...(options.headers || {}) };

    if (token) headers.Authorization = `Bearer ${token}`;
    headers["Content-Type"] = headers["Content-Type"] || "application/json";

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      // token missing/expired
      try {
        showConfirm({
          title: "Session Expired",
          message: "আপনার session শেষ হয়ে গেছে। আবার login করুন।",
          type: "success",
          onConfirm: redirectLogin,
        });
      } catch (_) {
        redirectLogin();
      }
      throw new Error("Unauthorized");
    }

    if (res.status === 403) {
      // not admin
      try {
        showConfirm({
          title: "Access Denied",
          message: "এটা শুধু Admin access করতে পারবে।",
          type: "success",
          onConfirm: redirectNonAdmin,
        });
      } catch (_) {
        redirectNonAdmin();
      }
      throw new Error("Forbidden");
    }

    return res;
  }

  function renderUsers(users) {
    if (!Array.isArray(users) || users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No users found</td></tr>`;
      return;
    }

    tbody.innerHTML = users
      .map((u) => {
        const status = (u.status || "").toString().toLowerCase();
        const created = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "";
        return `
          <tr>
            <td>${u.name || ""}</td>
            <td>${u.username || ""}</td>
            <td>${u.serviceid ?? ""}</td>
            <td>${u.role || ""}</td>
            <td><span class="status ${status}">${u.status || ""}</span></td>
            <td>${created}</td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadUsers() {
    try {
      const res = await authFetch("/api/auth/users/all");
      const users = await res.json();

      allUsers = Array.isArray(users) ? users : [];
      renderUsers(allUsers);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:red;">❌ ${err.message}</td></tr>`;
    }
  }

  // ✅ attach search listener only once
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const keyword = (searchInput.value || "").toLowerCase().trim();

      if (!keyword) {
        renderUsers(allUsers);
        return;
      }

      const filtered = allUsers.filter((u) => {
        const uname = (u.username || "").toLowerCase();
        const sid = (u.serviceid ?? "").toString();
        const name = (u.name || "").toLowerCase();
        return uname.includes(keyword) || sid.includes(keyword) || name.includes(keyword);
      });

      renderUsers(filtered);
    });
  }

  loadUsers();
});
