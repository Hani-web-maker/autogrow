// app.js — application shell: sidebar, topbar, global search, notifications,
// and the boot sequence (onboarding → login gate → normal app).
const App = (() => {
  const NAV = [
    { path: '/dashboard', label: 'Dashboard', icon: 'grid' },
    { path: '/clients', label: 'Clients', icon: 'briefcase' },
    { path: '/projects', label: 'Projects', icon: 'folder' },
    { path: '/my-tasks', label: 'My Tasks', icon: 'check' },
    { path: '/keywords', label: 'Keyword Tracker', icon: 'trend' },
    { path: '/content-calendar', label: 'Content Calendar', icon: 'calendar' },
    { path: '/backlinks', label: 'Backlinks', icon: 'link' },
    { path: '/reports', label: 'Reports', icon: 'file' },
    { path: '/team', label: 'Team', icon: 'users' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];

  const ICONS = {
    grid: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
    briefcase: '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2"/><circle cx="18" cy="9" r="3"/><path d="M17 14a5 5 0 0 1 5 5v2"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  };

  function icon(name, cls = '') {
    return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  }

  function renderShell() {
    const root = document.getElementById('app-root');
    root.innerHTML = `
      <div class="app-shell">
        <div class="sidebar-scrim" id="sidebar-scrim" hidden></div>
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-brand">${Brand.sidebarBrandHtml()}</div>
          <nav class="sidebar-nav" id="sidebar-nav">
            ${NAV.map((n) => `
              <a href="#${n.path}" class="nav-item" data-path="${n.path}">
                ${icon(n.icon)}<span>${n.label}</span>
              </a>`).join('')}
          </nav>
          <div class="sidebar-footer">
            <div class="user-switcher">
              <label for="user-switcher-select">Viewing as</label>
              <select id="user-switcher-select" aria-label="Switch current user"></select>
            </div>
            ${Auth.isConfigured() ? `<button class="link-btn sidebar-logout" id="logout-btn">${icon('logout', 'icon-sm')} Sign out</button>` : ''}
          </div>
        </aside>
        <div class="main-col">
          <header class="topbar">
            <button class="icon-btn hamburger-btn" id="hamburger-btn" aria-label="Toggle navigation menu" aria-expanded="false">
              ${icon('menu')}
            </button>
            <div class="topbar-search">
              ${icon('search')}
              <input type="text" id="global-search" placeholder="Search clients, projects, tasks…" autocomplete="off" aria-label="Global search" />
              <div class="search-results" id="search-results"></div>
            </div>
            <div class="topbar-actions">
              <button class="icon-btn" id="notif-btn" title="Notifications" aria-label="Notifications" aria-haspopup="true">
                ${icon('bell')}<span class="notif-dot" id="notif-dot" hidden></span>
              </button>
              <div class="notif-panel" id="notif-panel" hidden></div>
            </div>
          </header>
          <div class="content-banner" id="content-banner"></div>
          <main id="view-outlet" class="view-outlet"></main>
        </div>
      </div>
    `;

    bindUserSwitcher();
    bindSearch();
    bindNotifications();
    bindSidebarToggle();
    bindLogout();
    renderBanner();
  }

  function bindSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('sidebar-scrim');
    const btn = document.getElementById('hamburger-btn');
    const close = () => { sidebar.classList.remove('open'); scrim.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', () => {
      const willOpen = !sidebar.classList.contains('open');
      sidebar.classList.toggle('open', willOpen);
      scrim.hidden = !willOpen;
      btn.setAttribute('aria-expanded', String(willOpen));
    });
    scrim.addEventListener('click', close);
    Utils.qsa('.nav-item', document.getElementById('sidebar-nav')).forEach((a) => a.addEventListener('click', close));
  }

  function bindLogout() {
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      Auth.logout();
      Toast.info('Signed out');
      boot();
    });
  }

  function setActiveNav(path) {
    Utils.qsa('.nav-item').forEach((el) => {
      const base = '/' + path.split('/')[1];
      el.classList.toggle('active', el.dataset.path === base);
    });
  }

  function bindUserSwitcher() {
    const sel = document.getElementById('user-switcher-select');
    const team = DB.all('team');
    const user = DB.currentUser();
    sel.innerHTML = team.map((u) => `<option value="${u.id}">${Utils.escapeHtml(u.name)}</option>`).join('');
    if (user) sel.value = user.id;
    sel.addEventListener('change', () => {
      DB.setCurrentUser(sel.value);
      Toast.info(`Now viewing as ${DB.get('team', sel.value).name}`);
      Router.render();
    });
  }

  function bindSearch() {
    const input = document.getElementById('global-search');
    const results = document.getElementById('search-results');
    const run = Utils.debounce((q) => {
      if (!q.trim()) { results.classList.remove('open'); results.innerHTML = ''; return; }
      const hits = globalSearch(q.trim().toLowerCase());
      renderSearchResults(hits, results);
    }, 180);
    input.addEventListener('input', () => run(input.value));
    input.addEventListener('focus', () => { if (input.value.trim()) results.classList.add('open'); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.topbar-search')) results.classList.remove('open');
    });
  }

  function globalSearch(q) {
    const hits = [];
    DB.all('clients').forEach((c) => {
      if (c.name.toLowerCase().includes(q)) hits.push({ type: 'Client', label: c.name, href: `#/clients/${c.id}` });
    });
    DB.all('projects').forEach((p) => {
      if (p.name.toLowerCase().includes(q)) hits.push({ type: 'Project', label: p.name, href: `#/projects/${p.id}` });
    });
    DB.all('tasks').forEach((t) => {
      if (!t.recurrence && t.title.toLowerCase().includes(q)) hits.push({ type: 'Task', label: t.title, href: `#/projects/${t.projectId}?task=${t.id}` });
    });
    return hits.slice(0, 12);
  }

  function renderSearchResults(hits, container) {
    if (!hits.length) {
      container.innerHTML = `<div class="search-empty">No matches</div>`;
    } else {
      container.innerHTML = hits.map((h) => `
        <a class="search-hit" href="${h.href}">
          <span class="search-hit-type">${h.type}</span>
          <span class="search-hit-label">${Utils.escapeHtml(h.label)}</span>
        </a>`).join('');
    }
    container.classList.add('open');
    Utils.qsa('.search-hit', container).forEach((a) => {
      a.addEventListener('click', () => { container.classList.remove('open'); document.getElementById('global-search').value = ''; });
    });
  }

  function bindNotifications() {
    const btn = document.getElementById('notif-btn');
    const panel = document.getElementById('notif-panel');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panel.hidden) {
        renderNotifPanel(panel);
        panel.hidden = false;
      } else {
        panel.hidden = true;
      }
    });
    document.addEventListener('click', (e) => {
      if (!panel.hidden && !e.target.closest('.notif-panel') && !e.target.closest('#notif-btn')) panel.hidden = true;
    });
    updateNotifDot();
  }

  function renderNotifPanel(panel) {
    const activity = [...DB.all('activity')].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 25);
    panel.innerHTML = `
      <div class="notif-panel-header">
        <strong>Notifications</strong>
        <button class="link-btn" id="mark-all-read">Mark all read</button>
      </div>
      <div class="notif-list">
        ${activity.length ? activity.map((a) => `
          <div class="notif-item ${a.read ? '' : 'unread'}">
            <span class="notif-type notif-type-${a.type}"></span>
            <div>
              <div class="notif-text">${Utils.escapeHtml(a.text)}</div>
              <div class="notif-time">${timeAgo(a.createdAt)}</div>
            </div>
          </div>`).join('') : '<div class="notif-empty">No activity yet.</div>'}
      </div>`;
    document.getElementById('mark-all-read').addEventListener('click', () => {
      DB.all('activity').forEach((a) => { a.read = true; });
      DB.save();
      updateNotifDot();
      renderNotifPanel(panel);
    });
  }

  function updateNotifDot() {
    const hasUnread = DB.all('activity').some((a) => !a.read);
    const dot = document.getElementById('notif-dot');
    if (dot) dot.hidden = !hasUnread;
  }

  function renderBanner() {
    const banner = document.getElementById('content-banner');
    if (!banner) return;
    const draftReports = DB.all('reports').filter((r) => r.status === 'draft');
    if (!draftReports.length) { banner.innerHTML = ''; return; }
    const names = draftReports.map((r) => DB.get('clients', r.clientId)?.name).filter(Boolean);
    banner.innerHTML = `
      <div class="banner">
        ${icon('bell')}
        <span>${draftReports.length} report draft${draftReports.length > 1 ? 's' : ''} ready for review: ${Utils.escapeHtml(names.join(', '))}.</span>
        <a href="#/reports" class="banner-link">Open Reports →</a>
        <button class="banner-dismiss" id="banner-dismiss" aria-label="Dismiss">&times;</button>
      </div>`;
    document.getElementById('banner-dismiss').addEventListener('click', () => { banner.innerHTML = ''; });
  }

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  function refreshChrome() {
    updateNotifDot();
    renderBanner();
  }

  /** Full boot sequence: onboarding (if empty) → login gate (if configured) → app shell. */
  function boot() {
    DB.init();
    if (!DB.settings().onboarded) {
      Onboarding.render(boot);
      return;
    }
    if (Auth.isConfigured() && !Auth.isAuthenticated()) {
      Auth.renderLogin({ onSuccess: boot });
      return;
    }
    Auth.armActivityListener();
    Auth.startSessionWatcher(boot);
    renderShell();
    Router.start();
  }

  function init() {
    boot();
  }

  return { init, boot, icon, setActiveNav, refreshChrome, timeAgo };
})();

document.addEventListener('DOMContentLoaded', App.init);
