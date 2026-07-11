/* ═══════════════════════════════════════════
   VERIDEX — JS/API.JS
   Frontend API client — connects to backend
═══════════════════════════════════════════ */

const API = (() => {
  // ── Change this to your Railway URL after deploying ──
  const BASE_URL = 'https://veridex-backend.up.railway.app/api';
  // For local dev use: const BASE_URL = 'http://localhost:5000/api';

  // ── Get stored token ──
  const getToken = () => localStorage.getItem('vx_token');

  // ── Base fetch with auth header ──
  const request = async (method, endpoint, body = null) => {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    const res  = await fetch(`${BASE_URL}${endpoint}`, config);
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'API error');
    return data;
  };

  // ── AUTH ──
  const auth = {
    register: (name, email, password) =>
      request('POST', '/auth/register', { name, email, password }),

    login: async (email, password) => {
      const data = await request('POST', '/auth/login', { email, password });
      if (data.token) {
        localStorage.setItem('vx_token', data.token);
        localStorage.setItem('vx_user',  JSON.stringify(data.user));
      }
      return data;
    },

    logout: () => {
      localStorage.removeItem('vx_token');
      localStorage.removeItem('vx_user');
    },

    getMe: () => request('GET', '/auth/me'),

    updateWeights: (weights) => request('PUT', '/auth/weights', { weights }),

    forgotPassword: (email) => request('POST', '/auth/forgot-password', { email }),

    resetPassword: (token, password) => request('POST', `/auth/reset-password/${token}`, { password }),

    isLoggedIn: () => !!getToken(),

    getUser: () => {
      try { return JSON.parse(localStorage.getItem('vx_user')); }
      catch(e) { return null; }
    },
  };

  // ── SCANS ──
  const scans = {
    save: (scanData) => request('POST', '/scans', scanData),

    list: (page = 1, limit = 20, verdict = '') =>
      request('GET', `/scans?page=${page}&limit=${limit}${verdict?`&verdict=${verdict}`:''}`),

    get: (id) => request('GET', `/scans/${id}`),

    feedback: (id, wasCorrect) => request('POST', `/scans/${id}/feedback`, { wasCorrect }),

    stats: () => request('GET', '/scans/stats'),

    delete: (id) => request('DELETE', `/scans/${id}`),
  };

  // ── ADMIN ──
  const admin = {
    overview:   ()           => request('GET',    '/admin/overview'),
    users:      (page=1)     => request('GET',    `/admin/users?page=${page}`),
    allScans:   (page=1, v='') => request('GET',  `/admin/scans?page=${page}${v?`&verdict=${v}`:''}`),
    trend:      (days=7)     => request('GET',    `/admin/trend?days=${days}`),
    updateRole: (id, role)   => request('PUT',    `/admin/users/${id}/role`, { role }),
    deleteUser: (id)         => request('DELETE', `/admin/users/${id}`),
    sendDigest: ()           => request('POST',   '/admin/digest'),
  };

  return { auth, scans, admin, getToken };
})();

window.API = API;
