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
    user_completion: {
      title: "User Completion",
      subtitle: "Completed vs ongoing by user",
      icon: "task_alt",
      endpoint: "/reports/user-completion",
    },
    monthly: {
      title: "Monthly Summary",
      subtitle: "Month-wise created and moved count",
      icon: "calendar_month",
      endpoint: "/reports/monthly-summary",
    },
    cheque: {
      title: "Cheque Register",
      subtitle: "Cheque entry list and status summary",
      icon: "receipt_long",
      endpoint: "/reports/cheque-register",
    },
  };

  const state = {
    apiBase: "",
    configLoaded: false,
    currentType: "",
    currentTitle: "",
    search: "",
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

  function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function logoutToLogin() {
    localStorage.clear();
    window.location.href = "login.html";
  }

  function debounce(fn, delay = 180) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function formatDate(value) {
    if (!value) return "-";
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? text.slice(0, 10) : d.toLocaleDateString();
  }

  function formatMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  async function loadConfig() {
    if (state.configLoaded) return;
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      const rawBase = (data?.apiBase || "").trim();
      if (!rawBase) {
        state.apiBase = `${window.location.origin}/api`;
      } else if (rawBase.endsWith("/api")) {
        state.apiBase = rawBase;
      } else {
        state.apiBase = `${rawBase.replace(/\/+$/, "")}/api`;
      }
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
      logoutToLogin();
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
    if (ui.reportTitle) ui.reportTitle.textContent = def?.title || "Select a report";
    if (ui.reportSubtitle) {
      ui.reportSubtitle.textContent = def?.subtitle || "Choose a report card to load analytics preview.";
    }
  }

  function renderCards() {
    if (!ui.reportCards) return;
    ui.reportCards.innerHTML = Object.entries(REPORT_DEFS)
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
  }

  function renderQuickSelect() {
    if (!ui.quickReportSelect) return;
    ui.quickReportSelect.innerHTML = Object.entries(REPORT_DEFS)
      .map(([type, def]) => `<option value="${type}">${escapeHtml(def.title)}</option>`)
      .join("");
    ui.quickReportSelect.value = state.currentType || "section";
  }

  function tableHTML(records, options = {}) {
    const list = normalizeArray(records);
    const { showLocation = false, showMovedMeta = false, showPrevious = false } = options;
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
      return `
        <section class="report-block">
          <h4>${escapeHtml(sectionName)} (Total: ${Number(section.count || 0)})</h4>
          ${tableHTML(section.items, { showLocation: true })}
        </section>
      `;
    });
    return blocks.length ? blocks.join("") : '<p class="report-empty">No section data found.</p>';
  }

  function renderUserReport(data) {
    const addedRows = normalizeArray(data?.added)
      .map((item) => {
        const user = item.added_by || item.dataValues?.added_by || "Unknown";
        const total = Number(item.total_added ?? item.dataValues?.total_added ?? item.count ?? 0);
        return `<tr><td>${escapeHtml(user)}</td><td>${total}</td></tr>`;
      })
      .join("");

    const movedRows = normalizeArray(data?.moved)
      .map((item) => {
        const user = item.moved_by || item.dataValues?.moved_by || "Unknown";
        const total = Number(item.total_moved ?? item.dataValues?.total_moved ?? item.count ?? 0);
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
    const map = new Map();

    normalizeArray(data?.createdByMonth).forEach((item) => {
      const month = item.month || item.Month || item.created_month;
      const total = Number(item.total_created ?? item.total_added ?? item.created_count ?? item.count ?? 0);
      if (!month) return;
      map.set(month, { month, total_created: total, total_moved: 0 });
    });

    normalizeArray(data?.movedByMonth).forEach((item) => {
      const month = item.month || item.Month || item.moved_month;
      const total = Number(item.total_moved_central ?? item.total_moved ?? item.moved_count ?? item.count ?? 0);
      if (!month) return;
      if (!map.has(month)) map.set(month, { month, total_created: 0, total_moved: total });
      else map.get(month).total_moved = total;
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
              .map(
                (row) => `
                  <tr>
                    <td>${escapeHtml(row.month)}</td>
                    <td>${row.total_created}</td>
                    <td>${row.total_moved}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </section>
    `;
  }

  function renderUserCompletionReport(data) {
    const rows = normalizeArray(data?.rows || data);
    const summary = data?.summary || {};

    const totalUsers = Number(summary.total_users ?? rows.length ?? 0);
    const totalCompleted = Number(
      summary.total_completed ?? rows.reduce((sum, r) => sum + (Number(r.completed_count) || 0), 0)
    );
    const totalOngoing = Number(
      summary.total_ongoing ?? rows.reduce((sum, r) => sum + (Number(r.ongoing_count) || 0), 0)
    );
    const totalRecords = Number(
      summary.total_records ?? rows.reduce((sum, r) => sum + (Number(r.total_count) || 0), 0)
    );

    const bodyRows = rows
      .map((row, idx) => {
        const completed = Number(row.completed_count || 0);
        const ongoing = Number(row.ongoing_count || 0);
        const total = Number(row.total_count || 0);
        const rate = Number(row.completion_rate ?? (total ? (completed / total) * 100 : 0));

        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(row.user_name || "-")}</td>
            <td>${completed}</td>
            <td>${ongoing}</td>
            <td>${total}</td>
            <td>${Number.isFinite(rate) ? rate.toFixed(2) : "0.00"}%</td>
          </tr>
        `;
      })
      .join("");

      return `
      <section class="report-block">
        <h4>User Completion Summary</h4>
        <table class="report-table">
          <thead>
            <tr>
              <th>Total Users</th>
              <th>Total Completed</th>
              <th>Total Ongoing</th>
              <th>Total Records</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${totalUsers}</td>
              <td>${totalCompleted}</td>
              <td>${totalOngoing}</td>
              <td>${totalRecords}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="report-block">
        <h4>User Wise Completed vs Ongoing</h4>
        <table class="report-table">
          <thead>
            <tr>
              <th>SL</th>
              <th>User</th>
              <th>Completed</th>
              <th>Ongoing</th>
              <th>Total</th>
              <th>Completion %</th>
            </tr>
          </thead>
          <tbody>${bodyRows || '<tr><td colspan="6">No user data found.</td></tr>'}</tbody>
        </table>
      </section>
    `;
  }

  function renderChequeReport(data) {
    const entries = normalizeArray(data?.entries);

    const summary = {
      total_entries: Number(data?.summary?.total_entries ?? entries.length),
      total_amount: Number(
        data?.summary?.total_amount ??
          entries.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
      ),
      received: Number(data?.summary?.received ?? entries.filter((x) => x.status === "received").length),
      processing: Number(
        data?.summary?.processing ?? entries.filter((x) => x.status === "processing").length
      ),
      returned: Number(data?.summary?.returned ?? entries.filter((x) => x.status === "returned").length),
    };

    const rows = entries
      .map(
        (entry, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(entry.entry_no ?? "-")}</td>
            <td>${escapeHtml(entry.bill_ref_no || "-")}</td>
            <td>${escapeHtml(entry.origin_section_name || "-")}</td>
            <td>${escapeHtml(formatDate(entry.received_date))}</td>
            <td>${escapeHtml(entry.token_no || "-")}</td>
            <td>${escapeHtml(formatMoney(entry.amount))}</td>
            <td>${escapeHtml(entry.status || "-")}</td>
            <td>${escapeHtml(formatDate(entry.returned_date))}</td>
            <td>${escapeHtml(entry.created_by_name || "-")}</td>
          </tr>
        `
      )
      .join("");

    return `
      <section class="report-block">
        <h4>Cheque Summary</h4>
        <table class="report-table">
          <thead>
            <tr>
              <th>Total Entries</th>
              <th>Total Amount</th>
              <th>Received</th>
              <th>Processing</th>
              <th>Returned</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${summary.total_entries}</td>
              <td>${escapeHtml(formatMoney(summary.total_amount))}</td>
              <td>${summary.received}</td>
              <td>${summary.processing}</td>
              <td>${summary.returned}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section class="report-block">
        <h4>Cheque Register Entries</h4>
        <table class="report-table">
          <thead>
            <tr>
              <th>SL</th>
              <th>Entry No</th>
              <th>Bill Ref</th>
              <th>Origin</th>
              <th>Received Date</th>
              <th>Token No</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Returned Date</th>
              <th>Added By</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="10">No cheque entries found.</td></tr>'}</tbody>
        </table>
      </section>
    `;
  }

  const renderers = {
    section: (data) => renderSectionReport(data),
    central: (data) => tableHTML(data, { showLocation: true, showMovedMeta: true }),
    movement: (data) => tableHTML(data, { showLocation: true, showMovedMeta: true, showPrevious: true }),
    user: (data) => renderUserReport(data),
    user_completion: (data) => renderUserCompletionReport(data),
    monthly: (data) => renderMonthlyReport(data),
    cheque: (data) => renderChequeReport(data),
  };

  async function loadReport(type) {
    const def = REPORT_DEFS[type];
    if (!def || !ui.reportPrintArea) return;

    state.currentType = type;
    state.currentTitle = def.title;
    setReportHeader(def);
    renderCards();
    if (ui.quickReportSelect) ui.quickReportSelect.value = type;

    if (ui.reportActions) ui.reportActions.hidden = true;
    ui.reportPrintArea.innerHTML = "";
    setFeedback("Loading report...", "loading");

    try {
      await loadConfig();
      const res = await authFetch(`${state.apiBase}${def.endpoint}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || data?.error || `Failed (${res.status})`);
      }

      const renderer = renderers[type];
      ui.reportPrintArea.innerHTML = renderer ? renderer(data) : '<p class="report-empty">No renderer found.</p>';
      if (ui.reportActions) ui.reportActions.hidden = false;
      setFeedback(`Showing ${def.title}.`, "normal");
      applySearchFilter();
    } catch (err) {
      console.error("Report load error:", err);
      setFeedback(err.message || "Failed to load report.", "error");
      ui.reportPrintArea.innerHTML = "";
      if (ui.reportActions) ui.reportActions.hidden = true;
    }
  }

  function applySearchFilter() {
    if (!ui.reportPrintArea) return;
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
    if (typeof html2pdf === "undefined") {
      setFeedback("PDF library missing. Please reload page.", "error");
      return;
    }

    const safeTitle = (state.currentTitle || "report").replace(/\s+/g, "_").toLowerCase();
    const maxColumns = [...ui.reportPrintArea.querySelectorAll("table thead tr")]
      .map((row) => row.querySelectorAll("th").length)
      .reduce((max, count) => Math.max(max, count), 0);
    const orientation = maxColumns >= 6 ? "landscape" : "portrait";
    const generatedAt = new Date().toLocaleString();
    const wideTable = maxColumns >= 9;

    const exportNode = ui.reportPrintArea.cloneNode(true);
    exportNode.style.border = "0";
    exportNode.style.padding = "0";
    exportNode.style.background = "#fff";
    exportNode.style.overflow = "visible";

    const exportStyle = document.createElement("style");
    exportStyle.textContent = `
      .report-block{
        page-break-inside: avoid;
        break-inside: avoid;
        margin-bottom: 10px;
      }
      .report-table{
        width: 100% !important;
        border-collapse: collapse !important;
        table-layout: auto !important;
      }
      .report-table thead{
        display: table-header-group;
      }
      .report-table tr{
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .report-table th,
      .report-table td{
        white-space: normal !important;
        word-break: break-word !important;
        overflow-wrap: anywhere !important;
        padding: ${wideTable ? "4px" : "6px"} !important;
        font-size: ${wideTable ? "9px" : "10px"} !important;
        line-height: 1.25 !important;
      }
    `;

    const header = document.createElement("div");
    header.innerHTML = `
      <h2 style="margin:0 0 4px;font-size:20px;color:#111827;">${escapeHtml(state.currentTitle || "Report")}</h2>
      <p style="margin:0 0 10px;font-size:12px;color:#64748b;">Generated: ${escapeHtml(generatedAt)}</p>
    `;
    exportNode.prepend(header);
    exportNode.prepend(exportStyle);

    // html2canvas/jsPDF edge clipping এড়াতে wrapper gutter + explicit canvas size
    const exportWrap = document.createElement("div");
    exportWrap.style.background = "#fff";
    exportWrap.style.padding = orientation === "landscape" ? "12px 18px 12px 42px" : "12px 16px 12px 36px";
    exportWrap.style.boxSizing = "border-box";
    exportWrap.style.width = "100%";
    exportWrap.style.transform = "none";
    exportWrap.appendChild(exportNode);

    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.left = "-20000px";
    host.style.top = "0";
    host.style.opacity = "1";
    host.style.pointerEvents = "none";
    host.style.zIndex = "-1";
    host.style.width = orientation === "landscape" ? "1320px" : "980px";
    host.style.maxWidth = "none";
    host.style.overflow = "visible";
    host.style.background = "#fff";
    host.appendChild(exportWrap);
    document.body.appendChild(host);

    const renderWidth = Math.ceil(exportWrap.scrollWidth);
    const renderHeight = Math.ceil(exportWrap.scrollHeight);

    const options = {
      margin: [0.28, 0.35, 0.28, 0.35],
      filename: `${safeTitle}_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        width: renderWidth,
        height: renderHeight,
        windowWidth: renderWidth,
        windowHeight: renderHeight,
        x: 0,
        y: 0,
        letterRendering: true,
        backgroundColor: "#ffffff",
      },
      jsPDF: { unit: "in", format: "a4", orientation },
      pagebreak: {
        mode: ["css", "legacy"],
        avoid: ["tr", "thead", "tbody", "table", ".report-block"],
      },
    };

    setFeedback("Preparing PDF...", "loading");

    html2pdf()
      .set(options)
      .from(exportWrap)
      .save()
      .then(() => setFeedback(`Showing ${state.currentTitle || "report"}.`, "normal"))
      .catch((err) => {
        console.error("PDF export error:", err);
        setFeedback("PDF export failed.", "error");
      })
      .finally(() => host.remove());
  }

  function bindEvents() {
    if (ui.reportCards) {
      ui.reportCards.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-report-type]");
        if (!btn) return;
        loadReport(btn.getAttribute("data-report-type"));
      });
    }

    if (ui.quickReportSelect) {
      ui.quickReportSelect.addEventListener("change", () => loadReport(ui.quickReportSelect.value));
    }

    if (ui.refreshReportBtn) {
      ui.refreshReportBtn.addEventListener("click", () => {
        loadReport(state.currentType || ui.quickReportSelect?.value || "section");
      });
    }

    if (ui.clearSearchBtn) {
      ui.clearSearchBtn.addEventListener("click", () => {
        state.search = "";
        if (ui.reportSearchInput) ui.reportSearchInput.value = "";
        applySearchFilter();
      });
    }

    if (ui.reportSearchInput) {
      ui.reportSearchInput.addEventListener(
        "input",
        debounce(() => {
          state.search = ui.reportSearchInput.value;
          applySearchFilter();
        }, 120)
      );
    }

    if (ui.downloadPdfBtn) {
      ui.downloadPdfBtn.addEventListener("click", downloadPDF);
    }
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
    if (!ui.reportPrintArea) return;
    renderQuickSelect();
    renderCards();
    bindEvents();
    await loadConfig();
    loadReport("section");
  });
})();
