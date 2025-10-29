// Role-based route protection for all pages
(function () {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  // 1️⃣ Check login status
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  // 2️⃣ Protect restricted pages
  const currentPage = window.location.pathname.split('/').pop();
  const restrictedPages = {
    'add-section.html': ['Admin', 'Master'],
    'approve-user.html': ['Admin']
  };

  // Check if page has restrictions
  if (restrictedPages[currentPage]) {
    const allowedRoles = restrictedPages[currentPage];
    if (!allowedRoles.includes(role)) {
      alert('Access Denied: You do not have permission to view this page.');
      window.location.href = 'dashboard.html';
      return;
    }
  }

  // 3️⃣ Optional: Hide restricted menus dynamically (safety check)
  document.addEventListener('DOMContentLoaded', () => {
    if (role === 'General') {
      const restrictedMenuItems = document.querySelectorAll(
        'li:contains("Add Section"), li:contains("Approve User")'
      );
      restrictedMenuItems.forEach(item => item.style.display = 'none');
    }
  });
})();
