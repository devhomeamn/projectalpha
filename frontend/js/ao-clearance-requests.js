function getToken() {
  return localStorage.getItem("token");
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = options.headers || {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!options.body || !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  options.headers = headers;

  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}

function el(tag, attrs = {}, html = "") {
  const x = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => x.setAttribute(k, v));
  x.innerHTML = html;
  return x;
}

async function loadList() {
  const status = document.getElementById("statusFilter").value;
  const list = document.getElementById("list");
  const errorBox = document.getElementById("errorBox");
  errorBox.style.display = "none";
  list.innerHTML = "";

  try {
    const res = await apiFetch(
      `/api/ao-clearance-requests?status=${encodeURIComponent(status)}`
    );
    const rows = res.data || [];

    if (!rows.length) {
      list.appendChild(el("div", {}, "<em>No requests found.</em>"));
      return;
    }

    rows.forEach((r) => {
      const card = el("div", { class: "card" });

      const attachmentHtml = r.attachment_path
        ? `<a href="/${r.attachment_path}" target="_blank">View attachment</a>`
        : `<span style="opacity:.75;">No attachment</span>`;

      // record details (if backend includes Record)
      const rec = r.Record || r.record || null;
      const fileName = rec?.file_name ? rec.file_name : "-";
      const serialNo =
        rec?.serial_no === 0 || rec?.serial_no ? rec.serial_no : "-";

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div>
            <div><strong>BD:</strong> ${r.bd_no || "-"}</div>
            <div><strong>Record ID:</strong> ${r.record_id}</div>
            <div><strong>File:</strong> ${fileName}</div>
            <div><strong>Serial:</strong> ${serialNo}</div>
          </div>
          <div>
           <span class="chip" data-status="${(r.status || "").toLowerCase()}">
  ${(r.status || "").toUpperCase()}
</span>

          </div>
        </div>

        <div style="margin-top:10px;">
          <div><strong>Requested by:</strong> ${r.requested_by}</div>
          <div><strong>Requested at:</strong> ${
            r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"
          }</div>
        </div>

        <div style="margin-top:10px;">
          <div><strong>User note:</strong></div>
          <div style="white-space:pre-wrap;">${r.request_note || "-"}</div>
        </div>

        <div style="margin-top:10px;">
          <strong>Attachment:</strong> ${attachmentHtml}
        </div>

        <div style="margin-top:12px;">
          <label><strong>Admin note</strong></label>
          <textarea class="js-admin-note" rows="3" style="width:100%;">${
            r.admin_note || ""
          }</textarea>
        </div>

        <div class="js-action-row" style="margin-top:10px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
          ${
            r.status === "pending"
              ? `
                <button class="btn btn-sm js-reject">Reject</button>
                <button class="btn btn-sm btn-primary js-approve">Approve</button>
              `
              : `<em style="opacity:.75;">Already ${r.status}.</em>`
          }
        </div>

        <div class="js-msg" style="margin-top:8px;display:none;"></div>
      `;

      if (r.status === "pending") {
        const noteEl = card.querySelector(".js-admin-note");
        const approveBtn = card.querySelector(".js-approve");
        const rejectBtn = card.querySelector(".js-reject");
        const msg = card.querySelector(".js-msg");

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

            setTimeout(loadList, 400);
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

      list.appendChild(card);
    });
  } catch (e) {
    errorBox.textContent = e.message || "Failed to load";
    errorBox.style.display = "block";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("refreshBtn").addEventListener("click", loadList);
  document.getElementById("statusFilter").addEventListener("change", loadList);
  loadList();
});
