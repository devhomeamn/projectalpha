(function () {
  "use strict";

  let API_BASE = "/api";
  const state = {
    sections: [],
    sectionMap: new Map(),
    recordSectionId: null,
    officeOptions: [],
    forwardTargets: [],
    page: 1,
    limit: 20,
    total: 0,
    rows: [],
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function getRole() {
    return String(localStorage.getItem("role") || "").toLowerCase();
  }

  function getUserSectionId() {
    const sid = Number(localStorage.getItem("section_id") || 0);
    return Number.isFinite(sid) && sid > 0 ? sid : null;
  }

  function isAdminOrMaster() {
    const role = getRole();
    return role === "admin" || role === "master";
  }

  function normalizeName(value) {
    return String(value || "").trim().toLowerCase();
  }

  function detectRecordSectionId(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const mapped = list.map((s) => ({ id: Number(s?.id), n: normalizeName(s?.name) }));
    const exact = mapped.find((x) => Number.isFinite(x.id) && x.id > 0 && x.n === "record section");
    if (exact) return exact.id;
    const partial = mapped.find((x) => Number.isFinite(x.id) && x.id > 0 && x.n.includes("record"));
    if (partial) return partial.id;
    return null;
  }

  function canCreateRecordEntry() {
    const userSectionId = getUserSectionId();
    const recordSectionId = Number(state.recordSectionId || 0);
    if (!userSectionId || !recordSectionId) return false;
    return Number(userSectionId) === Number(recordSectionId);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseJsonSafe(raw, fallback = null) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function toLocalISODate(date) {
    const d = date instanceof Date ? date : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function formatDate(value) {
    if (!value) return "-";
    return String(value).slice(0, 10);
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  }

  function parseForwardKey(raw) {
    const text = String(raw || "").trim().toLowerCase();
    const m = text.match(/^(section|custom):(\d+)$/);
    if (!m) return null;
    return { type: m[1], id: Number(m[2]) };
  }

  function parseDateOnly(value) {
    const text = String(value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    return text;
  }

  function sectionNameById(id) {
    const key = Number(id);
    if (!Number.isFinite(key)) return "-";
    return state.sectionMap.get(key) || `#${key}`;
  }

  async function initApiBase() {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      const raw = String(data?.apiBase || "").trim();
      if (!raw) {
        API_BASE = "/api";
      } else if (raw.endsWith("/api")) {
        API_BASE = raw;
      } else {
        API_BASE = `${raw.replace(/\/+$/, "")}/api`;
      }
    } catch {
      API_BASE = "/api";
    }
  }

  async function authFetch(path, options = {}) {
    const token = getToken();
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    };

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }

    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      localStorage.clear();
      window.location.href = "login.html";
      throw new Error("Unauthorized");
    }

    return res;
  }

  function fillSectionSelect(selectEl, placeholder) {
    if (!selectEl) return;
    const parts = [`<option value="">${escapeHtml(placeholder)}</option>`];
    state.sections.forEach((s) => {
      parts.push(`<option value="${Number(s.id)}">${escapeHtml(s.name)}</option>`);
    });
    selectEl.innerHTML = parts.join("");
  }

  function fillOfficeOptions(selectEl, placeholder = "Select office option") {
    if (!selectEl) return;
    const parts = [`<option value="">${escapeHtml(placeholder)}</option>`];
    state.officeOptions.forEach((o) => {
      parts.push(`<option value="${Number(o.id)}">${escapeHtml(o.name)}</option>`);
    });
    selectEl.innerHTML = parts.join("");
  }

  function fillForwardTargets(selectEl, placeholder = "Select forward target") {
    if (!selectEl) return;
    const parts = [`<option value="">${escapeHtml(placeholder)}</option>`];
    state.forwardTargets.forEach((item) => {
      const prefix = item.type === "custom" ? "Custom: " : "";
      parts.push(`<option value="${escapeHtml(item.key)}">${escapeHtml(prefix + item.label)}</option>`);
    });
    selectEl.innerHTML = parts.join("");
  }

  async function loadSections() {
    const res = await authFetch("/record-sections/sections");
    const out = await res.json();
    if (!res.ok) throw new Error(out?.message || "Failed to load sections");

    state.sections = Array.isArray(out) ? out : [];
    state.sectionMap = new Map(state.sections.map((s) => [Number(s.id), s.name]));
    const currentKnown = Number(state.recordSectionId || 0);
    if (!currentKnown) {
      const detectedRecordId = detectRecordSectionId(state.sections);
      const cachedRecordId = Number(localStorage.getItem("record_section_id") || 0);
      if (detectedRecordId) {
        state.recordSectionId = Number(detectedRecordId);
        localStorage.setItem("record_section_id", String(detectedRecordId));
      } else if (cachedRecordId && state.sections.some((s) => Number(s.id) === cachedRecordId)) {
        state.recordSectionId = cachedRecordId;
      } else {
        state.recordSectionId = null;
      }
    }

    fillSectionSelect(byId("sectionFilter"), "All Sections");
    fillSectionSelect(byId("sourceSection"), "Select source section");
    applySectionAccessGuards();
  }

  async function loadRecordSectionContext() {
    const res = await authFetch("/record-sections/context");
    const out = await res.json();
    if (!res.ok) throw new Error(out?.message || "Failed to load record section context");
    const rid = Number(out?.record_section_id || 0);
    if (rid > 0) {
      state.recordSectionId = rid;
      localStorage.setItem("record_section_id", String(rid));
    }
    applySectionAccessGuards();
  }

  async function loadOfficeOptions() {
    const res = await authFetch("/record-sections/options/offices");
    const out = await res.json();
    if (!res.ok) throw new Error(out?.message || "Failed to load office options");

    state.officeOptions = Array.isArray(out) ? out : [];
    fillOfficeOptions(byId("receivedFromOffice"));
  }

  async function loadForwardTargets() {
    const res = await authFetch("/record-sections/options/forward-targets?include_sections=1");
    const out = await res.json();
    if (!res.ok) throw new Error(out?.message || "Failed to load forward targets");

    const userSectionId = getUserSectionId();
    const items = Array.isArray(out?.items) ? out.items : [];
    state.forwardTargets = items.filter((item) => {
      if (String(item?.type || "") !== "section") return true;
      if (!userSectionId) return true;
      return Number(item.section_id) !== Number(userSectionId);
    });
    fillForwardTargets(byId("forwardTo"));
    fillForwardTargets(byId("forwardToOption"));
  }

  function renderDailyCounts(stats) {
    const lifetimeEnteredEl = byId("kpiLifetimeEntered");
    const lifetimeForwardedEl = byId("kpiLifetimeForwarded");
    const todayEnteredEl = byId("kpiTodayEntered");
    const todayForwardedEl = byId("kpiTodayForwarded");
    const todayDateEl = byId("todayDateLabel");
    const listEl = byId("dailyStatsList");

    if (lifetimeEnteredEl) lifetimeEnteredEl.textContent = String(Number(stats?.lifetime?.entered || 0));
    if (lifetimeForwardedEl) lifetimeForwardedEl.textContent = String(Number(stats?.lifetime?.forwarded || 0));
    if (todayEnteredEl) todayEnteredEl.textContent = String(Number(stats?.today?.entered || 0));
    if (todayForwardedEl) todayForwardedEl.textContent = String(Number(stats?.today?.forwarded || 0));
    if (todayDateEl) todayDateEl.textContent = escapeHtml(String(stats?.today_date || "-"));

    if (!listEl) return;
    const daily = Array.isArray(stats?.daily) ? stats.daily : [];
    if (!daily.length) {
      listEl.innerHTML = '<span class="rs-stat-chip">No daily data</span>';
      return;
    }

    listEl.innerHTML = daily
      .map(
        (d) =>
          `<span class="rs-stat-chip">${escapeHtml(d.date)} E:${Number(d.entered || 0)} F:${Number(
            d.forwarded || 0
          )}</span>`
      )
      .join("");
  }

  async function loadDailyCounts() {
    const res = await authFetch("/record-sections/stats/daily?days=10");
    const out = await res.json();
    if (!res.ok) throw new Error(out?.message || "Failed to load daily counts");
    renderDailyCounts(out);
  }

  function getFilters() {
    return {
      status: byId("statusFilter")?.value || "all",
      current_section_id: byId("sectionFilter")?.value || "",
      q: byId("searchBox")?.value?.trim() || "",
    };
  }

  async function fetchRows(page = state.page) {
    const f = getFilters();
    const params = new URLSearchParams();

    if (f.status && f.status !== "all") params.set("status", f.status);
    if (f.current_section_id) params.set("current_section_id", f.current_section_id);
    if (f.q) params.set("q", f.q);
    params.set("page", String(page));
    params.set("limit", String(state.limit));

    const res = await authFetch(`/record-sections?${params.toString()}`);
    const out = await res.json();

    if (!res.ok) throw new Error(out?.message || "Failed to load entries");

    state.rows = Array.isArray(out?.data) ? out.data : [];
    state.total = Number(out?.total || state.rows.length || 0);
    state.page = Number(out?.page || page || 1);
    state.limit = Number(out?.limit || state.limit || 20);
  }

  function rowActionButtons(row) {
    const canEdit = !!row.can_edit;
    const receiveVisible = !!row.can_receive;

    return `
      <div class="rs-row-actions">
        ${
          canEdit
            ? `
              <button class="rs-mini-btn" data-action="edit" data-id="${row.id}" type="button">Edit</button>
              <button class="rs-mini-btn" data-action="forward" data-id="${row.id}" type="button">Forward</button>
            `
            : ""
        }
        ${
          receiveVisible
            ? `<button class="rs-mini-btn main" data-action="receive" data-id="${row.id}" type="button">Receive</button>`
            : ""
        }
        <button class="rs-mini-btn" data-action="logs" data-id="${row.id}" type="button">Logs</button>
      </div>
    `;
  }

  function renderRows() {
    const tbody = byId("rows");
    const pageInfo = byId("pageInfo");
    if (!tbody || !pageInfo) return;

    pageInfo.textContent = `Page ${state.page}`;

    if (!state.rows.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="rs-empty">No entries found</td></tr>';
      return;
    }

    tbody.innerHTML = state.rows
      .map((row, idx) => {
        const sl = (state.page - 1) * state.limit + idx + 1;
        const statusClass = String(row.status || "").toLowerCase();
        const statusText = String(row.status || "-").replace(/_/g, " ");
        return `
          <tr>
            <td>${sl}</td>
            <td>${escapeHtml(row.received_from_office_name || "-")}</td>
            <td>${escapeHtml(formatDate(row.received_date))}</td>
            <td>${escapeHtml(row.diary_sl_no || "-")}</td>
            <td>${escapeHtml(row.memo_no || "-")}</td>
            <td>${escapeHtml(formatDate(row.memo_date))}</td>
            <td class="rs-topic">${escapeHtml(row.topic || "-")}</td>
            <td>${escapeHtml(row.current_section_name || sectionNameById(row.current_section_id))}</td>
            <td>${escapeHtml(row.forward_to_name || "-")}</td>
            <td><span class="rs-status ${escapeHtml(statusClass)}">${escapeHtml(statusText)}</span></td>
            <td>${rowActionButtons(row)}</td>
          </tr>
        `;
      })
      .join("");
  }

  async function refresh(page = state.page) {
    try {
      await fetchRows(page);
      renderRows();
      await loadDailyCounts();
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed");
    }
  }

  function openModal(id) {
    const el = byId(id);
    if (el) el.style.display = "flex";
  }

  function closeModal(id) {
    const el = byId(id);
    if (el) el.style.display = "none";
  }

  function resetEntryForm() {
    byId("entryForm")?.reset();
    if (byId("entryId")) byId("entryId").value = "";
    if (byId("receivedDate")) byId("receivedDate").value = toLocalISODate(new Date());

    const sourceWrap = byId("sourceSectionWrap");
    const sourceSelect = byId("sourceSection");
    const userSectionId = getUserSectionId();

    if (sourceWrap) sourceWrap.style.display = "none";
    if (sourceSelect) {
      sourceSelect.disabled = true;
      sourceSelect.value = userSectionId ? String(userSectionId) : "";
    }
  }

  function openAddModal() {
    if (!canCreateRecordEntry()) {
      alert("Only Record section assigned users can create entry");
      return;
    }
    resetEntryForm();
    const title = byId("entryModalTitle");
    if (title) title.textContent = "New Entry";
    openModal("entryModal");
  }

  function buildForwardKeyFromRow(row) {
    if (!row) return "";
    if (String(row.forward_to_type || "") === "section" && row.forward_to_section_id) {
      return `section:${row.forward_to_section_id}`;
    }
    if (String(row.forward_to_type || "") === "custom" && row.forward_to_custom_id) {
      return `custom:${row.forward_to_custom_id}`;
    }
    return "";
  }

  async function openEditModal(id) {
    try {
      const res = await authFetch(`/record-sections/${id}`);
      const out = await res.json();
      if (!res.ok) throw new Error(out?.message || "Failed to load entry");

      const row = out?.data;
      if (!row) throw new Error("Entry not found");

      resetEntryForm();
      byId("entryId").value = row.id;
      byId("sourceSection").value = row.record_section_id || "";
      byId("receivedFromOffice").value = row.received_from_office_id || "";
      byId("receivedDate").value = formatDate(row.received_date) !== "-" ? formatDate(row.received_date) : "";
      byId("diarySlNo").value = row.diary_sl_no || "";
      byId("memoNo").value = row.memo_no || "";
      byId("memoDate").value = formatDate(row.memo_date) !== "-" ? formatDate(row.memo_date) : "";
      byId("topic").value = row.topic || "";
      const forwardKey = buildForwardKeyFromRow(row);
      byId("forwardTo").value = forwardKey;

      const title = byId("entryModalTitle");
      if (title) title.textContent = "Edit Entry";
      openModal("entryModal");
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed");
    }
  }

  async function submitEntryForm(e) {
    e.preventDefault();
    if (!canCreateRecordEntry()) {
      alert("Only Record section assigned users can create entry");
      return;
    }
    const id = String(byId("entryId")?.value || "").trim();

    const payload = {
      source_section_id: getUserSectionId(),
      received_from_office_id: byId("receivedFromOffice")?.value || "",
      received_date: byId("receivedDate")?.value || "",
      diary_sl_no: byId("diarySlNo")?.value?.trim() || "",
      memo_no: byId("memoNo")?.value?.trim() || "",
      memo_date: byId("memoDate")?.value || "",
      topic: byId("topic")?.value?.trim() || "",
      forward_to_key: byId("forwardTo")?.value || "",
    };

    const btn = byId("entrySave");
    const oldText = btn?.textContent || "Save";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving...";
    }

    try {
      const isEdit = Boolean(id);
      const method = isEdit ? "PUT" : "POST";
      const path = isEdit ? `/record-sections/${id}` : "/record-sections";

      const res = await authFetch(path, {
        method,
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.message || "Save failed");

      closeModal("entryModal");
      await refresh(isEdit ? state.page : 1);
    } catch (err) {
      console.error(err);
      alert(err.message || "Save failed");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  }

  async function openForwardModal(entry) {
    const row = typeof entry === "object" && entry ? entry : null;
    const id = row ? row.id : entry;

    byId("forwardEntryId").value = String(id || "");
    byId("forwardNote").value = "";

    if (row) {
      const forwardKey = buildForwardKeyFromRow(row);
      if (forwardKey) {
        byId("forwardToOption").value = forwardKey;
      } else {
        byId("forwardToOption").value = "";
      }
    } else {
      byId("forwardToOption").value = "";
    }
    openModal("forwardModal");
  }

  async function submitForwardForm(e) {
    e.preventDefault();
    const id = byId("forwardEntryId")?.value;
    if (!id) return;

    const payload = {
      forward_to_key: byId("forwardToOption")?.value || "",
      note: byId("forwardNote")?.value?.trim() || null,
    };

    const btn = byId("forwardSave");
    const oldText = btn?.textContent || "Forward";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Forwarding...";
    }

    try {
      const res = await authFetch(`/record-sections/${id}/forward`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.message || "Forward failed");

      closeModal("forwardModal");
      await refresh(state.page);
    } catch (err) {
      console.error(err);
      alert(err.message || "Forward failed");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  }

  async function receiveEntry(id) {
    const ok = window.confirm("Receive this forwarded entry?");
    if (!ok) return;

    try {
      const res = await authFetch(`/record-sections/${id}/receive`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.message || "Receive failed");
      await refresh(state.page);
    } catch (err) {
      console.error(err);
      alert(err.message || "Receive failed");
    }
  }

  function actorName(log) {
    return log?.actor?.name || log?.actor?.username || (log?.actor_id ? `User #${log.actor_id}` : "System");
  }

  function renderLogItem(log) {
    const oldData = parseJsonSafe(log.old_data, null);
    const newData = parseJsonSafe(log.new_data, null);
    const oldStatus = oldData?.status ? `From: ${oldData.status}` : "";
    const newStatus = newData?.status ? `To: ${newData.status}` : "";
    const line = [oldStatus, newStatus].filter(Boolean).join(" ");

    return `
      <article class="rs-log-item">
        <div class="rs-log-top">
          <div class="rs-log-action">${escapeHtml(log.action || "-")} by ${escapeHtml(actorName(log))}</div>
          <div class="rs-log-time">${escapeHtml(formatDateTime(log.created_at))}</div>
        </div>
        ${line ? `<div>${escapeHtml(line)}</div>` : ""}
        ${log.note ? `<div><b>Note:</b> ${escapeHtml(log.note)}</div>` : ""}
      </article>
    `;
  }

  async function openLogs(id) {
    const body = byId("logsBody");
    if (body) body.innerHTML = '<div class="rs-empty">Loading...</div>';
    openModal("logsModal");

    try {
      const res = await authFetch(`/record-sections/${id}/logs`);
      const out = await res.json();
      if (!res.ok) throw new Error(out?.message || "Failed to load logs");

      const rows = Array.isArray(out?.data) ? out.data : [];
      if (!rows.length) {
        if (body) body.innerHTML = '<div class="rs-empty">No logs found</div>';
        return;
      }

      if (body) body.innerHTML = rows.map(renderLogItem).join("");
    } catch (err) {
      console.error(err);
      if (body) body.innerHTML = `<div class="rs-empty">${escapeHtml(err.message || "Failed to load logs")}</div>`;
    }
  }

  function reportHeaderHtml(title) {
    return `
      <div class="rsr-head">
        <div class="rsr-head-line rsr-head-main">Office of the Senior Finance Controller (Air Force)</div>
        <div class="rsr-head-line">Dhaka Cantonment, Dhaka-1206</div>
        <div class="rsr-head-line">Record Section</div>
        <div class="rsr-head-title">${escapeHtml(title || "Forwarded Report")}</div>
      </div>
    `;
  }

  function openPrintWindowHtml({ bodyHtml, docTitle }) {
    const w = window.open("", "_blank", "width=1100,height=820");
    if (!w) {
      alert("Pop-up blocked! Please allow pop-ups for printing.");
      return;
    }

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(docTitle || "Forwarded Report")}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color:#111; }
          .print-btn { margin-bottom: 12px; }
          @media print { .print-btn { display:none; } body { padding: 10px; } }

          .page { page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          @media print {
            .page { page-break-after: always; }
            .page:last-child { page-break-after: auto; }
          }

          .rsr-head { text-align: center; margin-bottom: 10px; }
          .rsr-head-line { line-height: 1.35; font-weight: 700; }
          .rsr-head-main { font-size: 24px; font-style: italic; }
          .rsr-head-title { margin-top: 8px; font-size: 24px; font-weight: 800; font-style: italic; text-decoration: underline; }

          .rsr-meta { margin-top: 12px; margin-bottom: 12px; font-size: 12px; line-height: 1.75; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #cfcfcf; padding: 8px; font-size: 12px; text-align: left; vertical-align: top; }
          th { background: #f6f6f6; font-weight: 700; }
          .rsr-topic { max-width: 360px; overflow-wrap: anywhere; }
          .signature { margin-top: 18px; text-align: right; font-size: 12px; font-weight: 700; }
        </style>
      </head>
      <body>
        <button class="print-btn" onclick="window.print()">Print</button>
        ${bodyHtml}
      </body>
      </html>
    `;

    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  async function fetchForwardedReportByDate(reportDate) {
    const params = new URLSearchParams({ report_date: reportDate });
    const res = await authFetch(`/record-sections/reports/forwarded-by-date?${params.toString()}`);
    const out = await res.json();
    if (!res.ok) throw new Error(out?.message || "Failed to load forwarded report");
    return out;
  }

  function openForwardReportModal() {
    const dateInput = byId("forwardReportDate");
    if (dateInput) dateInput.value = toLocalISODate(new Date());
    openModal("forwardReportModal");
  }

  async function submitForwardReportForm(e) {
    e.preventDefault();
    const reportDate = parseDateOnly(byId("forwardReportDate")?.value || "");
    if (!reportDate) {
      alert("Please select a valid date");
      return;
    }

    const btn = byId("forwardReportGo");
    const oldText = btn?.textContent || "Go";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Loading...";
    }

    try {
      const out = await fetchForwardedReportByDate(reportDate);
      const entries = Array.isArray(out?.entries) ? out.entries : [];
      const totalForwarded = Number(out?.total_forwarded || entries.length || 0);
      const printedAt = new Date().toLocaleString();

      const groupMap = new Map();
      entries.forEach((row) => {
        const groupName = String(row?.forward_to_name || "").trim() || "Unknown";
        if (!groupMap.has(groupName)) groupMap.set(groupName, []);
        groupMap.get(groupName).push(row);
      });

      const orderedGroups = Array.from(groupMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      const pagesHtml = orderedGroups
        .map(([groupName, rows]) => {
          const rowsHtml = rows
            .map(
              (row, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${escapeHtml(row.diary_sl_no || "-")}</td>
                  <td>${escapeHtml(row.memo_no || "-")}</td>
                  <td>${escapeHtml(formatDate(row.received_date))}</td>
                  <td class="rsr-topic">${escapeHtml(row.topic || "-")}</td>
                  <td>${escapeHtml(String(row.status || "-").replace(/_/g, " "))}</td>
                </tr>
              `
            )
            .join("");

          return `
            <div class="page">
              ${reportHeaderHtml("Forwarded Record Report")}
              <div class="rsr-meta">
                <div>Report Date: <b>${escapeHtml(reportDate)}</b></div>
                <div>Forward To Section: <b>${escapeHtml(groupName)}</b></div>
                <div>Printed at: <b>${escapeHtml(printedAt)}</b></div>
                <div>Section Total Forwarded: <b>${escapeHtml(String(rows.length))}</b></div>
                <div>All Total Forwarded: <b>${escapeHtml(String(totalForwarded))}</b></div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="width:55px;">SL</th>
                    <th>Diary SL No</th>
                    <th>Memo No</th>
                    <th>Received Date</th>
                    <th>Topic</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml || '<tr><td colspan="6" style="text-align:center;color:#666;">No forwarded data found for this section</td></tr>'}
                </tbody>
              </table>

              <div class="signature">Signature</div>
            </div>
          `;
        })
        .join("");

      const bodyHtml =
        pagesHtml ||
        `
          <div class="page">
            ${reportHeaderHtml("Forwarded Record Report")}
            <div class="rsr-meta">
              <div>Report Date: <b>${escapeHtml(reportDate)}</b></div>
              <div>Printed at: <b>${escapeHtml(printedAt)}</b></div>
              <div>Total Forwarded: <b>0</b></div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width:55px;">SL</th>
                  <th>Diary SL No</th>
                  <th>Memo No</th>
                  <th>Received Date</th>
                  <th>Topic</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="6" style="text-align:center;color:#666;">No forwarded data found for selected date</td></tr>
              </tbody>
            </table>
            <div class="signature">Signature</div>
          </div>
        `;

      closeModal("forwardReportModal");
      openPrintWindowHtml({
        docTitle: `Forwarded_Report_${reportDate}`,
        bodyHtml,
      });
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to generate forwarded report");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  }

  function bindModalClose(modalId, closeBtnId) {
    const modal = byId(modalId);
    const closeBtn = byId(closeBtnId);
    if (!modal) return;

    closeBtn?.addEventListener("click", () => closeModal(modalId));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal(modalId);
    });
  }

  function bindEvents() {
    byId("btnSearch")?.addEventListener("click", () => refresh(1));
    byId("btnClear")?.addEventListener("click", () => {
      byId("statusFilter").value = "all";
      byId("sectionFilter").value = "";
      byId("searchBox").value = "";
      refresh(1);
    });
    byId("btnNew")?.addEventListener("click", openAddModal);
    byId("btnForwardReport")?.addEventListener("click", openForwardReportModal);

    byId("statusFilter")?.addEventListener("change", () => refresh(1));
    byId("sectionFilter")?.addEventListener("change", () => refresh(1));
    byId("searchBox")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") refresh(1);
    });

    byId("entryForm")?.addEventListener("submit", submitEntryForm);
    byId("entryCancel")?.addEventListener("click", () => closeModal("entryModal"));

    byId("forwardForm")?.addEventListener("submit", submitForwardForm);
    byId("forwardCancel")?.addEventListener("click", () => closeModal("forwardModal"));
    byId("forwardReportForm")?.addEventListener("submit", submitForwardReportForm);
    byId("forwardReportCancel")?.addEventListener("click", () => closeModal("forwardReportModal"));

    byId("prevBtn")?.addEventListener("click", () => {
      if (state.page > 1) refresh(state.page - 1);
    });
    byId("nextBtn")?.addEventListener("click", () => {
      const totalPages = Math.ceil((state.total || 0) / (state.limit || 20));
      if (state.page < totalPages) refresh(state.page + 1);
    });

    byId("rows")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      if (!id || !action) return;

      if (action === "edit") {
        await openEditModal(id);
        return;
      }
      if (action === "forward") {
        const row = state.rows.find((r) => String(r.id) === String(id));
        if (!row) return;
        await openForwardModal(row);
        return;
      }
      if (action === "receive") {
        await receiveEntry(id);
        return;
      }
      if (action === "logs") {
        await openLogs(id);
      }
    });

    bindModalClose("entryModal", "entryModalClose");
    bindModalClose("forwardModal", "forwardModalClose");
    bindModalClose("logsModal", "logsModalClose");
    bindModalClose("forwardReportModal", "forwardReportClose");
  }

  function applySectionAccessGuards() {
    const canCreate = canCreateRecordEntry();
    const btnNew = byId("btnNew");
    if (btnNew) {
      btnNew.disabled = !canCreate;
      btnNew.title = canCreate ? "" : "Only Record section users can create entry";
    }
  }

  async function init() {
    if (!getToken()) {
      window.location.href = "login.html";
      return;
    }

    await initApiBase();
    bindEvents();
    applySectionAccessGuards();
    await Promise.all([loadRecordSectionContext(), loadSections(), loadOfficeOptions(), loadForwardTargets()]);
    await refresh(1);
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      console.error("record-section init error:", err);
      alert(err.message || "Failed to initialize page");
    });
  });
})();
