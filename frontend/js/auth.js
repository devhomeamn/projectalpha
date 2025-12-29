// 🔧 Load backend API URL from server (.env -> /api/config)
let API_BASE = '';

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    API_BASE = data.apiBase || window.location.origin;
    console.log('✅ API Base loaded:', API_BASE);
    initForms();
  } catch (err) {
    console.error('⚠️ Could not load backend config:', err);
    API_BASE = window.location.origin;
    initForms();
  }
}

// --------------------
// Smart & Modular Toast with SVG Icons
// --------------------
function showToast(message, type = 'info', duration = 5000) {
  const toastHost = document.getElementById('toastHost');
  if (!toastHost) return;

  const toast = document.createElement('div');
  toast.classList.add('toast', type);

  const icons = {
    success: `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `,
    error: `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    `,
    info: `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    `
  };

  const icon = icons[type] || icons.info;

  const titleMap = { success: 'Success', error: 'Error', info: 'Info' };
  const title = titleMap[type] || 'Info';

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <p class="t-title">${title}</p>
      <p class="t-msg">${message}</p>
    </div>
  `;

  toastHost.prepend(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

// --------------------
// Form handlers
// --------------------
function initForms() {
  // Login Form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;

      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (res.ok) {
          showToast('Login Successful!', 'success');

          // ✅ store everything needed for topbar dropdown
          localStorage.setItem('token', data.token);
          localStorage.setItem('role', data.user.role);
          localStorage.setItem('username', data.user.username);
          localStorage.setItem('name', data.user.name);

          // ✅ NEW: email + serviceid saved (from DB via login response)
          localStorage.setItem('email', data.user.email || '');
          localStorage.setItem('serviceid', String(data.user.serviceid ?? ''));

          const role = (data.user.role || "").toLowerCase();

          setTimeout(() => {
            window.location.href =
              (role === "admin" || role === "general")
                ? "dashboard.html"
                : "dashboard-user.html";
          }, 1000);
        } else {
          showToast(data.error || 'Login Failed', 'error');
        }
      } catch (err) {
        showToast('Network error. Please try again.', 'error');
      }
    });
  }

  // Register Form
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('name').value;
      const serviceid = document.getElementById('serviceid').value;
      const emailEl = document.getElementById('email');
      const email = emailEl ? emailEl.value.trim() : '';
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const role = document.getElementById('role').value;

      try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, serviceid, email, username, password, role }),
        });

        const data = await res.json();

        if (res.ok) {
          showToast('Registration Successful! Wait for admin approval.', 'success', 15000);
          setTimeout(() => {
            window.location.href = 'login.html';
          }, 15000);
        } else {
          showToast(data.error || 'Registration Failed', 'error');
        }
      } catch (err) {
        showToast('Network error. Please try again.', 'error');
      }
    });
  }
}

loadConfig();

/* ================== PASSWORD SHOW/HIDE (Login/Register) ================== */
(function initPasswordToggles() {
  function setIcon(btn, isShown) {
    const icon = btn.querySelector('i');
    if (!icon) return;
    icon.classList.toggle('fa-eye', !isShown);
    icon.classList.toggle('fa-eye-slash', isShown);
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-eye');
    if (!btn) return;

    const targetId = btn.getAttribute('data-target');
    if (!targetId) return;

    const input = document.getElementById(targetId);
    if (!input) return;

    const isShown = input.type === 'text';
    input.type = isShown ? 'password' : 'text';

    setIcon(btn, !isShown);

    try {
      const len = input.value.length;
      input.setSelectionRange(len, len);
      input.focus();
    } catch (_) {}
  });

  document.querySelectorAll('.toggle-eye[data-target]').forEach((btn) => {
    const targetId = btn.getAttribute('data-target');
    const input = targetId ? document.getElementById(targetId) : null;
    if (!input) return;
    setIcon(btn, input.type === 'text');
  });
})();
