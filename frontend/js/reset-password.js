(async function () {
  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  async function getApiBase() {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      return data.apiBase || window.location.origin;
    } catch {
      return window.location.origin;
    }
  }

  document.getElementById("resetForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = getParam("token");
    const newPassword = (document.getElementById("newPassword")?.value || "").trim();

    if (!token) {
      if (typeof showToast === "function") showToast("Invalid reset link (token missing).", "error");
      else alert("Invalid reset link");
      return;
    }

    const API_BASE = await getApiBase();

    try {
      const res = await fetch(`${API_BASE}/api/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (typeof showToast === "function") showToast(data.error || "Failed", "error");
        else alert(data.error || "Failed");
        return;
      }

      if (typeof showToast === "function") showToast("✅ Password reset successful. Please login.", "success", 7000);
      else alert("Password reset successful");

      setTimeout(() => (window.location.href = "login.html"), 1200);
    } catch (err) {
      if (typeof showToast === "function") showToast("Network error. Try again.", "error");
      else alert("Network error");
    }
  });
})();
