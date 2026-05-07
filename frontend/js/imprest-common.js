import {
  byId,
  ensureArray,
  escapeHtml,
  fetchJson,
  formatDate,
  getPagination,
  getRole,
  normalizeStatusClass,
  setButtonBusy,
  showToast,
  toNumber,
  toPositiveInt,
} from "./inventory-common.js";

export {
  byId,
  ensureArray,
  escapeHtml,
  formatDate,
  getPagination,
  getRole,
  normalizeStatusClass,
  setButtonBusy,
  showToast,
  toNumber,
  toPositiveInt,
};

export const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MONTHS_BN = [
  "\u099c\u09be\u09a8\u09c1\u09af\u09bc\u09be\u09b0\u09bf",
  "\u09ab\u09c7\u09ac\u09cd\u09b0\u09c1\u09af\u09bc\u09be\u09b0\u09bf",
  "\u09ae\u09be\u09b0\u09cd\u099a",
  "\u098f\u09aa\u09cd\u09b0\u09bf\u09b2",
  "\u09ae\u09c7",
  "\u099c\u09c1\u09a8",
  "\u099c\u09c1\u09b2\u09be\u0987",
  "\u0986\u0997\u09b8\u09cd\u099f",
  "\u09b8\u09c7\u09aa\u09cd\u099f\u09c7\u09ae\u09cd\u09ac\u09b0",
  "\u0985\u0995\u09cd\u099f\u09cb\u09ac\u09b0",
  "\u09a8\u09ad\u09c7\u09ae\u09cd\u09ac\u09b0",
  "\u09a1\u09bf\u09b8\u09c7\u09ae\u09cd\u09ac\u09b0",
];

const BN_DIGITS = ["\u09e6", "\u09e7", "\u09e8", "\u09e9", "\u09ea", "\u09eb", "\u09ec", "\u09ed", "\u09ee", "\u09ef"];
const UNITS_BN = [
  "\u09b6\u09c2\u09a8\u09cd\u09af",
  "\u098f\u0995",
  "\u09a6\u09c1\u0987",
  "\u09a4\u09bf\u09a8",
  "\u099a\u09be\u09b0",
  "\u09aa\u09be\u0981\u099a",
  "\u099b\u09af\u09bc",
  "\u09b8\u09be\u09a4",
  "\u0986\u099f",
  "\u09a8\u09af\u09bc",
  "\u09a6\u09b6",
  "\u098f\u0997\u09be\u09b0\u09cb",
  "\u09ac\u09be\u09b0\u09cb",
  "\u09a4\u09c7\u09b0\u09cb",
  "\u099a\u09cc\u09a6\u09cd\u09a6",
  "\u09aa\u09a8\u09c7\u09b0\u09cb",
  "\u09b7\u09cb\u09b2",
  "\u09b8\u09a4\u09c7\u09b0\u09cb",
  "\u0986\u09a0\u09be\u09b0\u09cb",
  "\u0989\u09a8\u09bf\u09b6",
];
const TENS_BN = [
  "",
  "",
  "\u09ac\u09bf\u09b6",
  "\u09a4\u09cd\u09b0\u09bf\u09b6",
  "\u099a\u09b2\u09cd\u09b2\u09bf\u09b6",
  "\u09aa\u099e\u09cd\u099a\u09be\u09b6",
  "\u09b7\u09be\u099f",
  "\u09b8\u09a4\u09cd\u09a4\u09b0",
  "\u0986\u09b6\u09bf",
  "\u09a8\u09ac\u09cd\u09ac\u0987",
];

function normalizeNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return 0;

  const safe = String(value)
    .replace(/[\u09e6-\u09ef]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/,/g, "")
    .trim();

  const n = Number(safe);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(value, locale = "en-IN") {
  const n = normalizeNumber(value);
  return n.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function toBanglaDigits(input) {
  return String(input ?? "").replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)] || d);
}

export function formatMoneyBn(value) {
  return toBanglaDigits(formatMoney(value, "en-IN"));
}

