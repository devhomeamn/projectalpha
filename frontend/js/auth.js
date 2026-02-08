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

/* ================== TOKEN HELPERS ================== */
function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return {};
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function persistUserSession(data) {
  // ✅ Token
  if (data?.token) localStorage.setItem('token', data.token);

  // ✅ User fields from response
  const u = data?.user || {};
  if (u.role !== undefined) localStorage.setItem('role', u.role || '');
  if (u.username !== undefined) localStorage.setItem('username', u.username || '');
  if (u.name !== undefined) localStorage.setItem('name', u.name || '');
  if (u.email !== undefined) localStorage.setItem('email', u.email || '');
  if (u.serviceid !== undefined) localStorage.setItem('serviceid', String(u.serviceid ?? ''));

  // ✅ NEW: section_id save (important for General profile assigned section)
  if (u.section_id !== undefined && u.section_id !== null) {
    localStorage.setItem('section_id', String(u.section_id));
  } else {
    // keep existing if any
    if (!localStorage.getItem('section_id')) localStorage.setItem('section_id', '');
  }

  // ✅ Fallback: decode token if section_id/role missing in response
  const token = localStorage.getItem('token') || '';
  if (token) {
    const p = decodeJwtPayload(token);

    // role fallback
    if (!localStorage.getItem('role') && p.role) {
      localStorage.setItem('role', String(p.role));
    }

    // section_id fallback (support both keys)
    const sid = p.section_id ?? p.sectionId;
    if ((!localStorage.getItem('section_id') || localStorage.getItem('section_id') === '') && sid != null) {
      localStorage.setItem('section_id', String(sid));
    }
  }
}

function isTokenValid(token) {
  if (!token) return false;
  try {
    const p = decodeJwtPayload(token);
    // If no exp, treat as present/valid (legacy)
    if (!p.exp) return true;
    return Number(p.exp) * 1000 > Date.now();
  } catch {
    return false;
  }
}

function redirectIfAlreadyLoggedIn() {
  const token = localStorage.getItem('token') || '';
  if (!isTokenValid(token)) return;

  const isLoginPage = !!document.getElementById('loginForm');
  const isRegisterPage = !!document.getElementById('registerForm');

  if (isLoginPage || isRegisterPage) {
    window.location.replace('dashboard.html');
  }
}

// --------------------
// Form handlers
// --------------------
function setRegisterLoading(isLoading) {
  const btn = document.getElementById('registerBtn');
  if (!btn) return;

  btn.classList.toggle('is-loading', isLoading);
  btn.disabled = isLoading;

  // prefer span.btn-text, fallback to button itself
  const textHost = btn.querySelector('.btn-text') || btn;

  if (isLoading) {
    textHost.innerHTML = `<span class="spinner"></span>Creating account...`;
  } else {
    // if already success-marked, don't overwrite
    if (textHost.textContent.trim() !== 'Registered ✅') {
      textHost.textContent = 'Register';
    }
  }
}

function initForms() {
  // ✅ If already logged in, keep user away from auth pages
  redirectIfAlreadyLoggedIn();

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

          // ✅ store everything needed for topbar dropdown + profile section
          persistUserSession(data);

          // ✅ Reset idle timer + clear cross-tab logout signal to avoid immediate logout on first login
          localStorage.setItem('last_active_ts', String(Date.now()));
          localStorage.removeItem('logout_signal_ts');

          const role = (data?.user?.role || localStorage.getItem('role') || "").toLowerCase();

          setTimeout(() => {
            // (আপনার আগের redirect logic same রাখা হলো)
            window.location.href =
              (role === "admin" || role === "general" || role === "master")
                ? "dashboard.html"
                : "dashboard.html";
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
    const serviceIdEl = document.getElementById('serviceid');
    const usernameEl = document.getElementById('username');
    const passEl = document.getElementById('password');
    const confirmEl = document.getElementById('confirmPassword');

    // Live sanitize: username থেকে spaces remove
    if (usernameEl && !usernameEl.dataset.noSpaceBound) {
      usernameEl.dataset.noSpaceBound = "1";
      usernameEl.addEventListener('input', () => {
        const cleaned = usernameEl.value.replace(/\s+/g, '');
        if (cleaned !== usernameEl.value) usernameEl.value = cleaned;
      });
    }

    // Live sanitize: service id থেকে non-digits remove
    if (serviceIdEl && !serviceIdEl.dataset.onlyNumBound) {
      serviceIdEl.dataset.onlyNumBound = "1";
      serviceIdEl.addEventListener('input', () => {
        const cleaned = serviceIdEl.value.replace(/\D+/g, '');
        if (cleaned !== serviceIdEl.value) serviceIdEl.value = cleaned;
      });
    }

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('name')?.value || '';
      const serviceid = (serviceIdEl ? serviceIdEl.value : document.getElementById('serviceid')?.value || '').trim();

      const emailEl = document.getElementById('email');
      const email = emailEl ? emailEl.value.trim() : '';

      const usernameRaw = (usernameEl ? usernameEl.value : document.getElementById('username')?.value || '');
      const username = (usernameRaw || '').trim();

      const password = (passEl ? passEl.value : document.getElementById('password')?.value || '');
      const confirmPassword = (confirmEl ? confirmEl.value : '');

      // ✅ Validations (before loading)
      if (/\s/.test(username)) {
        showToast('Username must not contain spaces.', 'error');
        return;
      }

      if (!/^\d+$/.test(serviceid)) {
        showToast('Service ID must be numbers only.', 'error');
        return;
      }

      if (!confirmEl) {
        showToast('Confirm Password field not found. Please add it to register.html', 'error');
        return;
      }

      if (password !== confirmPassword) {
        showToast('Password and Confirm Password do not match.', 'error');
        return;
      }

      setRegisterLoading(true);

      try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, serviceid, email, username, password }),
        });

        const data = await res.json();

        if (res.ok) {
          showToast('Registration Successful! Wait for admin approval.', 'success', 15000);

          const btn = document.getElementById('registerBtn');
          if (btn) {
            btn.disabled = true;
            btn.classList.remove('is-loading');

            // IMPORTANT: innerHTML replace করবো না, span.btn-text structure intact রাখবো
            const textHost = btn.querySelector('.btn-text') || btn;
            textHost.textContent = 'Registered ✅';
          }

          setTimeout(() => {
            window.location.href = 'login.html';
          }, 15000);
        } else {
          showToast(data.error || 'Registration Failed', 'error');
          setRegisterLoading(false);
        }
      } catch (err) {
        showToast('Network error. Please try again.', 'error');
        setRegisterLoading(false);
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
    } catch (_) { }
  });

  document.querySelectorAll('.toggle-eye[data-target]').forEach((btn) => {
    const targetId = btn.getAttribute('data-target');
    const input = targetId ? document.getElementById(targetId) : null;
    if (!input) return;
    setIcon(btn, input.type === 'text');
  });
})();
