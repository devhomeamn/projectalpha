// js/approve-user.js
document.addEventListener("DOMContentLoaded", loadPendingUsers);

// 🟢 Load Pending Users
async function loadPendingUsers() {
  const tbody = document.querySelector("#pendingUsers tbody");

  try {
    const res = await fetch("/api/auth/pending");
    const users = await res.json();

    if (!Array.isArray(users) || !users.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No pending users</td></tr>`;
      return;
    }

    tbody.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td>${u.name}</td>
        <td>${u.username}</td>
        <td>${u.serviceid}</td>
        <td><span class="status section">${u.status}</span></td>
        <td>
          <button class="btn-move" onclick="approveUser(${u.id})">Approve</button>
          <button class="btn-move" style="background:#ef4444;" onclick="rejectUser(${u.id})">Reject</button>
        </td>
      </tr>`
      )
      .join("");
  } catch (err) {
    console.error("Error loading pending users:", err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red;">Error loading data</td></tr>`;
  }
}

// 🟢 Approve User (with confirm modal)
function approveUser(id) {
  showConfirm({
    title: "Approve User",
    message: "Are you sure you want to approve this user?",
    onConfirm: async () => {
      try {
        const res = await fetch(`/api/auth/approve/${id}`, { method: "POST" });
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
        showConfirm({
          title: "⚠️ Error",
          message: "Error approving user.",
          type: "success",
        });
      }
    },
  });
}

// 🔴 Reject User (with confirm modal)
function rejectUser(id) {
  showConfirm({
    title: "Reject User",
    message: "Are you sure you want to reject this user?",
    onConfirm: async () => {
      try {
        const res = await fetch(`/api/auth/reject/${id}`, { method: "POST" });
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
        showConfirm({
          title: "⚠️ Error",
          message: "Error rejecting user.",
          type: "success",
        });
      }
    },
  });
}
