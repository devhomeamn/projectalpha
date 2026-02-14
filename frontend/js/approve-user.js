document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.querySelector("#pendingUsers tbody");
  const searchInput = document.getElementById("searchInput");
  const statPending = document.getElementById("statPending");

  let pendingUsers = [];

  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function debounce(fn, delay = 180) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function logoutToLogin() {
    localStorage.clear();
    window.location.href = "login.html";
  }

  async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = { ...(options.headers || {}) };

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401 || res.status === 403) {
      try {
        showConfirm({
          title: "Session Expired",
          message: "Your session has expired or you no longer have admin access.",
          type: "success",
          onConfirm: logoutToLogin,
        });
      } catch (_) {
        logoutToLogin();
      }
      throw new Error(`Auth error: ${res.status}`);
    }

    return res;
  }

  function getKeyword() {
    return (searchInput?.value || "").toLowerCase().trim();
  }

  function applyFilters(users) {
    const keyword = getKeyword();
    if (!keyword) return users;

    return users.filter((u) => {
      const name = (u.name || "").toLowerCase();
      const username = (u.username || "").toLowerCase();
      const serviceId = String(u.serviceid || "").toLowerCase();
      return name.includes(keyword) || username.includes(keyword) || serviceId.includes(keyword);
    });
  }

  function renderStats(filteredUsers) {
    if (statPending) statPending.textContent = String(filteredUsers.length);
  }

  function renderTable(users) {
    if (!users.length) {
      tbody.innerHTML = "<tr class=\"empty-row\"><td colspan=\"5\">No pending users found</td></tr>";
      return;
    }

    tbody.innerHTML = users
      .map((u) => {
        const roleText = String(u.role || u.user_role || u.rule || "");
        const roleLabel = roleText ? roleText.toUpperCase() : "-";

        return `
          <tr data-user-id="${Number(u.id)}">
            <td><div class="cell-main">${escapeHtml(u.name || "-")}</div></td>
            <td>
              <div class="cell-main">${escapeHtml(u.username || "-")}</div>
              <div class="cell-sub">Role: <span class="role-badge">${escapeHtml(roleLabel)}</span></div>
            </td>
            <td>${escapeHtml(u.serviceid || "-")}</td>
            <td><span class="status pending">${escapeHtml(u.status || "Pending")}</span></td>
            <td>
              <div class="action-cell">
                <button class="btn-move" data-action="approve" data-user-id="${Number(u.id)}" type="button">Approve</button>
                <button class="btn-reject" data-action="reject" data-user-id="${Number(u.id)}" type="button">Reject</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderView() {
    const filteredUsers = applyFilters(pendingUsers);
    renderStats(filteredUsers);
    renderTable(filteredUsers);
  }

  async function loadPendingUsers() {
    try {
      const res = await authFetch("/api/auth/pending");
      const users = await res.json();
      pendingUsers = Array.isArray(users) ? users : [];
      renderView();
    } catch (err) {
      console.error("Error loading pending users:", err);
      tbody.innerHTML = "<tr class=\"empty-row\"><td colspan=\"5\">Error loading data</td></tr>";
      renderStats([]);
    }
  }

  async function processUserAction(id, action) {
    const isApprove = action === "approve";

    showConfirm({
      title: isApprove ? "Approve User" : "Reject User",
      message: isApprove
        ? "Are you sure you want to approve this user?"
        : "Are you sure you want to reject this user?",
      onConfirm: async () => {
        try {
          const endpoint = isApprove ? `/api/auth/approve/${id}` : `/api/auth/reject/${id}`;
          const res = await authFetch(endpoint, { method: "POST" });
          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            showConfirm({
              title: "Failed",
              message: data.error || "Action failed.",
              type: "success",
            });
            return;
          }

          if (typeof showSuccess === "function") {
            showSuccess(isApprove ? "User approved successfully." : "User rejected successfully.");
          } else {
            showConfirm({
              title: "Success",
              message: isApprove ? "User approved successfully." : "User rejected successfully.",
              type: "success",
            });
          }

          loadPendingUsers();
        } catch (err) {
          console.error(err);
          showConfirm({
            title: "Failed",
            message: "Request failed. Please try again.",
            type: "success",
          });
        }
      },
    });
  }

  tbody?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const id = Number(btn.getAttribute("data-user-id"));
    const action = btn.getAttribute("data-action");
    if (!id || (action !== "approve" && action !== "reject")) return;

    processUserAction(id, action);
  });

  searchInput?.addEventListener("input", debounce(renderView, 180));

  loadPendingUsers();
});
