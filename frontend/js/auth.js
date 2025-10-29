// 🔧 Load backend API URL from server (.env -> /api/config)
let API_BASE = '';

async function loadConfig() {
  try {
    const res = await fetch('/api/config'); // backend route that sends API_BASE
    const data = await res.json();
    API_BASE = data.apiBase || window.location.origin; // fallback
    console.log('✅ API Base loaded:', API_BASE);
    initForms(); // initialize event listeners after config is loaded
  } catch (err) {
    console.error('⚠️ Could not load backend config:', err);
    API_BASE = window.location.origin;
    initForms();
  }
}

loadConfig();

// --------------------
// All form handlers inside a function
// --------------------
function initForms() {
  // 🔹 Login Form Handler
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;

      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      const message = document.getElementById('message');

      if (res.ok) {
        message.style.color = 'green';
        message.innerText = '✅ Login Successful!';

        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.user.role);
        localStorage.setItem('username', data.user.username);
        localStorage.setItem('name', data.user.name);

        setTimeout(() => (window.location.href = 'dashboard.html'), 1000);
      } else {
        message.innerText = data.error || '❌ Login Failed';
      }
    });
  }

  // 🔹 Register Form Handler
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('name').value;
      const serviceid = document.getElementById('serviceid').value;
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const role = document.getElementById('role').value;

      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, serviceid, username, password, role }),
      });

      const data = await res.json();
      const message = document.getElementById('message');

      if (res.ok) {
        message.style.color = 'green';
        message.innerText = '✅ Registration Successful!';
        setTimeout(() => (window.location.href = 'login.html'), 1500);
      } else {
        message.innerText = data.error || '❌ Registration Failed';
      }
    });
  }
}
