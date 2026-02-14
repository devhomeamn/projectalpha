(() => {
  const REPORT_DEFS = {
    section: {
      title: "Section Wise Records",
      subtitle: "Records grouped by section",
      icon: "format_list_bulleted",
      endpoint: "/reports/section-wise",
    },
    central: {
      title: "Central Records",
      subtitle: "Records moved to central room",
      icon: "domain",
      endpoint: "/reports/central",
    },
    movement: {
      title: "Movement History",
      subtitle: "Movement tracking timeline",
      icon: "local_shipping",
      endpoint: "/reports/movement-history",
    },
    user: {
      title: "User Activity",
      subtitle: "Activity summary by user",
      icon: "person",
      endpoint: "/reports/user-activity",
    },
    monthly: {
      title: "Monthly Summary",
      subtitle: "Month-wise created and moved count",
      icon: "calendar_month",
      endpoint: "/reports/monthly-summary",
    },
  };

  const state = {
    apiBase: "",
    configLoaded: false,
    currentType: "",
    search: "",
    currentTitle: "",
  };

  const ui = {};

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function logoutToLogin() {
    localStorage.clear();
    window.location.href = "login.html";
  }

  function debounce(fn, delay = 180) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  async function loadConfig() {
    if (state.configLoaded) return;
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      state.apiBase = data.apiBase ? `${data.apiBase}/api` : `${window.location.origin}/api`;
    } catch {
      state.apiBase = `${window.location.origin}/api`;
    } finally {
      state.configLoaded = true;
    }
  }

  async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = { ...(options.headers || {}) };

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401 || res.status === 403) {
      try {
        showConfirm({
          title: "Session Expired",
          message: "Your session has expired or you no longer have access.",
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

  function setFeedback(message, mode = "normal") {
    if (!ui.reportFeedback) return;
    ui.reportFeedback.classList.remove("is-error", "is-loading");
    if (mode === "error") ui.reportFeedback.classList.add("is-error");
    if (mode === "loading") ui.reportFeedback.classList.add("is-loading");
    ui.reportFeedback.textContent = message;
  }

  function setReportHeader(def) {
    ui.reportTitle.textContent = def?.title || "Select a report";
    ui.reportSubtitle.textContent = def?.subtitle || "Choose a report card to load analytics preview.";
  }

  function renderCards() {
    const cardsHtml = Object.entries(REPORT_DEFS)
      .map(([type, def]) => {
        const isActive = type === state.currentType;
        return `
          <button class="report-card ${isActive ? "is-active" : ""}" data-report-type="${type}" type="button">
            <span class="report-card__icon material-symbols-rounded" aria-hidden="true">${escapeHtml(def.icon)}</span>
            <span class="report-card__content">
              <span class="report-card__title">${escapeHtml(def.title)}</span>
              <span class="report-card__sub">${escapeHtml(def.subtitle)}</span>
            </span>
            <span class="report-card__chev material-symbols-rounded" aria-hidden="true">chevron_right</span>
          </button>
        `;
      })
      .join("");

    ui.reportCards.innerHTML = cardsHtml;
  }

  function renderQuickSelect() {
    const options = Object.entries(REPORT_DEFS)
      .map(([type, def]) => `<option value="${type}">${escapeHtml(def.title)}</option>`)
      .join("");

    ui.quickReportSelect.innerHTML = options;
    ui.quickReportSelect.value = state.currentType || "section";
  }

  function normalizeArray(data) {
    return Array.isArray(data) ? data : [];
  }

  function tableHTML(records, options = {}) {
    const {
      showLocation = false,
      showMovedMeta = false,
      showPrevious = false,
    } = options;

    const list = normalizeArray(records);
    if (!list.length) return '<p class="report-empty">No records found.</p>';

    const rows = list
      .map((r, idx) => {
        const movedAt = r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "-";
        const prevLoc = `${r.previous_location?.section_name || "-"} / ${r.previous_location?.subcategory_name || "-"} / ${r.previous_location?.rack_name || "-"}`;

        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(r.file_name || "-")}</td>
            <td>${escapeHtml(r.bd_no || "-")}</td>
            ${showLocation ? `<td>${escapeHtml(r.Section?.name || "-")}</td>` : ""}
            ${showLocation ? `<td>${escapeHtml(r.Subcategory?.name || "-")}</td>` : ""}
            ${showLocation ? `<td>${escapeHtml(r.Rack?.name || "-")}</td>` : ""}
            <td>${escapeHtml(r.serial_no ?? "-")}</td>
            ${showMovedMeta ? `<td>${escapeHtml(r.moved_by || "-")}</td>` : ""}
            ${showMovedMeta ? `<td>${escapeHtml(movedAt)}</td>` : ""}
            ${showPrevious ? `<td>${escapeHtml(prevLoc)}</td>` : ""}
          </tr>
        `;
      })
      .join("");

    return `
      <table class="report-table">
        <thead>
          <tr>
            <th>SL</th>
            <th>File</th>
            <th>BD No</th>
            ${showLocation ? "<th>Section</th><th>Subcategory</th><th>Rack</th>" : ""}
            <th>Serial</th>
            ${showMovedMeta ? "<th>Moved By</th><th>Moved At</th>" : ""}
            ${showPrevious ? "<th>Previous Location</th>" : ""}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderSectionReport(data) {
    const source = data && typeof data === "object" ? data : {};
    const blocks = Object.keys(source).map((sectionName) => {
      const section = source[sectionName] || {};
      const count = Number(section.count || 0);
      return `
        <section class="report-block">
          <h4>${escapeHtml(sectionName)} (Total: ${count})</h4>
          ${tableHTML(section.items, { showLocation: true })}
        </section>
      `;
    });
    return blocks.length ? blocks.join("") : '<p class="report-empty">No section data found.</p>';
  }

  function renderUserReport(data) {
    const added = normalizeArray(data?.added);
    const moved = normalizeArray(data?.moved);

    const addedRows = added
      .map((item) => {
        const user = item.added_by || item.dataValues?.added_by || "Unknown";
        const total = Number(item.total_added ?? item.dataValues?.total_added ?? item.count ?? item.total ?? 0);
        return `<tr><td>${escapeHtml(user)}</td><td>${total}</td></tr>`;
      })
      .join("");

    const movedRows = moved
      .map((item) => {
        const user = item.moved_by || item.dataValues?.moved_by || "Unknown";
        const total = Number(item.total_moved ?? item.dataValues?.total_moved ?? item.count ?? item.total ?? 0);
        return `<tr><td>${escapeHtml(user)}</td><td>${total}</td></tr>`;
      })
      .join("");

    return `
      <section class="report-block">
        <h4>Added By Summary</h4>
        <table class="report-table">
          <thead><tr><th>User</th><th>Total Added</th></tr></thead>
          <tbody>${addedRows || '<tr><td colspan="2">No data</td></tr>'}</tbody>
        </table>
      </section>
      <section class="report-block">
        <h4>Moved By Summary</h4>
        <table class="report-table">
          <thead><tr><th>User</th><th>Total Moved</th></tr></thead>
          <tbody>${movedRows || '<tr><td colspan="2">No data</td></tr>'}</tbody>
        </table>
      </section>
    `;
  }

  function renderMonthlyReport(data) {
    const created = normalizeArray(data?.createdByMonth);
    const moved = normalizeArray(data?.movedByMonth);

    const map = new Map();

    created.forEach((item) => {
      const month = item.month || item.Month || item.created_month;
      const total = Number(item.total_created ?? item.total_added ?? item.created_count ?? item.count ?? item.total ?? 0);
      if (!month) return;
      map.set(month, { month, total_created: total, total_moved: 0 });
    });

    moved.forEach((item) => {
      const month = item.month || item.Month || item.moved_month;
      const total = Number(item.total_moved_central ?? item.total_moved ?? item.total_central ?? item.moved_count ?? item.count ?? item.total ?? 0);
      if (!month) return;

      if (!map.has(month)) {
        map.set(month, { month, total_created: 0, total_moved: total });
      } else {
        map.get(month).total_moved = total;
      }
    });

    const rows = [...map.values()].sort((a, b) => String(a.month).localeCompare(String(b.month)));

    if (!rows.length) return '<p class="report-empty">No monthly data found.</p>';

    return `
      <section class="report-block">
        <h4>Monthly Summary</h4>
        <table class="report-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Total Created</th>
              <th>Total Moved to Central</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => `
                <tr>
                  <td>${escapeHtml(row.month)}</td>
                  <td>${row.total_created}</td>
                  <td>${row.total_moved}</td>
                </tr>
              `)
              .join("")}
          </tbody>
        </table>
      </section>
    `;
  }

  const renderers = {
    section: (data) => renderSectionReport(data),
    central: (data) => tableHTML(data, { showLocation: true, showMovedMeta: true }),
    movement: (data) => tableHTML(data, { showLocation: true, showMovedMeta: true, showPrevious: true }),
    user: (data) => renderUserReport(data),
    monthly: (data) => renderMonthlyReport(data),
  };

  async function loadReport(type) {
    const def = REPORT_DEFS[type];
    if (!def) return;

    state.currentType = type;
    state.currentTitle = def.title;

    setReportHeader(def);
    renderCards();
    ui.quickReportSelect.value = type;

    ui.reportActions.hidden = true;
    ui.reportPrintArea.innerHTML = "";
    setFeedback("Loading report...", "loading");

    try {
      await loadConfig();
      const res = await authFetch(`${state.apiBase}${def.endpoint}`);
      const data = await res.json();

      const renderer = renderers[type];
      ui.reportPrintArea.innerHTML = renderer ? renderer(data) : '<p class="report-empty">No renderer found.</p>';

      ui.reportActions.hidden = false;
      setFeedback(`Showing ${def.title}.`, "normal");
      applySearchFilter();
    } catch (err) {
      console.error("Report load error:", err);
      setFeedback("Failed to load report.", "error");
      ui.reportPrintArea.innerHTML = "";
      ui.reportActions.hidden = true;
    }
  }

  function applySearchFilter() {
    const keyword = (state.search || "").toLowerCase().trim();
    const rows = ui.reportPrintArea.querySelectorAll("table tbody tr");

    if (!rows.length) return;

    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.style.display = !keyword || text.includes(keyword) ? "" : "none";
    });
  }

  function downloadPDF() {
    if (!ui.reportPrintArea || !ui.reportPrintArea.innerHTML.trim()) return;

    const safeTitle = (state.currentTitle || "report")
      .replace(/\s+/g, "_")
      .toLowerCase();

    const options = {
      margin: 0.4,
      filename: `${safeTitle}_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
    };

    html2pdf().set(options).from(ui.reportPrintArea).save();
  }

  function bindEvents() {
    ui.reportCards.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-report-type]");
      if (!btn) return;
      loadReport(btn.getAttribute("data-report-type"));
    });

    ui.quickReportSelect.addEventListener("change", () => {
      loadReport(ui.quickReportSelect.value);
    });

    ui.refreshReportBtn.addEventListener("click", () => {
      if (state.currentType) {
        loadReport(state.currentType);
      } else {
        loadReport(ui.quickReportSelect.value);
      }
    });

    ui.clearSearchBtn.addEventListener("click", () => {
      state.search = "";
      ui.reportSearchInput.value = "";
      applySearchFilter();
    });

    ui.reportSearchInput.addEventListener(
      "input",
      debounce(() => {
        state.search = ui.reportSearchInput.value;
        applySearchFilter();
      }, 120)
    );

    ui.downloadPdfBtn.addEventListener("click", downloadPDF);
  }

  function initDomRefs() {
    ui.reportCards = document.getElementById("reportCards");
    ui.quickReportSelect = document.getElementById("quickReportSelect");
    ui.reportSearchInput = document.getElementById("reportSearchInput");
    ui.refreshReportBtn = document.getElementById("refreshReportBtn");
    ui.clearSearchBtn = document.getElementById("clearSearchBtn");
    ui.reportTitle = document.getElementById("reportTitle");
    ui.reportSubtitle = document.getElementById("reportSubtitle");
    ui.reportActions = document.getElementById("reportActions");
    ui.downloadPdfBtn = document.getElementById("downloadPdfBtn");
    ui.reportFeedback = document.getElementById("reportFeedback");
    ui.reportPrintArea = document.getElementById("reportPrintArea");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    initDomRefs();
    renderQuickSelect();
    renderCards();
    bindEvents();
    await loadConfig();
    loadReport("section");
  });
})();
