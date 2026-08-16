// utils.js — small shared helpers, no dependencies on other modules.
const Utils = (() => {
  function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function daysBetween(a, b) {
    const d1 = new Date(a + 'T00:00:00');
    const d2 = new Date(b + 'T00:00:00');
    return Math.round((d2 - d1) / 86400000);
  }

  function formatDate(dateStr, opts = {}) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...opts });
  }

  function formatDateShort(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function isOverdue(dateStr, status) {
    if (!dateStr || status === 'Done') return false;
    return dateStr < todayISO();
  }

  function isToday(dateStr) {
    return dateStr === todayISO();
  }

  function isUpcoming(dateStr, withinDays = 7) {
    if (!dateStr) return false;
    const diff = daysBetween(todayISO(), dateStr);
    return diff > 0 && diff <= withinDays;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function debounce(fn, wait = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }
  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function fileSizeLabel(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function weekRange(dateStr = todayISO()) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay(); // 0 sun .. 6 sat
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = addDays(d.toISOString().slice(0, 10), mondayOffset);
    const end = addDays(start, 6);
    return { start, end };
  }

  function monthRange(dateStr = todayISO()) {
    const d = new Date(dateStr + 'T00:00:00');
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  }

  function nextWeekday(fromDateStr, weekday) {
    // weekday: 0=Sun..6=Sat, returns next date on/after fromDateStr matching weekday
    let d = fromDateStr;
    for (let i = 0; i < 7; i++) {
      const dow = new Date(d + 'T00:00:00').getDay();
      if (dow === weekday) return d;
      d = addDays(d, 1);
    }
    return d;
  }

  function statusClass(status) {
    return 'status-' + String(status).toLowerCase().replace(/\s+/g, '-');
  }
  function statusBadge(status) {
    return `<span class="badge ${statusClass(status)}">${escapeHtml(status)}</span>`;
  }
  function priorityBadge(priority) {
    return `<span class="badge priority-${String(priority).toLowerCase()}">${escapeHtml(priority)}</span>`;
  }
  function avatarHtml(user, size = '') {
    if (!user) return `<span class="avatar avatar-empty ${size}">?</span>`;
    return `<span class="avatar ${size}" style="background:${user.color}" title="${escapeHtml(user.name)}">${user.initials}</span>`;
  }
  function avatarGroupHtml(users, size = '') {
    if (!users || !users.length) return `<span class="avatar avatar-empty ${size}">–</span>`;
    return `<span class="avatar-group">${users.map((u) => avatarHtml(u, size)).join('')}</span>`;
  }

  return {
    uid, todayISO, addDays, daysBetween, formatDate, formatDateShort,
    isOverdue, isToday, isUpcoming, escapeHtml, initials, debounce,
    qs, qsa, readFileAsDataURL, fileSizeLabel, weekRange, monthRange, nextWeekday,
    statusClass, statusBadge, priorityBadge, avatarHtml, avatarGroupHtml,
  };
})();
