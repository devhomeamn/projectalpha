(async function () {
  // auth.js loads API_BASE asynchronously; ensure config loaded
  async function getApiBase() {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      return data.apiBase || window.location.origin;
    } catch {
      return window.location.origin;
    }
  }

  document.getElementById("forgotForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = (document.getElementById("email")?.value || "").trim();
    const API_BASE = await getApiBase();

    try {
      const res = await fetch(`${API_BASE}/api/password/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (typeof showToast === "function") {
        showToast(data.message || "Request received", "info", 8000);
      } else {
        alert(data.message || "Request received");
      }
    } catch (err) {
      if (typeof showToast === "function") showToast("Network error. Try again.", "error");
      else alert("Network error");
    }
  });
})();
