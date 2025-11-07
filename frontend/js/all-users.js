document.addEventListener("DOMContentLoaded", async () => {
  const tbody = document.querySelector("#usersTable tbody");
  const searchInput = document.getElementById("searchInput");
  const token = localStorage.getItem("token"); // ✅ Get JWT token

  async function loadUsers() {
    try {
      // ✅ Correct backend path
      const res = await fetch("/api/auth/users/all", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          alert("Access denied. Admin only.");
          window.location.href = "dashboard.html";
          return;
        }
        throw new Error("Failed to fetch users");
      }

      const users = await res.json();
      renderUsers(users);

      // 🔹 Search filter
      searchInput.addEventListener("input", () => {
        const keyword = searchInput.value.toLowerCase();
        const filtered = users.filter(
          (u) =>
            u.username.toLowerCase().includes(keyword) ||
            u.serviceid.toString().includes(keyword)
        );
        renderUsers(filtered);
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:red;">❌ ${err.message}</td></tr>`;
    }
  }

  function renderUsers(users) {
    tbody.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td>${u.name}</td>
        <td>${u.username}</td>
        <td>${u.serviceid}</td>
        <td>${u.role}</td>
        <td><span class="status ${u.status.toLowerCase()}">${u.status}</span></td>
        <td>${new Date(u.createdAt).toLocaleDateString()}</td>
      </tr>`
      )
      .join("");
  }

  loadUsers();
});