export function formatDateBn(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return toBanglaDigits(String(value));
  return d.toLocaleDateString("bn-BD", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

export function getMonthNameBn(month) {
  const idx = Number(month || 0) - 1;
  if (idx < 0 || idx >= MONTHS_BN.length) return "-";
  return MONTHS_BN[idx];
}

export function parseMonthFromDateLike(value, fallback = 1) {
  const text = String(value || "").trim();
  if (!text) return fallback;
  const match = text.match(/^\d{4}-(\d{2})-\d{2}$/);
  if (match) {
    const month = Number(match[1]);
    if (Number.isFinite(month) && month >= 1 && month <= 12) return month;
  }

  const parsed = new Date(text);
  const month = Number(parsed.getMonth()) + 1;
  if (Number.isFinite(month) && month >= 1 && month <= 12) return month;
  return fallback;
}

export function getFiscalStartMonth(fiscalYear, fallback = 1) {
  return parseMonthFromDateLike(fiscalYear?.start_date, fallback);
}

export function getFiscalMonthOrder(startMonth = 1) {
  const safeStart = Number(startMonth);
  const begin = Number.isFinite(safeStart) && safeStart >= 1 && safeStart <= 12 ? Math.trunc(safeStart) : 1;
  const order = [];
  for (let i = 0; i < 12; i += 1) {
    order.push(((begin - 1 + i) % 12) + 1);
  }
  return order;
}

export function getFiscalMonthSortIndex(month, startMonth = 1) {
  const n = Number(month);
  if (!Number.isFinite(n) || n < 1 || n > 12) return 99;
  const order = getFiscalMonthOrder(startMonth);
  const idx = order.indexOf(Math.trunc(n));
  return idx >= 0 ? idx : 99;
}

function wordsBelowHundred(value) {
  const n = Math.trunc(Math.abs(value));
  if (n < 20) return UNITS_BN[n];
  const t = Math.trunc(n / 10);
  const u = n % 10;
  if (!u) return TENS_BN[t];
  return `${TENS_BN[t]} ${UNITS_BN[u]}`;
}

function wordsBelowThousand(value) {
  const n = Math.trunc(Math.abs(value));
  if (n < 100) return wordsBelowHundred(n);
  const h = Math.trunc(n / 100);
  const rem = n % 100;
  if (!rem) return `${UNITS_BN[h]} \u09b6\u09a4`;
  return `${UNITS_BN[h]} \u09b6\u09a4 ${wordsBelowHundred(rem)}`;
}

function wordsUnderCrore(value) {
  const n = Math.trunc(Math.abs(value));
  if (n < 1000) return wordsBelowThousand(n);

  if (n < 100000) {
    const thousand = Math.trunc(n / 1000);
    const rem = n % 1000;
    if (!rem) return `${wordsBelowThousand(thousand)} \u09b9\u09be\u099c\u09be\u09b0`;
    return `${wordsBelowThousand(thousand)} \u09b9\u09be\u099c\u09be\u09b0 ${wordsBelowThousand(rem)}`;
  }

  const lakh = Math.trunc(n / 100000);
  const rem = n % 100000;
  if (!rem) return `${wordsBelowThousand(lakh)} \u09b2\u0995\u09cd\u09b7`;
  return `${wordsBelowThousand(lakh)} \u09b2\u0995\u09cd\u09b7 ${wordsUnderCrore(rem)}`;
}

function integerToBanglaWords(value) {
  const n = Math.trunc(Math.abs(value));
  if (n === 0) return UNITS_BN[0];
  if (n < 10000000) return wordsUnderCrore(n);

  const crore = Math.trunc(n / 10000000);
  const rem = n % 10000000;
  if (!rem) return `${integerToBanglaWords(crore)} \u0995\u09cb\u099f\u09bf`;
  return `${integerToBanglaWords(crore)} \u0995\u09cb\u099f\u09bf ${wordsUnderCrore(rem)}`;
}

export function amountInBanglaWords(value) {
  const n = normalizeNumber(value);
  const integerPart = Math.trunc(Math.abs(n));
  const paisa = Math.round((Math.abs(n) - integerPart) * 100);

  const takaText = integerToBanglaWords(integerPart);
  if (!paisa) return `${takaText} \u099f\u09be\u0995\u09be \u09ae\u09be\u09a4\u09cd\u09b0`;

  const paisaText = integerToBanglaWords(paisa);
  return `${takaText} \u099f\u09be\u0995\u09be ${paisaText} \u09aa\u09af\u09bc\u09b8\u09be \u09ae\u09be\u09a4\u09cd\u09b0`;
}

export async function imprestFetch(path, options = {}) {
  return fetchJson(`/imprest${path}`, options);
}

export function getPakkhikLabel(value) {
  const text = String(value || "").toUpperCase();
  if (text === "FIRST_HALF") return "\u09e7\u09ae \u09aa\u09be\u0995\u09cd\u09b7\u09bf\u0995";
  if (text === "SECOND_HALF") return "\u09e8\u09df \u09aa\u09be\u0995\u09cd\u09b7\u09bf\u0995";
  if (text === "NONE") return "N/A";
  if (text === "SUPPLEMENTARY") return "\u09b8\u09ae\u09cd\u09aa\u09c2\u09b0\u0995";
  return value || "-";
}

export function getPakkhikShort(value) {
  const safe = String(value || "").toUpperCase();
  if (safe === "FIRST_HALF") return "\u09e7\u09ae";
  if (safe === "SECOND_HALF") return "\u09e8\u09df";
  if (safe === "NONE") return "N/A";
  if (safe === "SUPPLEMENTARY") return "\u09b8\u09ae\u09cd\u09aa\u09c2\u09b0\u0995";
  return "-";
}

export function createMonthOptionsHtml(selected = null, startMonth = 1) {
  const order = getFiscalMonthOrder(startMonth);
  return order
    .map((value) => {
      const name = MONTHS_EN[value - 1] || String(value);
      const selectedAttr = Number(selected) === value ? "selected" : "";
      return `<option value="${value}" ${selectedAttr}>${name}</option>`;
    })
    .join("");
}

export function createPakkhikOptionsHtml(selected = null) {
  const safe = String(selected || "").toUpperCase();
  return [
    `<option value="FIRST_HALF" ${safe === "FIRST_HALF" ? "selected" : ""}>1st Half</option>`,
    `<option value="SECOND_HALF" ${safe === "SECOND_HALF" ? "selected" : ""}>2nd Half</option>`,
    `<option value="NONE" ${safe === "NONE" || safe === "SUPPLEMENTARY" ? "selected" : ""}>None</option>`,
  ].join("");
}

export function iframePrint(html) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 900);
  }, 260);
}

export function preventNumberInputWheel(root = document) {
  if (!root || typeof root.addEventListener !== "function") return;
  root.addEventListener(
    "wheel",
    (e) => {
      const input = e.target?.closest?.('input[type="number"]');
      if (!input) return;
      if (document.activeElement !== input) return;
      input.blur();
    },
    { passive: true }
  );
}
