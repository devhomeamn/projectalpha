console.log("settings.js loaded");

const state = {
  apiBase: "",
  allRacks: [],
  filteredRacks: [],
  selectedSet: new Set(),
};

function getToken() {
  return localStorage.getItem("token") || "";
}

function showToast(message, type = "success", duration = 2600) {
  if (typeof window.showToast === "function" && window.showToast !== showToast) {
    window.showToast(message, type, duration);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, duration);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeApiBase(apiBaseFromServer) {
  let base = (apiBaseFromServer || window.location.origin || "").trim();
  if (base.endsWith("/")) base = base.slice(0, -1);
  return base;
}

async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    showToast("Session expired. Please login again.", "error");
    setTimeout(() => (window.location.href = "login.html"), 700);
    throw new Error("Unauthorized");
  }

  if (res.status === 403) {
    showToast("Access denied.", "error");
    throw new Error("Forbidden");
  }

  return res;
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    state.apiBase = normalizeApiBase(data.apiBase || "");
  } catch {
    state.apiBase = window.location.origin;
  }
}

function flattenRacksFromSections(sections) {
  const out = [];

  (sections || []).forEach((section) => {
    const sectionName = section?.name || "";
    const racks = section?.Racks || [];

    racks.forEach((rack) => {
      out.push({
        id: Number(rack.id),
        name: rack.name || "",
        section_id: Number(section.id),
        section_name: sectionName,
      });
    });
  });

  return out.filter((rack) => Number.isFinite(rack.id));
}

function getRackSearchKeyword() {
  const input = document.getElementById("rackSearch");
  return (input?.value || "").toLowerCase().trim();
}

function filterRacks() {
  const keyword = getRackSearchKeyword();
  if (!keyword) {
    state.filteredRacks = [...state.allRacks];
    return;
  }

  state.filteredRacks = state.allRacks.filter((rack) => {
    const rackName = String(rack.name || "").toLowerCase();
    const sectionName = String(rack.section_name || "").toLowerCase();
    return rackName.includes(keyword) || sectionName.includes(keyword);
  });
}

function updateCounters() {
  const selectedCountEl = document.getElementById("selectedCount");
  const visibleCountEl = document.getElementById("visibleCount");
  const totalCountEl = document.getElementById("totalCount");

  const visibleIds = new Set(state.filteredRacks.map((rack) => rack.id));
  const selectedVisible = Array.from(state.selectedSet).filter((id) => visibleIds.has(id)).length;

  if (selectedCountEl) selectedCountEl.textContent = String(selectedVisible);
  if (visibleCountEl) visibleCountEl.textContent = String(state.filteredRacks.length);
  if (totalCountEl) totalCountEl.textContent = String(state.allRacks.length);
}

function syncChecks() {
  document.querySelectorAll('input[type="checkbox"][data-rack-id]').forEach((checkbox) => {
    const id = Number(checkbox.getAttribute("data-rack-id"));
    checkbox.checked = state.selectedSet.has(id);

    checkbox.onchange = () => {
      if (checkbox.checked) state.selectedSet.add(id);
      else state.selectedSet.delete(id);
      updateCounters();
    };
  });
}

function renderRackGroups() {
  const host = document.getElementById("rackList");
  if (!host) return;

  host.innerHTML = "";

  if (!state.filteredRacks.length) {
    host.innerHTML = '<div class="loading">No racks found for current filter.</div>';
    updateCounters();
    return;
  }

  const groups = new Map();
  state.filteredRacks.forEach((rack) => {
    const key = `${rack.section_id}__${rack.section_name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rack);
  });

  for (const [key, racks] of groups.entries()) {
    racks.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const [, sectionName] = key.split("__");

    const wrapper = document.createElement("div");
    wrapper.className = "rack-group";

    const head = document.createElement("div");
    head.className = "group-title";
    head.innerHTML = `<div>${escapeHtml(sectionName || "Section")} <small>(${racks.length})</small></div>`;

    const quick = document.createElement("button");
    quick.type = "button";
    quick.className = "btn";
    quick.style.padding = "0 10px";
    quick.innerHTML = '<span class="material-symbols-rounded">done</span> Select section';
    quick.addEventListener("click", () => {
      racks.forEach((rack) => state.selectedSet.add(rack.id));
      syncChecks();
      updateCounters();
    });

    head.appendChild(quick);
    wrapper.appendChild(head);

    racks.forEach((rack) => {
      const row = document.createElement("label");
      row.className = "rack-item";
      row.innerHTML = `
        <input type="checkbox" data-rack-id="${rack.id}">
        <div>${escapeHtml(rack.name)}</div>
      `;
      wrapper.appendChild(row);
    });

    host.appendChild(wrapper);
  }

  syncChecks();
  updateCounters();
}

function rerenderBySearch() {
  filterRacks();
  renderRackGroups();
}

async function savePreferences() {
  const ids = Array.from(state.selectedSet.values()).sort((a, b) => a - b);
  const res = await authFetch(`${state.apiBase}/api/auth/me/preferred-racks`, {
    method: "PUT",
    body: JSON.stringify({ rack_ids: ids }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    showToast(data?.error || "Failed to save preferences.", "error");
    return;
  }

  showToast("Preferred racks saved successfully.", "success");
  localStorage.setItem("preferred_rack_ids", JSON.stringify(data.rack_ids || ids));
}

async function initData() {
  await loadConfig();

  const sectionRes = await authFetch(`${state.apiBase}/api/sections`);
  const sections = await sectionRes.json();
  state.allRacks = flattenRacksFromSections(Array.isArray(sections) ? sections : []);

  const prefRes = await authFetch(`${state.apiBase}/api/auth/me/preferred-racks`);
  const prefData = await prefRes.json();

  state.selectedSet = new Set(
    (prefData?.rack_ids || [])
      .map(Number)
      .filter((id) => Number.isFinite(id))
  );

  rerenderBySearch();
}

function bindEvents() {
  document.getElementById("rackSearch")?.addEventListener("input", rerenderBySearch);

  document.getElementById("btnSelectAll")?.addEventListener("click", () => {
    state.filteredRacks.forEach((rack) => state.selectedSet.add(rack.id));
    syncChecks();
    updateCounters();
  });

  document.getElementById("btnClearAll")?.addEventListener("click", () => {
    const visibleIds = new Set(state.filteredRacks.map((rack) => rack.id));
    state.selectedSet.forEach((id) => {
      if (visibleIds.has(id)) state.selectedSet.delete(id);
    });
    syncChecks();
    updateCounters();
  });

  document.getElementById("btnSave")?.addEventListener("click", savePreferences);
}

async function main() {
  bindEvents();
  await initData();
}

main().catch((error) => {
  console.error(error);
  showToast("Failed to load settings.", "error");
});
