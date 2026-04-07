const DEFAULT_PAGE_SIZE = 20;

let apiBasePromise = null;

export const INVENTORY_STATUS = {
  header: [
    "Draft",
    "Submitted",
    "Forwarded",
    "Approved",
    "Partially Approved",
    "Rejected",
    "Issued",
  ],
  line: ["Pending", "Approved", "Partially Approved", "Rejected", "Issued"],
};

export function getToken() {
  return localStorage.getItem("token") || "";
}

export function getRole() {
  return String(localStorage.getItem("role") || "").trim().toLowerCase();
}

export function getUserSectionId() {
  const n = Number(localStorage.getItem("section_id") || 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getUserId() {
  const raw = localStorage.getItem("user_id");
  const n = Number(raw || 0);
  if (Number.isFinite(n) && n > 0) return n;
  return null;
}

export function isRole(...roles) {
  const role = getRole();
  return roles.map((x) => String(x || "").toLowerCase()).includes(role);
}

export function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export function toQty(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Number(n.toFixed(2));
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(value) {
  if (!value) return "-";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? text.slice(0, 10) : d.toLocaleDateString();
}

export function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

export function normalizeStatusClass(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function toTitleRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

export function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export function getCurrentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function redirectLogin() {
  localStorage.clear();
  window.location.href = "login.html";
}

function buildUrl(base, path) {
  const cleanBase = String(base || "/api").replace(/\/+$/, "");
  if (String(path).startsWith("http")) return String(path);
  if (String(path).startsWith("/")) return `${cleanBase}${path}`;
  return `${cleanBase}/${path}`;
}

export async function getApiBase() {
  if (!apiBasePromise) {
    apiBasePromise = (async () => {
      try {
        const res = await fetch("/api/config");
        const data = await res.json();
        const raw = String(data?.apiBase || "").trim();
        if (!raw) return "/api";
        if (raw.endsWith("/api")) return raw;
        return `${raw.replace(/\/+$/, "")}/api`;
      } catch {
        return "/api";
      }
    })();
  }
  return apiBasePromise;
}

export async function authFetch(path, options = {}) {
  const token = getToken();
  const apiBase = await getApiBase();
  const url = buildUrl(apiBase, path);
  const headers = { ...(options.headers || {}) };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    redirectLogin();
    throw new Error("Unauthorized");
  }
  return res;
}

export async function fetchJson(path, options = {}) {
  const res = await authFetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data?.message ||
      data?.error ||
      `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export function showToast(message, type = "success", duration = 2800) {
  const hostId = "invToastHost";
  let host = document.getElementById(hostId);
  if (!host) {
    host = document.createElement("div");
    host.id = hostId;
    host.className = "inv-toast-host";
    document.body.appendChild(host);
  }

  const toast = document.createElement("div");
  toast.className = `inv-toast ${type}`;
  toast.textContent = String(message || "");
  host.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener(
      "transitionend",
      () => {
        toast.remove();
      },
      { once: true }
    );
  }, Math.max(1500, duration));
}

export function setButtonBusy(button, isBusy, loadingLabel = "Please wait...") {
  if (!button) return () => {};
  const original = button.dataset.originalLabel || button.textContent || "";
  if (!button.dataset.originalLabel) button.dataset.originalLabel = original;
  button.disabled = Boolean(isBusy);
  button.textContent = isBusy ? loadingLabel : button.dataset.originalLabel;
  return () => {
    button.disabled = false;
    button.textContent = button.dataset.originalLabel || original;
  };
}

export function getPagination(total, page, limit) {
  const safeTotal = Math.max(0, toPositiveInt(total) || 0);
  const safeLimit = Math.max(1, toPositiveInt(limit) || DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));
  const safePage = Math.min(totalPages, Math.max(1, toPositiveInt(page) || 1));
  return { total: safeTotal, page: safePage, limit: safeLimit, totalPages };
}

export function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value ?? "");
}

export function byId(id) {
  return document.getElementById(id);
}

export function lineStatusBadge(status) {
  const cls = normalizeStatusClass(status);
  const text = escapeHtml(status || "-");
  return `<span class="inv-badge ${cls}">${text}</span>`;
}

