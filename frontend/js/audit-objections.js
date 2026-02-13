(function () {
  let ACCESS_OK = false;

  function escapeHtml(str = "") {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeSectionName(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[\/\-_]/g, "");
  }

  function setNowDateTime() {
    const dEl = document.getElementById("currentDate");
    const tEl = document.getElementById("currentTime");
    if (!dEl || !tEl) return;

    const update = () => {
      const now = new Date();
      dEl.textContent = now.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
      tEl.textContent = now.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    };
    update();
    setInterval(update, 1000 * 10);
  }

  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function showAccessNote(msg) {
    const el = document.getElementById("aoAccessNote");
    if (!el) return;
    if (!msg) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }
    el.style.display = "";
    el.textContent = msg;
  }

  function showError(msg) {
    const el = document.getElementById("aoError");
    if (!el) return;
    if (!msg) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }
    el.style.display = "";
    el.textContent = msg;
  }

  function syncUIFromUrl() {
    const params = getParams();
    document.getElementById("aoStatus").value = params.get("status") || "";
    document.getElementById("aoBdNo").value = params.get("bd_no") || "";
    document.getElementById("aoSearchQ").value = params.get("q") || "";
  }

  function applyFiltersToUrl(page = 1) {
    const status = document.getElementById("aoStatus").value.trim();
    const bdNo = document.getElementById("aoBdNo").value.trim();
    const q = document.getElementById("aoSearchQ").value.trim();

    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (bdNo) params.set("bd_no", bdNo);
    if (q) params.set("q", q);

    params.set("page", String(page));
    params.set("limit", "20");

    history.replaceState(null, "", `/audit-objections.html?${params.toString()}`);
    return params;
  }

  function setSummary(items = []) {
    const counts = { open: 0, requested: 0, cleared: 0 };
    items.forEach((x) => {
      const key = String(x?.ao_status || "").toLowerCase();
      if (key in counts) counts[key] += 1;
    });

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };

    setText("aoCountOpen", counts.open);
    setText("aoCountRequested", counts.requested);
    setText("aoCountCleared", counts.cleared);
    setText("aoCountPage", items.length);
  }

  async function ensureLALAOAccess() {
    const token = getToken();
    if (!token) {
      window.location.href = "login.html";
      return false;
    }

    try {
      const meRes = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const meData = await meRes.json().catch(() => ({}));
      if (!meRes.ok) throw new Error(meData?.message || "Unauthorized");

      const role = String(meData?.user?.role || "").toLowerCase();
      if (role === "admin") {
        showAccessNote("Admins can review and approve only from Clearance Approvals.");
        setTimeout(() => {
          window.location.href = "ao-clearance-requests.html";
        }, 650);
        return false;
      }
      if (role !== "general") {
        showAccessNote("Only LA/LAO section users can access this module.");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 900);
        return false;
      }

      const userSectionId = Number(meData?.user?.section_id || 0);
      if (!userSectionId) {
        showAccessNote("Your account is not assigned to a section.");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 900);
        return false;
      }

      let lalaoSectionId = Number(localStorage.getItem("lalao_section_id") || 0);
      if (!lalaoSectionId) {
        const secRes = await fetch("/api/sections", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const secData = await secRes.json().catch(() => []);
        if (!secRes.ok) throw new Error("Failed to load sections");

        const rows = secData?.sections || secData?.data || secData || [];
        const found = Array.isArray(rows)
          ? rows.find((row) => normalizeSectionName(row?.name) === "lalao")
          : null;

        lalaoSectionId = Number(found?.id || 0);
        if (lalaoSectionId) {
          localStorage.setItem("lalao_section_id", String(lalaoSectionId));
        }
      }

      if (!lalaoSectionId || userSectionId !== lalaoSectionId) {
        showAccessNote("Only LA/LAO section users can access this module.");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 900);
        return false;
      }

      showAccessNote("");
      return true;
    } catch (err) {
      showAccessNote(err.message || "Access check failed.");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 900);
      return false;
    }
  }

  async function loadObjections() {
    if (!ACCESS_OK) return;

    showError("");
    syncUIFromUrl();

    const token = getToken();
    if (!token) {
      window.location.href = "login.html";
      return;
    }

    const params = getParams();
    if (!params.get("page")) params.set("page", "1");
    if (!params.get("limit")) params.set("limit", "20");

    const tbody = document.getElementById("aoTableBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Loading...</td></tr>`;

    let res;
    let data;
    try {
      res = await fetch(`/api/records/audit-objections?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      data = await res.json().catch(() => ({}));
    } catch (_e) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Failed to load</td></tr>`;
      setSummary([]);
      showError("Network error. Please try again.");
      return;
    }

    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Failed to load</td></tr>`;
      setSummary([]);
      showError(data?.error || data?.message || "Failed to load list");
      return;
    }

    const items = data.items || [];
    const pg = data.pagination || {};
    const page = Number(pg.page || params.get("page") || 1);
    const limit = Number(pg.limit || params.get("limit") || 20);
    const total = Number(pg.total || 0);

    const pageInfo = document.getElementById("aoPageInfo");
    if (pageInfo) {
      pageInfo.textContent = `Page ${page} | Showing ${items.length} | Total ${total}`;
    }

    const prevBtn = document.getElementById("aoPrevBtn");
    const nextBtn = document.getElementById("aoNextBtn");
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page * limit >= total;

    setSummary(items);

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;">No objections found</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    items.forEach((r) => {
      const section = r.Section?.name || "-";
      const sub = r.Subcategory?.name || "-";
      const rack = r.Rack?.name || "-";
      const location = `${escapeHtml(section)} / ${escapeHtml(sub)} / ${escapeHtml(rack)}`;

      const attachment = r.attachment_path
        ? `<a class="ao-attach-btn" href="${escapeHtml(r.attachment_path)}" target="_blank" rel="noopener" data-tooltip="Open attachment">
             <span class="material-symbols-rounded">attach_file</span>
             Open
           </a>`
        : `<span class="ao-attach-none">-</span>`;

      const detailsRowId = `ao-details-${r.id}`;

      tbody.insertAdjacentHTML(
        "beforeend",
        `
        <tr class="ao-main-row" data-target="${detailsRowId}">
          <td><button class="ao-toggle" type="button" aria-label="Expand">></button></td>
          <td>${escapeHtml(r.bd_no || "-")}</td>
          <td>${escapeHtml(String(r.serial_no ?? "-"))}</td>
          <td>${escapeHtml(r.file_name || "-")}</td>
          <td>${escapeHtml(r.objection_no || "-")}</td>
          <td>${escapeHtml(r.objection_title || "-")}</td>
          <td>${location}</td>
          <td>
            <span class="ao-status ${escapeHtml((r.ao_status || "").toLowerCase())}">
              ${escapeHtml(r.ao_status || "-")}
            </span>
          </td>
          <td>${attachment}</td>
          <td>
            <div class="ao-actions">
              <a class="ao-action-btn primary"
                 href="/view-record.html?id=${encodeURIComponent(r.id)}"
                 data-tooltip="Open record">
                <span class="material-symbols-rounded">visibility</span>
              </a>
              <a class="ao-action-btn"
                 href="/bd-objection-history.html?bd_no=${encodeURIComponent(r.bd_no || "")}"
                 data-tooltip="Open BD history">
                <span class="material-symbols-rounded">history</span>
              </a>
            </div>
          </td>
        </tr>

        <tr id="${detailsRowId}" class="ao-details-row" style="display:none;">
          <td colspan="10">
            <div class="ao-details-box">
              <div class="label">Details:</div>
              <div class="details">${escapeHtml(r.objection_details || "-")}</div>
            </div>
          </td>
        </tr>
        `
      );
    });
  }

  function bindEvents() {
    document.getElementById("aoSearchBtn")?.addEventListener("click", () => {
      if (!ACCESS_OK) return;
      applyFiltersToUrl(1);
      loadObjections();
    });

    document.getElementById("aoClearBtn")?.addEventListener("click", () => {
      if (!ACCESS_OK) return;
      window.location.href = "/audit-objections.html";
    });

    document.getElementById("aoSearchQ")?.addEventListener("keydown", (e) => {
      if (!ACCESS_OK) return;
      if (e.key === "Enter") {
        applyFiltersToUrl(1);
        loadObjections();
      }
    });

    document.getElementById("aoPrevBtn")?.addEventListener("click", () => {
      if (!ACCESS_OK) return;
      const params = getParams();
      const page = Math.max(Number(params.get("page") || 1) - 1, 1);
      applyFiltersToUrl(page);
      loadObjections();
    });

    document.getElementById("aoNextBtn")?.addEventListener("click", () => {
      if (!ACCESS_OK) return;
      const params = getParams();
      const page = Number(params.get("page") || 1) + 1;
      applyFiltersToUrl(page);
      loadObjections();
    });

    const tbody = document.getElementById("aoTableBody");
    tbody?.addEventListener("click", (e) => {
      const btn = e.target.closest(".ao-toggle");
      if (!btn) return;

      const mainRow = e.target.closest(".ao-main-row");
      if (!mainRow) return;

      const targetId = mainRow.getAttribute("data-target");
      const detailsRow = document.getElementById(targetId);
      if (!detailsRow) return;

      const isCurrentlyOpen = detailsRow.style.display !== "none";

      document.querySelectorAll(".ao-details-row").forEach((r) => {
        r.style.display = "none";
      });
      document.querySelectorAll(".ao-main-row").forEach((row) => {
        row.classList.remove("expanded");
      });
      document.querySelectorAll(".ao-toggle").forEach((toggleBtn) => {
        toggleBtn.textContent = ">";
      });

      if (!isCurrentlyOpen) {
        detailsRow.style.display = "";
        mainRow.classList.add("expanded");
        btn.textContent = "v";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    setNowDateTime();
    bindEvents();

    ACCESS_OK = await ensureLALAOAccess();
    if (!ACCESS_OK) return;

    const p = getParams();
    if (!p.get("page") || !p.get("limit")) {
      applyFiltersToUrl(Number(p.get("page") || 1));
    }

    loadObjections();
  });
})();
