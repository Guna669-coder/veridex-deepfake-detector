/* ═══════════════════════════════════════════
   VERIDEX — ADMIN.JS
   Platform overview, user management, scan management
═══════════════════════════════════════════ */

const AdminPanel = (() => {
  let usersPage = 1, scansPage = 1, scanFilter = '';
  let trendChart = null;
  const meId = () => API.auth.getUser()?.id;

  const isDark  = () => document.documentElement.dataset.theme !== 'light';
  const rc = (o=1) => isDark() ? `rgba(255,31,78,${o})`  : `rgba(200,0,50,${o})`;
  const gc = (o=1) => isDark() ? `rgba(0,255,136,${o})`  : `rgba(0,150,100,${o})`;
  const gridClr = () => isDark() ? 'rgba(0,210,255,0.07)' : 'rgba(0,100,180,0.09)';
  const textClr = () => isDark() ? 'rgba(197,221,245,0.5)' : 'rgba(13,30,56,0.5)';

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  // ── INIT — verify admin access first ──
  async function init() {
    try {
      await loadOverview();
      document.getElementById('adminPage').style.display = '';
      loadUsers(1);
      loadScans(1, '');
      document.getElementById('digestBtn').addEventListener('click', sendDigest);
    } catch (e) {
      document.getElementById('accessGate').style.display = 'block';
    }
  }

  // ── OVERVIEW + TREND ──
  async function loadOverview() {
    const { overview, recentScans } = await API.admin.overview();
    document.getElementById('aUsers').textContent = overview.totalUsers;
    document.getElementById('aScans').textContent = overview.totalScans;
    document.getElementById('aFakes').textContent = overview.totalFakes;
    document.getElementById('aReal').textContent  = overview.totalReal;
    document.getElementById('aConf').textContent  = overview.avgConf + '%';

    document.getElementById('recentScansBody').innerHTML = recentScans.map(s => `
      <tr>
        <td class="td-file">${s.user?.name || 'unknown'}</td>
        <td class="td-file">${s.fileName || '—'}</td>
        <td><span class="badge ${s.verdict==='DEEPFAKE'?'fake':'real'}">${s.verdict}</span></td>
        <td style="color:var(--muted2)">${fmtDate(s.createdAt)}</td>
      </tr>`).join('') || '<tr><td colspan="4" style="color:var(--muted2)">No scans yet</td></tr>';

    const { trend } = await API.admin.trend(7);
    buildTrendChart(trend);
  }

  function buildTrendChart(trend) {
    const byDate = {};
    trend.forEach(t => byDate[t._id] = t);
    const labels=[], fakeD=[], realD=[];
    for (let i=6; i>=0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = d.toISOString().slice(0,10);
      labels.push(`${d.getMonth()+1}/${d.getDate()}`);
      const e = byDate[key];
      fakeD.push(e ? e.fakes : 0);
      realD.push(e ? e.reals : 0);
    }
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(document.getElementById('adminTrendChart'), {
      type: 'bar',
      data: { labels, datasets: [
        { label:'DEEPFAKE',  data:fakeD, backgroundColor:rc(.7), borderColor:rc(1), borderWidth:1, borderRadius:1 },
        { label:'AUTHENTIC', data:realD, backgroundColor:gc(.5), borderColor:gc(1), borderWidth:1, borderRadius:1 },
      ]},
      options: {
        responsive: true,
        plugins: {
          legend: { display:true, labels:{ color:textClr(), font:{ family:'Share Tech Mono', size:10 } } },
          tooltip: { bodyFont:{ family:'Share Tech Mono', size:11 }, titleFont:{ family:'Bebas Neue', size:14 } },
        },
        scales: {
          x: { grid:{ color:gridClr() }, ticks:{ color:textClr(), font:{ family:'Share Tech Mono', size:10 } } },
          y: { grid:{ color:gridClr() }, ticks:{ color:textClr(), font:{ family:'Share Tech Mono', size:10 } } },
        },
      }
    });
  }

  async function sendDigest() {
    const btn = document.getElementById('digestBtn');
    btn.disabled = true; btn.textContent = 'SENDING...';
    try {
      const res = await API.admin.sendDigest();
      showToast(res.message || 'DIGEST SENT');
    } catch (e) {
      showToast('⚠ DIGEST FAILED — ' + (e.message || ''));
    }
    btn.disabled = false; btn.textContent = '✉ SEND WEEKLY DIGEST';
  }

  // ── USERS ──
  async function loadUsers(page) {
    usersPage = page;
    const { users, pagination } = await API.admin.users(page);
    document.getElementById('usersBody').innerHTML = users.map(u => `
      <tr>
        <td>${u.name}</td>
        <td class="td-file">${u.email}</td>
        <td>
          <select class="role-select" data-id="${u._id}" ${u._id===meId()?'disabled':''}>
            <option value="user"  ${u.role==='user' ?'selected':''}>USER</option>
            <option value="admin" ${u.role==='admin'?'selected':''}>ADMIN</option>
          </select>
        </td>
        <td>${u.stats?.totalScans ?? 0}</td>
        <td style="color:var(--muted2)">${fmtDate(u.createdAt)}</td>
        <td class="row-actions">
          <button class="icon-del" data-id="${u._id}" ${u._id===meId()?'disabled title="Cannot delete yourself"':''}>DELETE</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="6" style="color:var(--muted2)">No users found</td></tr>';

    document.querySelectorAll('#usersBody .role-select').forEach(sel => {
      sel.addEventListener('change', () => updateRole(sel.dataset.id, sel.value));
    });
    document.querySelectorAll('#usersBody .icon-del').forEach(btn => {
      btn.addEventListener('click', () => deleteUser(btn.dataset.id));
    });

    renderPager('usersPager', pagination, loadUsers);
  }

  async function updateRole(id, role) {
    try {
      await API.admin.updateRole(id, role);
      showToast(`ROLE UPDATED — NOW ${role.toUpperCase()}`);
    } catch (e) {
      showToast('⚠ ROLE UPDATE FAILED');
      loadUsers(usersPage);
    }
  }

  async function deleteUser(id) {
    if (!confirm('Delete this user and all their scans? This cannot be undone.')) return;
    try {
      await API.admin.deleteUser(id);
      showToast('USER DELETED');
      loadUsers(usersPage);
      loadOverview();
    } catch (e) {
      showToast('⚠ DELETE FAILED — ' + (e.message || ''));
    }
  }

  // ── SCANS ──
  async function loadScans(page, verdict) {
    scansPage = page; scanFilter = verdict;
    const { scans, pagination } = await API.admin.allScans(page, verdict);
    document.getElementById('scansBody').innerHTML = scans.map(s => `
      <tr>
        <td>${s.user?.name || 'unknown'}</td>
        <td class="td-file">${s.fileName || '—'}</td>
        <td><span class="badge ${s.isFake?'fake':'real'}">${s.verdict}</span></td>
        <td style="color:${s.isFake?'var(--c2)':'var(--c3)'}">${(s.fakeConf||0).toFixed(1)}%</td>
        <td style="color:var(--muted2)">${fmtDate(s.createdAt)}</td>
      </tr>`).join('') || '<tr><td colspan="5" style="color:var(--muted2)">No scans found</td></tr>';

    renderPager('scansPager', pagination, (p) => loadScans(p, scanFilter));
  }

  function setScanFilter(v, btn) {
    document.querySelectorAll('#adminPage .filter-bar .fchip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    loadScans(1, v);
  }

  // ── PAGINATION ──
  function renderPager(elId, pagination, onPage) {
    const el = document.getElementById(elId);
    if (!pagination || pagination.pages <= 1) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <button id="${elId}Prev" ${pagination.page<=1?'disabled':''}>← PREV</button>
      <span>PAGE ${pagination.page} / ${pagination.pages}</span>
      <button id="${elId}Next" ${pagination.page>=pagination.pages?'disabled':''}>NEXT →</button>`;
    const prev = document.getElementById(`${elId}Prev`);
    const next = document.getElementById(`${elId}Next`);
    if (prev) prev.addEventListener('click', () => onPage(pagination.page - 1));
    if (next) next.addEventListener('click', () => onPage(pagination.page + 1));
  }

  return { init, setScanFilter };
})();

window.AdminPanel = AdminPanel;
document.addEventListener('DOMContentLoaded', () => AdminPanel.init());
