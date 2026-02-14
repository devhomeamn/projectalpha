function getToken() {
  return localStorage.getItem("token");
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = options.headers || {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!options.body || !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  options.headers = headers;

  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}

function setStats(rows) {
  const counts = { pending: 0, approved: 0, rejected: 0 };
  rows.forEach((r) => {
    const s = String(r?.status || "").toLowerCase();
    if (counts[s] !== undefined) counts[s] += 1;
  });

  const set = (id, n) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(n);
  };

  set("countPending", counts.pending);
  set("countApproved", counts.approved);
  set("countRejected", counts.rejected);
  set("countTotal", rows.length);
}

function statusChip(status) {
  const s = String(status || "").toLowerCase();
  const text = s ? s.toUpperCase() : "UNKNOWN";
  return `<span class="chip" data-status="${esc(s)}">${esc(text)}</span>`;
}

function attachmentView(row) {
  if (!row?.attachment_path) return `<span class="muted">No attachment</span>`;
  return `<a href="/${esc(row.attachment_path)}" target="_blank" rel="noopener">View attachment</a>`;
}

function requestCard(row) {
  const rec = row.Record || row.record || null;
  const fileName = rec?.file_name ? rec.file_name : "-";
  const serialNo = rec?.serial_no === 0 || rec?.serial_no ? rec.serial_no : "-";
  const createdAt = row.createdAt ? new Date(row.createdAt).toLocaleString() : "-";
  const isPending = String(row.status || "").toLowerCase() === "pending";

  return `
    <article class="aoq-card">
      <div class="aoq-card-head">
        <div>
          <div class="ob-title">
            <span class="ob-no">REQ #${esc(row.id)}</span>
            <span class="ob-title-text">${esc(row.bd_no || "-")}</span>
          </div>
          <div class="ob-subtitle">Record ${esc(row.record_id)} | ${esc(fileName)}</div>
        </div>
        ${statusChip(row.status)}
      </div>

      <div class="aoq-kv">
        <div class="aoq-kv-item"><strong>BD:</strong> ${esc(row.bd_no || "-")}</div>
        <div class="aoq-kv-item"><strong>Record ID:</strong> ${esc(row.record_id)}</div>
        <div class="aoq-kv-item"><strong>File:</strong> ${esc(fileName)}</div>
        <div class="aoq-kv-item"><strong>Serial:</strong> ${esc(serialNo)}</div>
        <div class="aoq-kv-item"><strong>Requested by:</strong> ${esc(row.requested_by || "-")}</div>
        <div class="aoq-kv-item"><strong>Requested at:</strong> ${esc(createdAt)}</div>
      </div>

      <div class="aoq-note">
        <span class="aoq-note-title">User note</span>
        <div class="aoq-note-text">${esc(row.request_note || "-")}</div>
      </div>

      <div class="aoq-attachment">
        <strong>Attachment:</strong>
        ${attachmentView(row)}
      </div>

      <div class="aoq-admin-box">
        <label class="aoq-admin-label" for="admin_note_${esc(row.id)}">Admin note</label>
        <textarea id="admin_note_${esc(row.id)}" class="aoq-admin-note js-admin-note" rows="3">${esc(row.admin_note || "")}</textarea>
      </div>

      <div class="aoq-actions js-action-row">
        ${
          isPending
            ? `
              <button class="btn btn-sm js-reject" type="button">Reject</button>
              <button class="btn btn-sm btn-primary js-approve" type="button">Approve</button>
            `
            : `<em class="muted">Already ${esc(row.status)}.</em>`
        }
      </div>

      <div class="aoq-msg js-msg"></div>
    </article>
  `;
}

async function loadList() {
  const status = document.getElementById("statusFilter").value;
  const list = document.getElementById("list");
  const errorBox = document.getElementById("errorBox");
  const resultInfo = document.getElementById("resultInfo");

  errorBox.style.display = "none";
  list.innerHTML = "";

  try {
    const res = await apiFetch(`/api/ao-clearance-requests?status=${encodeURIComponent(status)}`);
    const rows = Array.isArray(res.data) ? res.data : [];
    setStats(rows);
    if (resultInfo) resultInfo.textContent = `${rows.length} request(s)`;

    if (!rows.length) {
      list.innerHTML = `<div class="aoq-empty">No requests found for current filter.</div>`;
      return;
    }

    rows.forEach((r) => {
      const card = document.createElement("div");
      card.innerHTML = requestCard(r);
      const root = card.firstElementChild;
      if (!root) return;

      if (String(r.status || "").toLowerCase() === "pending") {
        const noteEl = root.querySelector(".js-admin-note");
        const approveBtn = root.querySelector(".js-approve");
        const rejectBtn = root.querySelector(".js-reject");
        const msg = root.querySelector(".js-msg");

        const decide = async (decision) => {
          msg.style.display = "none";
          approveBtn.disabled = true;
          rejectBtn.disabled = true;

          try {
            await apiFetch(`/api/ao-clearance-requests/${r.id}/decide`, {
              method: "PUT",
              body: JSON.stringify({
                decision,
                admin_note: (noteEl.value || "").trim(),
              }),
            });

            msg.style.display = "block";
            msg.style.color = decision === "approved" ? "#0a7a28" : "#b00020";
            msg.textContent = `Request ${decision}.`;
            setTimeout(loadList, 350);
          } catch (e) {
            msg.style.display = "block";
            msg.style.color = "#b00020";
            msg.textContent = e.message || "Failed";
            approveBtn.disabled = false;
            rejectBtn.disabled = false;
          }
        };

        approveBtn.addEventListener("click", () => decide("approved"));
        rejectBtn.addEventListener("click", () => decide("rejected"));
      }

      list.appendChild(root);
    });
  } catch (e) {
    setStats([]);
    if (resultInfo) resultInfo.textContent = "Failed to load";
    errorBox.textContent = e.message || "Failed to load";
    errorBox.style.display = "block";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("refreshBtn").addEventListener("click", loadList);
  document.getElementById("statusFilter").addEventListener("change", loadList);
  loadList();
});
