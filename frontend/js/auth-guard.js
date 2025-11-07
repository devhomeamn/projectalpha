// ✅ Role-based route protection for all pages
(function () {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  // 🚫 Hide body immediately (prevent flash of content)
  document.documentElement.style.display = 'none';

  // 1️⃣ Check login status
  if (!token) {
    window.location.replace('login.html');
    return;
  }

  // 2️⃣ Define restricted pages
  const currentPage = window.location.pathname.split('/').pop();
  const restrictedPages = {
    'add-section.html': ['Admin', 'Master'],
    'approve-user.html': ['Admin'],
    'all-users.html': ['Admin'],
  };

  // 3️⃣ Access control check
  if (restrictedPages[currentPage]) {
    const allowedRoles = restrictedPages[currentPage];
    if (!allowedRoles.includes(role)) {
      alert('Access Denied: You do not have permission to view this page.');
      window.location.replace('dashboard.html');
      return;
    }
  }

  // 4️⃣ Unhide page for authorized users
  document.documentElement.style.display = '';

  // 5️⃣ Optional: Hide restricted menu items dynamically
  document.addEventListener('DOMContentLoaded', () => {
    if (role === 'General') {
      document.querySelectorAll('li:contains("Add Section"), li:contains("Approve Users")')
        .forEach(item => (item.style.display = 'none'));
    }
  });
})();
