// js/all-users.js
document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.querySelector("#usersTable tbody");
  const searchInput = document.getElementById("searchInput");

  // Modal refs
  const accessModal = document.getElementById("accessModal");
  const accessCloseBtn = document.getElementById("accessCloseBtn");
  const amName = document.getElementById("amName");
  const amMeta = document.getElementById("amMeta");
  const amRole = document.getElementById("amRole");
  const amSection = document.getElementById("amSection");
  const amHint = document.getElementById("amHint");
  const amCancel = document.getElementById("amCancel");
  const amSave = document.getElementById("amSave");

  let allUsers = [];
  let allSections = [];
  let sectionsById = new Map();
  let activeUserId = null;

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
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">No users found</td></tr>`;
      return;
    }

    tbody.innerHTML = users
      .map((u) => {
        const status = (u.status || "").toString().toLowerCase();
        const created = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "";

        const role = (u.role || "").toString();
        const roleKey = role.toLowerCase();
        const sectionName = u.section_id ? (sectionsById.get(Number(u.section_id)) || `#${u.section_id}`) : "-";

        const roleBadge = role
          ? `<span class="role-badge role-${roleKey}">${role}</span>`
          : "-";

        return `
          <tr data-user-id="${u.id}">
            <td>${u.name || ""}</td>
            <td>${u.username || ""}</td>
            <td>${u.serviceid ?? ""}</td>
            <td>${roleBadge}</td>
            <td>${sectionName}</td>
            <td><span class="status ${status}">${u.status || ""}</span></td>
            <td>${created}</td>
           <td style="text-align:center; display:flex; gap:6px; justify-content:center;">
  <button class="btn-edit" type="button" data-action="edit" title="Edit Access">
    <span class="material-symbols-rounded">edit</span>
  </button>

  <button
    class="btn-toggle"
    type="button"
    data-action="toggle"
    data-active="${u.is_active !== false}"
    title="${u.is_active === false ? "Activate User" : "Deactivate User"}">
    <span class="material-symbols-rounded">
      ${u.is_active === false ? "lock_open" : "lock"}
    </span>
  </button>
</td>

          </tr>
        `;
      })
      .join("");
  }

  function openAccessModal(user) {
    if (!accessModal || !user) return;
    activeUserId = user.id;

    if (amName) amName.textContent = user.name || "—";
    if (amMeta) {
      const parts = [
        user.username ? `@${user.username}` : null,
        user.serviceid ? `Service: ${user.serviceid}` : null,
        user.email ? user.email : null,
      ].filter(Boolean);
      amMeta.textContent = parts.join(" • ") || "—";
    }

    // Select role/section
    const role = (user.role || "General").toString();
    if (amRole) amRole.value = role;

    const sec = user.section_id ? String(user.section_id) : "";
    if (amSection) amSection.value = sec;

    applyRoleUi(role);
    accessModal.style.display = "flex";
    accessModal.setAttribute("aria-hidden", "false");
  }

  function closeAccessModal() {
    if (!accessModal) return;
    accessModal.style.display = "none";
    accessModal.setAttribute("aria-hidden", "true");
    activeUserId = null;
  }

  function applyRoleUi(role) {
    const isGeneral = String(role) === "General";
    if (amSection) amSection.disabled = !isGeneral;
    if (amHint) amHint.style.display = isGeneral ? "block" : "none";
    if (!isGeneral && amSection) amSection.value = "";
  }

  async function loadUsers() {
    try {
      const res = await authFetch("/api/auth/users/all");
      const users = await res.json();

      allUsers = Array.isArray(users) ? users : [];
      renderUsers(allUsers);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:red;">❌ ${err.message}</td></tr>`;
    }
  }

  async function loadSections() {
    try {
      const res = await authFetch("/api/sections");
      const sections = await res.json();
      allSections = Array.isArray(sections) ? sections : [];
      sectionsById = new Map(allSections.map(s => [Number(s.id), s.name]));

      if (amSection) {
        // reset options (keep placeholder)
        amSection.innerHTML = `<option value="">— Select Section —</option>`;
        allSections.forEach((s) => {
          const opt = document.createElement("option");
          opt.value = String(s.id);
          opt.textContent = s.name;
          amSection.appendChild(opt);
        });
      }
    } catch (e) {
      console.warn("Failed to load sections", e);
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

  // Row click (or edit button) → open modal
  tbody?.addEventListener("click", (e) => {

  /* ===============================
     1️⃣ Deactivate / Activate button
  =============================== */
 const toggleBtn = e.target.closest("button[data-action='toggle']");
if (toggleBtn) {
  e.stopPropagation();
  e.preventDefault();

  const tr = toggleBtn.closest("tr[data-user-id]");
  const id = Number(tr.getAttribute("data-user-id"));
  const user = allUsers.find(u => Number(u.id) === id);
  if (!user) return;

  const nextActive = user.is_active === false;

  const ok = window.confirm(
    (nextActive ? "Activate User?\n\n" : "Deactivate User?\n\n") +
    (nextActive
      ? "এই ইউজার আবার login করতে পারবে।"
      : "এই ইউজার login করতে পারবে না।")
  );

  if (!ok) return;

  (async () => {
    try {
      const res = await authFetch(`/api/auth/users/${id}/toggle-active`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: nextActive })
      });

      const out = await res.json();
      if (out?.user) {
        const idx = allUsers.findIndex(u => Number(u.id) === id);
        if (idx >= 0) allUsers[idx] = out.user;
        renderUsers(allUsers);
      }
    } catch (err) {
      alert(err?.message || "Update failed");
    }
  })();

  return;
}


  /* ===============================
     2️⃣ Edit button
  =============================== */
  const editBtn = e.target.closest("button[data-action='edit']");
  if (editBtn) {
    e.stopPropagation();
    e.preventDefault();

    const tr = editBtn.closest("tr[data-user-id]");
    if (!tr) return;
    const id = Number(tr.getAttribute("data-user-id"));
    const user = allUsers.find(u => Number(u.id) === id);
    if (user) openAccessModal(user);

    return; // 🔴 stop row click
  }

  /* ===============================
     3️⃣ Row click (fallback)
  =============================== */
  const tr = e.target.closest("tr[data-user-id]");
  if (!tr) return;

  const id = Number(tr.getAttribute("data-user-id"));
  const user = allUsers.find(u => Number(u.id) === id);
  if (user) openAccessModal(user);
});


  // Modal events
  accessCloseBtn?.addEventListener("click", closeAccessModal);
  amCancel?.addEventListener("click", closeAccessModal);
  accessModal?.addEventListener("click", (e) => {
    if (e.target === accessModal) closeAccessModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAccessModal();
  });

  amRole?.addEventListener("change", () => {
    applyRoleUi(amRole.value);
  });

  amSave?.addEventListener("click", async () => {
    if (!activeUserId) return;

    const role = (amRole?.value || "General").toString();
    const section_id = (amSection?.value || "").toString().trim();

    if (role === "General" && !section_id) {
      try {
        showConfirm({
          title: "Section Required",
          message: "General user এর জন্য অবশ্যই একটি Section select করতে হবে।",
          type: "error",
        });
      } catch (_) {
        alert("General user এর জন্য অবশ্যই একটি Section select করতে হবে।");
      }
      return;
    }

    try {
      const res = await authFetch(`/api/auth/users/${activeUserId}/access`, {
        method: "PATCH",
        body: JSON.stringify({
          role,
          section_id: role === "General" ? Number(section_id) : null,
        }),
      });

      const out = await res.json();
      const updatedUser = out?.user;
      if (updatedUser) {
        // update local cache
        const idx = allUsers.findIndex((u) => Number(u.id) === Number(updatedUser.id));
        if (idx >= 0) allUsers[idx] = { ...allUsers[idx], ...updatedUser };
      }

      // re-render respecting current search
      const keyword = (searchInput?.value || "").toLowerCase().trim();
      if (keyword) {
        const filtered = allUsers.filter((u) => {
          const uname = (u.username || "").toLowerCase();
          const sid = (u.serviceid ?? "").toString();
          const name = (u.name || "").toLowerCase();
          return uname.includes(keyword) || sid.includes(keyword) || name.includes(keyword);
        });
        renderUsers(filtered);
      } else {
        renderUsers(allUsers);
      }

      closeAccessModal();

      try {
        showConfirm({
          title: "Saved",
          message: "✅ Role/Section update সফল হয়েছে।",
          type: "success",
        });
      } catch (_) {
        // ignore
      }
    } catch (err) {
      try {
        showConfirm({
          title: "Failed",
          message: err?.message || "Update failed",
          type: "error",
        });
      } catch (_) {
        alert(err?.message || "Update failed");
      }
    }
  });





  // Init
  loadSections().then(loadUsers);
});
