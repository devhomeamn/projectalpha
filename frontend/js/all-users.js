document.addEventListener("DOMContentLoaded", () => {
  const tbody = document.querySelector("#usersTable tbody");
  const searchInput = document.getElementById("searchInput");
  const roleFilter = document.getElementById("roleFilter");
  const statusFilter = document.getElementById("statusFilter");

  const statTotal = document.getElementById("statTotal");
  const statActive = document.getElementById("statActive");
  const statInactive = document.getElementById("statInactive");

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

  function redirectNonAdmin() {
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
      try {
        showConfirm({
          title: "Session Expired",
          message: "Your session has expired. Please login again.",
          type: "error",
          onConfirm: redirectLogin,
        });
      } catch (_) {
        redirectLogin();
      }
      throw new Error("Unauthorized");
    }

    if (res.status === 403) {
      try {
        showConfirm({
          title: "Access Denied",
          message: "Only admins can access this page.",
          type: "error",
          onConfirm: redirectNonAdmin,
        });
      } catch (_) {
        redirectNonAdmin();
      }
      throw new Error("Forbidden");
    }

    return res;
  }

  function getCurrentFilters() {
    return {
      keyword: (searchInput?.value || "").toLowerCase().trim(),
      role: (roleFilter?.value || "").toLowerCase(),
      status: (statusFilter?.value || "").toLowerCase(),
    };
  }

  function applyFilters(users) {
    const { keyword, role, status } = getCurrentFilters();

    return users.filter((u) => {
      const userName = (u.name || "").toLowerCase();
      const username = (u.username || "").toLowerCase();
      const serviceId = String(u.serviceid ?? "");
      const roleName = (u.role || "").toLowerCase();
      const statusName = (u.status || "").toLowerCase();

      const keywordPass =
        !keyword ||
        userName.includes(keyword) ||
        username.includes(keyword) ||
        serviceId.includes(keyword);

      const rolePass = !role || roleName === role;
      const statusPass = !status || statusName === status;

      return keywordPass && rolePass && statusPass;
    });
  }

  function renderStats(users) {
    const total = users.length;
    const active = users.filter((u) => u.is_active !== false).length;
    const inactive = total - active;

    if (statTotal) statTotal.textContent = String(total);
    if (statActive) statActive.textContent = String(active);
    if (statInactive) statInactive.textContent = String(inactive);
  }

  function renderUsers(users) {
    if (!Array.isArray(users) || users.length === 0) {
      tbody.innerHTML = "<tr class=\"empty-row\"><td colspan=\"8\">No users found</td></tr>";
      return;
    }

    tbody.innerHTML = users
      .map((u) => {
        const status = (u.status || "").toLowerCase();
        const created = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-";
        const role = String(u.role || "");
        const roleClass = role.toLowerCase();
        const sectionName = u.section_id
          ? sectionsById.get(Number(u.section_id)) || `#${u.section_id}`
          : "-";
        const isActive = u.is_active !== false;

        const roleBadge = role
          ? `<span class=\"role-badge role-${escapeHtml(roleClass)}\">${escapeHtml(role)}</span>`
          : "-";

        const statusBadge = `<span class=\"status ${escapeHtml(status)}\">${escapeHtml(u.status || "-")}</span>`;

        return `
          <tr data-user-id="${Number(u.id)}" data-inactive="${isActive ? "false" : "true"}">
            <td>${escapeHtml(u.name || "-")}</td>
            <td>${escapeHtml(u.username || "-")}</td>
            <td>${escapeHtml(u.serviceid ?? "-")}</td>
            <td>${roleBadge}</td>
            <td>${escapeHtml(sectionName)}</td>
            <td>${statusBadge}</td>
            <td>${escapeHtml(created)}</td>
            <td>
              <div class="action-cell">
                <button class="btn-edit" type="button" data-action="edit" title="Edit Access" aria-label="Edit Access">
                  <span class="material-symbols-rounded">edit</span>
                </button>
                <button
                  class="btn-toggle ${isActive ? "" : "is-inactive"}"
                  type="button"
                  data-action="toggle"
                  data-active="${isActive}"
                  title="${isActive ? "Deactivate User" : "Activate User"}"
                  aria-label="${isActive ? "Deactivate User" : "Activate User"}">
                  <span class="material-symbols-rounded">${isActive ? "lock" : "lock_open"}</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderView() {
    const filtered = applyFilters(allUsers);
    renderUsers(filtered);
    renderStats(filtered);
  }

  function applyRoleUi(role) {
    const isGeneral = String(role) === "General";
    if (amSection) amSection.disabled = !isGeneral;
    if (amHint) amHint.style.display = isGeneral ? "block" : "none";
    if (!isGeneral && amSection) amSection.value = "";
  }

  function openAccessModal(user) {
    if (!accessModal || !user) return;
    activeUserId = user.id;

    if (amName) amName.textContent = user.name || "-";
    if (amMeta) {
      const parts = [
        user.username ? `@${user.username}` : null,
        user.serviceid ? `Service: ${user.serviceid}` : null,
        user.email || null,
      ].filter(Boolean);
      amMeta.textContent = parts.join(" | ") || "-";
    }

    const role = String(user.role || "General");
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

  async function loadSections() {
    try {
      const res = await authFetch("/api/sections");
      const sections = await res.json();
      allSections = Array.isArray(sections) ? sections : [];
      sectionsById = new Map(allSections.map((s) => [Number(s.id), s.name]));

      if (amSection) {
        amSection.innerHTML = "<option value=\"\">Select Section</option>";
        allSections.forEach((s) => {
          const opt = document.createElement("option");
          opt.value = String(s.id);
          opt.textContent = s.name;
          amSection.appendChild(opt);
        });
      }
    } catch (err) {
      console.warn("Failed to load sections", err);
    }
  }

  async function loadUsers() {
    try {
      const res = await authFetch("/api/auth/users/all");
      const users = await res.json();
      allUsers = Array.isArray(users) ? users : [];
      renderView();
    } catch (err) {
      tbody.innerHTML = `<tr class=\"empty-row\"><td colspan=\"8\">Failed to load users: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  async function handleToggle(userId, nextActive) {
    const actionWord = nextActive ? "Activate" : "Deactivate";

    const confirmed = window.confirm(`${actionWord} this user?`);
    if (!confirmed) return;

    try {
      const res = await authFetch(`/api/auth/users/${userId}/toggle-active`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: nextActive }),
      });

      const out = await res.json();
      if (out?.user) {
        const idx = allUsers.findIndex((u) => Number(u.id) === Number(userId));
        if (idx >= 0) allUsers[idx] = out.user;
        renderView();
      }
    } catch (err) {
      try {
        showConfirm({
          title: "Update Failed",
          message: err?.message || "Unable to update user status.",
          type: "error",
        });
      } catch (_) {
        alert(err?.message || "Unable to update user status.");
      }
    }
  }

  async function handleSaveAccess() {
    if (!activeUserId) return;

    const role = String(amRole?.value || "General");
    const sectionId = String(amSection?.value || "").trim();

    if (role === "General" && !sectionId) {
      try {
        showConfirm({
          title: "Section Required",
          message: "Please select a section for General role.",
          type: "error",
        });
      } catch (_) {
        alert("Please select a section for General role.");
      }
      return;
    }

    try {
      const res = await authFetch(`/api/auth/users/${activeUserId}/access`, {
        method: "PATCH",
        body: JSON.stringify({
          role,
          section_id: role === "General" ? Number(sectionId) : null,
        }),
      });

      const out = await res.json();
      const updatedUser = out?.user;
      if (updatedUser) {
        const idx = allUsers.findIndex((u) => Number(u.id) === Number(updatedUser.id));
        if (idx >= 0) allUsers[idx] = { ...allUsers[idx], ...updatedUser };
      }

      closeAccessModal();
      renderView();

      try {
        showConfirm({
          title: "Saved",
          message: "User access updated successfully.",
          type: "success",
        });
      } catch (_) {
      }
    } catch (err) {
      try {
        showConfirm({
          title: "Update Failed",
          message: err?.message || "Unable to update user access.",
          type: "error",
        });
      } catch (_) {
        alert(err?.message || "Unable to update user access.");
      }
    }
  }

  tbody?.addEventListener("click", (e) => {
    const toggleBtn = e.target.closest("button[data-action='toggle']");
    if (toggleBtn) {
      e.preventDefault();
      e.stopPropagation();

      const tr = toggleBtn.closest("tr[data-user-id]");
      const userId = Number(tr?.getAttribute("data-user-id"));
      const user = allUsers.find((u) => Number(u.id) === userId);
      if (!user) return;

      const nextActive = user.is_active === false;
      handleToggle(userId, nextActive);
      return;
    }

    const editBtn = e.target.closest("button[data-action='edit']");
    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();

      const tr = editBtn.closest("tr[data-user-id]");
      const userId = Number(tr?.getAttribute("data-user-id"));
      const user = allUsers.find((u) => Number(u.id) === userId);
      if (user) openAccessModal(user);
      return;
    }

    const tr = e.target.closest("tr[data-user-id]");
    if (!tr) return;

    const userId = Number(tr.getAttribute("data-user-id"));
    const user = allUsers.find((u) => Number(u.id) === userId);
    if (user) openAccessModal(user);
  });

  accessCloseBtn?.addEventListener("click", closeAccessModal);
  amCancel?.addEventListener("click", closeAccessModal);
  accessModal?.addEventListener("click", (e) => {
    if (e.target === accessModal) closeAccessModal();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAccessModal();
  });

  amRole?.addEventListener("change", () => applyRoleUi(amRole.value));
  amSave?.addEventListener("click", handleSaveAccess);

  const debouncedRender = debounce(renderView, 180);
  searchInput?.addEventListener("input", debouncedRender);
  roleFilter?.addEventListener("change", renderView);
  statusFilter?.addEventListener("change", renderView);

  loadSections().then(loadUsers);
});
