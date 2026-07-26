/* ═══════════════════════════════════════════
   VERIDEX — AUTH-PAGE.JS
   Login / register form handling
═══════════════════════════════════════════ */

(() => {
  const tabLogin    = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const loginForm   = document.getElementById('loginForm');
  const registerForm= document.getElementById('registerForm');
  const errEl       = document.getElementById('formError');
  const okEl        = document.getElementById('formSuccess');

  function clearMsgs() {
    errEl.classList.remove('on'); errEl.textContent = '';
    okEl.classList.remove('on');  okEl.textContent  = '';
  }
  function showError(msg) { clearMsgs(); errEl.textContent = msg; errEl.classList.add('on'); }
  function showOk(msg)    { clearMsgs(); okEl.textContent  = msg; okEl.classList.add('on'); }

  function switchTab(tab) {
    clearMsgs();
    const toLogin = tab === 'login';
    tabLogin.classList.toggle('active', toLogin);
    tabRegister.classList.toggle('active', !toLogin);
    loginForm.classList.toggle('hidden', !toLogin);
    registerForm.classList.toggle('hidden', toLogin);
  }
  tabLogin.addEventListener('click', () => switchTab('login'));
  tabRegister.addEventListener('click', () => switchTab('register'));

  function redirectAfterAuth() {
    const params = new URLSearchParams(location.search);
    window.location.href = params.get('redirect') || 'engine.html';
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMsgs();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = 'SIGNING IN...';
    try {
      await API.auth.login(
        document.getElementById('loginEmail').value.trim(),
        document.getElementById('loginPassword').value
      );
      showOk('✓ SIGNED IN — REDIRECTING...');
      setTimeout(redirectAfterAuth, 500);
    } catch (err) {
      showError(err.message || 'Login failed');
      btn.disabled = false; btn.textContent = 'SIGN IN →';
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMsgs();
    const btn = document.getElementById('registerBtn');
    btn.disabled = true; btn.textContent = 'CREATING ACCOUNT...';
    try {
      await API.auth.register(
        document.getElementById('regName').value.trim(),
        document.getElementById('regEmail').value.trim(),
        document.getElementById('regPassword').value
      );
      showOk('✓ ACCOUNT CREATED — CHECK YOUR EMAIL TO VERIFY. REDIRECTING...');
      setTimeout(redirectAfterAuth, 900);
    } catch (err) {
      showError(err.message || 'Registration failed');
      btn.disabled = false; btn.textContent = 'CREATE ACCOUNT →';
    }
  });
})();
