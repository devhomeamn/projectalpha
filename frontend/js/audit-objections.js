(function () {
  function escapeHtml(str = "") {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setNowDateTime() {
    const dEl = document.getElementById("currentDate");
    const tEl = document.getElementById("currentTime");
    if (!dEl || !tEl) return;

    const update = () => {
      const now = new Date();
      dEl.textContent = now.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
      tEl.textContent = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    };
    update();
    setInterval(update, 1000 * 10);
  }

  function getParams() {
    return new URLSearchParams(window.location.search);
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

  async function loadObjections() {
    showError("");
    syncUIFromUrl();

    const token = localStorage.getItem("token");
    if (!token) return (window.location.href = "login.html");

    const params = getParams();
    if (!params.get("page")) params.set("page", "1");
    if (!params.get("limit")) params.set("limit", "20");

    const tbody = document.getElementById("aoTableBody");
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Loading...</td></tr>`;

    let res, data;
    try {
      res = await fetch(`/api/records/audit-objections?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      data = await res.json();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Failed to load</td></tr>`;
      return showError("Network error. Please try again.");
    }

    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Failed to load</td></tr>`;
      return showError(data?.error || data?.message || "Failed to load list");
    }

    const items = data.items || [];
    const pg = data.pagination || {};
    const page = Number(pg.page || params.get("page") || 1);
    const limit = Number(pg.limit || params.get("limit") || 20);
    const total = Number(pg.total || 0);

    document.getElementById("aoPageInfo").textContent =
      `Page ${page} • Showing ${items.length} • Total ${total}`;

    document.getElementById("aoPrevBtn").disabled = page <= 1;
    document.getElementById("aoNextBtn").disabled = page * limit >= total;

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
        ? `<a class="ao-attach-btn" href="${escapeHtml(r.attachment_path)}" target="_blank" rel="noopener" data-tooltip="Attachment খুলুন">
             <span class="material-symbols-rounded">attach_file</span>
             Open
           </a>`
        : `<span class="ao-attach-none">—</span>`;

      const detailsRowId = `ao-details-${r.id}`;

      tbody.insertAdjacentHTML(
        "beforeend",
        `
        <tr class="ao-main-row" data-target="${detailsRowId}">
          <td><button class="ao-toggle" type="button" aria-label="Expand">▶</button></td>
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
                 data-tooltip="পুরো অবজেকশন দেখুন">
                <span class="material-symbols-rounded">visibility</span>
                </a>
              <a class="ao-action-btn"
                 href="/bd-objection-history.html?bd_no=${encodeURIComponent(r.bd_no || "")}"
                 data-tooltip="হিস্ট্রি ও পরিবর্তন দেখুন">
                <span class="material-symbols-rounded">history</span>
                 </a>
            </div>
          </td>
        </tr>

        <tr id="${detailsRowId}" class="ao-details-row" style="display:none;">
          <td colspan="10">
            <div class="ao-details-box">
              <div class="label">বিস্তারিত:</div>
              <div class="details">${escapeHtml(r.objection_details || "-")}</div>
            </div>
          </td>
        </tr>
        `
      );
    });
  }

  function bindEvents() {
    document.getElementById("aoSearchBtn").addEventListener("click", () => {
      applyFiltersToUrl(1);
      loadObjections();
    });

    document.getElementById("aoClearBtn").addEventListener("click", () => {
      window.location.href = "/audit-objections.html";
    });

    document.getElementById("aoSearchQ").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        applyFiltersToUrl(1);
        loadObjections();
      }
    });

    document.getElementById("aoPrevBtn").addEventListener("click", () => {
      const params = getParams();
      const page = Math.max(Number(params.get("page") || 1) - 1, 1);
      applyFiltersToUrl(page);
      loadObjections();
    });

    document.getElementById("aoNextBtn").addEventListener("click", () => {
      const params = getParams();
      const page = Number(params.get("page") || 1) + 1;
      applyFiltersToUrl(page);
      loadObjections();
    });

    // Expand / Collapse logic
    const tbody = document.getElementById("aoTableBody");
    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest(".ao-toggle");
      if (!btn) return;

      const mainRow = e.target.closest(".ao-main-row");
      if (!mainRow) return;

      const targetId = mainRow.getAttribute("data-target");
      const detailsRow = document.getElementById(targetId);
      if (!detailsRow) return;

      const isCurrentlyOpen = detailsRow.style.display !== "none";

      // সবগুলো বন্ধ করা + expanded class সরানো
      document.querySelectorAll(".ao-details-row").forEach((r) => {
        r.style.display = "none";
      });
      document.querySelectorAll(".ao-main-row").forEach((row) => {
        row.classList.remove("expanded");
      });
      document.querySelectorAll(".ao-toggle").forEach((b) => {
        b.textContent = "▶";
      });

      // যদি এটি আগে খোলা না থাকতো তাহলে খুলবো
      if (!isCurrentlyOpen) {
        detailsRow.style.display = "";
        mainRow.classList.add("expanded");
        btn.textContent = "▼";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setNowDateTime();
    bindEvents();
    const p = getParams();
    if (!p.get("page") || !p.get("limit")) {
      applyFiltersToUrl(Number(p.get("page") || 1));
    }
    loadObjections();
  });
})();