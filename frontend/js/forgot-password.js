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

  const COOLDOWN_SECONDS = 60;
  const COOLDOWN_STORAGE_KEY = "forgotPasswordCooldownUntil";

  const forgotForm = document.getElementById("forgotForm");
  const emailInput = document.getElementById("email");
  const submitBtn =
    document.getElementById("forgotSubmitBtn") ||
    forgotForm?.querySelector('button[type="submit"]');
  const defaultSubmitBtnHtml = submitBtn?.innerHTML || "Send Reset Link";

  let isSubmitting = false;
  let cooldownTimer = null;

  function setSubmitButton(labelHtml, isDisabled, isLoading) {
    if (!submitBtn) return;

    submitBtn.innerHTML = labelHtml;
    submitBtn.disabled = isDisabled;
    submitBtn.classList.toggle("is-loading", isLoading);
    submitBtn.setAttribute("aria-busy", String(isLoading));
  }

  function stopCooldownTimer() {
    if (!cooldownTimer) return;
    clearInterval(cooldownTimer);
    cooldownTimer = null;
  }

  function setCooldownUi(expiresAt) {
    stopCooldownTimer();

    const render = () => {
      const remainingMs = expiresAt - Date.now();
      if (remainingMs <= 0) {
        stopCooldownTimer();
        localStorage.removeItem(COOLDOWN_STORAGE_KEY);
        if (!isSubmitting) setSubmitButton(defaultSubmitBtnHtml, false, false);
        return;
      }

      const remainingSec = Math.ceil(remainingMs / 1000);
      setSubmitButton(`Retry in ${remainingSec}s`, true, false);
    };

    render();
    cooldownTimer = setInterval(render, 250);
  }

  function startCooldown(seconds) {
    const safeSeconds = Math.max(1, Number(seconds) || COOLDOWN_SECONDS);
    const expiresAt = Date.now() + safeSeconds * 1000;

    localStorage.setItem(COOLDOWN_STORAGE_KEY, String(expiresAt));
    setCooldownUi(expiresAt);
  }

  function restoreCooldown() {
    const raw = localStorage.getItem(COOLDOWN_STORAGE_KEY);
    const expiresAt = Number(raw);

    if (!expiresAt || Number.isNaN(expiresAt)) {
      localStorage.removeItem(COOLDOWN_STORAGE_KEY);
      return;
    }

    if (expiresAt <= Date.now()) {
      localStorage.removeItem(COOLDOWN_STORAGE_KEY);
      return;
    }

    setCooldownUi(expiresAt);
  }

  forgotForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (submitBtn?.disabled) return;

    const email = (emailInput?.value || "").trim();
    if (!email) {
      if (typeof showToast === "function") showToast("Email is required.", "error");
      else alert("Email is required.");
      return;
    }

    isSubmitting = true;
    setSubmitButton('<span class="spinner" aria-hidden="true"></span>Sending...', true, true);

    try {
      const API_BASE = await getApiBase();
      const res = await fetch(`${API_BASE}/api/password/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));
      if (typeof showToast === "function") {
        showToast(data.message || data.error || "Request received", res.ok ? "info" : "error", 8000);
      } else {
        alert(data.message || data.error || "Request received");
      }

      if (res.ok) startCooldown(COOLDOWN_SECONDS);
    } catch (err) {
      if (typeof showToast === "function") showToast("Network error. Try again.", "error");
      else alert("Network error");
      setSubmitButton(defaultSubmitBtnHtml, false, false);
    } finally {
      isSubmitting = false;

      const cooldownUntil = Number(localStorage.getItem(COOLDOWN_STORAGE_KEY));
      if (!cooldownUntil || cooldownUntil <= Date.now()) {
        setSubmitButton(defaultSubmitBtnHtml, false, false);
      }
    }
  });

  restoreCooldown();
})();
