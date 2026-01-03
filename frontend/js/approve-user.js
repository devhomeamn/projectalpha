// js/approve-user.js
document.addEventListener("DOMContentLoaded", () => {
  loadPendingUsers();
});

// ---------- Helpers ----------
function getToken() {
  return localStorage.getItem("token") || "";
}

function logoutToLogin() {
  localStorage.clear();
  window.location.href = "login.html";
}

async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  // only set JSON content-type when body is not FormData
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  // ✅ If unauthorized/forbidden => force login (or redirect)
  if (res.status === 401 || res.status === 403) {
    // আপনার modal/toast থাকলে দেখাতে পারেন
    try {
      showConfirm({
        title: "Unauthorized",
        message: "আপনার session শেষ হয়ে গেছে বা আপনার admin access নেই। আবার login করুন।",
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

// 🟢 Load Pending Users (ADMIN)
async function loadPendingUsers() {
  const tbody = document.querySelector("#pendingUsers tbody");
  if (!tbody) return;

  try {
    const res = await authFetch("/api/auth/pending");
    const users = await res.json();

    if (!Array.isArray(users) || !users.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No pending users</td></tr>`;
      return;
    }

    tbody.innerHTML = users
      .map((u) => {
        const roleText = (u.role || u.user_role || u.rule || "").toString();
        const roleLabel = roleText ? roleText.toUpperCase() : "—";

        return `
          <tr>
            <td><div class="cell-main">${u.name || ""}</div></td>

            <td>
              <div class="cell-main">${u.username || ""}</div>
              <div class="cell-sub">Role: <span class="role-badge">${roleLabel}</span></div>
            </td>

            <td>${u.serviceid || ""}</td>
            <td><span class="status section">${u.status}</span></td>
            <td>
              <button class="btn-move" onclick="approveUser(${u.id})">Approve</button>
              <button class="btn-move" style="background:#ef4444;" onclick="rejectUser(${u.id})">Reject</button>
            </td>
          </tr>`;
      })
      .join("");
  } catch (err) {
    console.error("Error loading pending users:", err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red;">Error loading data</td></tr>`;
  }
}

// 🟢 Approve User
window.approveUser = function approveUser(id) {
  showConfirm({
    title: "Approve User",
    message: "Are you sure you want to approve this user?",
    onConfirm: async () => {
      try {
        const res = await authFetch(`/api/auth/approve/${id}`, {
          method: "POST",
        });
        const data = await res.json();

        if (res.ok) {
          showSuccess("✅ User approved successfully!");
          loadPendingUsers();
        } else {
          showConfirm({
            title: "❌ Failed",
            message: data.error || "Approval failed.",
            type: "success",
          });
        }
      } catch (e) {
        console.error(e);
      }
    },
  });
};

// 🔴 Reject User
window.rejectUser = function rejectUser(id) {
  showConfirm({
    title: "Reject User",
    message: "Are you sure you want to reject this user?",
    onConfirm: async () => {
      try {
        const res = await authFetch(`/api/auth/reject/${id}`, {
          method: "POST",
        });
        const data = await res.json();

        if (res.ok) {
          showSuccess("❌ User rejected successfully!");
          loadPendingUsers();
        } else {
          showConfirm({
            title: "⚠️ Failed",
            message: data.error || "Rejection failed.",
            type: "success",
          });
        }
      } catch (e) {
        console.error(e);
      }
    },
  });
};
