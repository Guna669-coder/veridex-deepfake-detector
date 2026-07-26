/* ═══════════════════════════════════════════
   VERIDEX — AUTH-NAV.JS
   Shared login-state nav rendering + route guard
═══════════════════════════════════════════ */

const AuthNav = (() => {
  // ── Fill #navAuth container based on login state ──
  function renderNav() {
    const el = document.getElementById('navAuth');
    if (!el) return;
    const user = API.auth.getUser();

    if (API.auth.isLoggedIn() && user) {
      const first = (user.name || 'USER').split(' ')[0].toUpperCase();
      el.innerHTML = `
        <span class="nav-user" title="${user.email}">👤 ${first}</span>
        ${user.role === 'admin' ? '<a href="admin.html" class="ibtn purple">⚙ ADMIN</a>' : ''}
        <button class="ibtn" id="navLogoutBtn" type="button">LOGOUT</button>`;
      const btn = document.getElementById('navLogoutBtn');
      if (btn) btn.addEventListener('click', doLogout);
    } else {
      el.innerHTML = `<a href="auth.html" class="ibtn primary">LOGIN</a>`;
    }
  }

  function doLogout() {
    API.auth.logout();
    if (typeof showToast === 'function') showToast('LOGGED OUT');
    setTimeout(() => { window.location.href = 'index.html'; }, 400);
  }

  // ── Call at top of protected pages (already redirected synchronously in <head>) ──
  function requireAuth() {
    if (!API.auth.isLoggedIn()) {
      const next = encodeURIComponent(location.pathname.split('/').pop() || 'engine.html');
      window.location.href = `auth.html?redirect=${next}`;
      return false;
    }
    return true;
  }

  document.addEventListener('DOMContentLoaded', renderNav);

  return { renderNav, requireAuth, doLogout };
})();

window.AuthNav = AuthNav;
