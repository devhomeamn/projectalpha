console.log("settings.js loaded");

function getToken() {
  return localStorage.getItem("token") || "";
}

function showToast(message, type = "success", duration = 2600) {
  if (typeof window.showToast === "function" && window.showToast !== showToast) return window.showToast(message, type, duration);
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

async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

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

let API_BASE = "";

function normalizeApiBase(apiBaseFromServer) {
  let base = (apiBaseFromServer || window.location.origin || "").trim();
  if (base.endsWith("/")) base = base.slice(0, -1);
  return base;
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    API_BASE = normalizeApiBase(data.apiBase || "");
  } catch {
    API_BASE = window.location.origin;
  }
}

function flattenRacksFromSections(sections) {
  const out = [];
  (sections || []).forEach((sec) => {
    const secName = sec?.name || "";
    const racks = sec?.Racks || [];
    racks.forEach((r) => {
      out.push({
        id: r.id,
        name: r.name,
        section_id: sec.id,
        section_name: secName,
      });
    });
  });
  return out;
}

function renderRackGroups(allRacks, selectedSet) {
  const host = document.getElementById("rackList");
  host.innerHTML = "";

  if (!allRacks.length) {
    host.innerHTML = '<div class="loading">No racks found.</div>';
    return;
  }

  // group by section
  const groups = new Map();
  for (const r of allRacks) {
    const k = `${r.section_id}__${r.section_name}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }

  for (const [key, racks] of groups.entries()) {
    racks.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const [sid, sname] = key.split("__");

    const wrap = document.createElement("div");
    wrap.className = "rack-group";

    const head = document.createElement("div");
    head.className = "group-title";
    head.innerHTML = `<div>${escapeHtml(sname || "Section")} <small>(${racks.length})</small></div>`;

    const quick = document.createElement("button");
    quick.type = "button";
    quick.className = "btn";
    quick.style.padding = "8px 10px";
    quick.innerHTML = '<span class="material-symbols-rounded">done</span> Select section';
    quick.addEventListener("click", () => {
      racks.forEach((r) => selectedSet.add(r.id));
      syncChecks(selectedSet);
    });

    head.appendChild(quick);
    wrap.appendChild(head);

    racks.forEach((r) => {
      const row = document.createElement("label");
      row.className = "rack-item";
      row.innerHTML = `
        <input type="checkbox" data-rack-id="${r.id}">
        <div>${escapeHtml(r.name)}</div>
      `;
      wrap.appendChild(row);
    });

    host.appendChild(wrap);
  }

  syncChecks(selectedSet);
}

function syncChecks(selectedSet) {
  document.querySelectorAll('input[type="checkbox"][data-rack-id]').forEach((cb) => {
    const id = Number(cb.getAttribute("data-rack-id"));
    cb.checked = selectedSet.has(id);
    cb.onchange = () => {
      if (cb.checked) selectedSet.add(id);
      else selectedSet.delete(id);
    };
  });
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function main() {
  await loadConfig();

  // Load racks via sections endpoint (role-aware)
  const secRes = await authFetch(`${API_BASE}/api/sections`);
  const sections = await secRes.json();
  const allRacks = flattenRacksFromSections(Array.isArray(sections) ? sections : []);

  // Load user's current preferences
  const prefRes = await authFetch(`${API_BASE}/api/auth/me/preferred-racks`);
  const prefData = await prefRes.json();
  const selectedSet = new Set((prefData?.rack_ids || []).map(Number).filter((n) => Number.isFinite(n)));

  renderRackGroups(allRacks, selectedSet);

  // Buttons
  document.getElementById("btnSelectAll").addEventListener("click", () => {
    // select all racks currently rendered
    allRacks.forEach((r) => selectedSet.add(r.id));
    syncChecks(selectedSet);
  });

  document.getElementById("btnClearAll").addEventListener("click", () => {
    selectedSet.clear();
    syncChecks(selectedSet);
  });

  document.getElementById("btnSave").addEventListener("click", async () => {
    const ids = Array.from(selectedSet.values()).sort((a, b) => a - b);
    const res = await authFetch(`${API_BASE}/api/auth/me/preferred-racks`, {
      method: "PUT",
      body: JSON.stringify({ rack_ids: ids }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast("✅ Preferred racks saved", "success");
      // optional local cache for client-side filtering (fast)
      localStorage.setItem("preferred_rack_ids", JSON.stringify(data.rack_ids || ids));
    } else {
      showToast(data?.error || "Failed to save", "error");
    }
  });
}

main().catch((e) => {
  console.error(e);
  showToast("Failed to load settings", "error");
});