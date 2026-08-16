// views/contentCalendar.js — editorial content calendar: standalone page + reusable section.
(() => {
  const STATUSES = ['Idea', 'Outline', 'Draft', 'Review', 'Published'];

  function render() {
    const outlet = document.getElementById('view-outlet');
    outlet.innerHTML = `
      <div class="view-header">
        <div><h1>Content Calendar</h1><p class="view-subtitle">Editorial pipeline for blog posts &amp; pages</p></div>
      </div>
      <div id="cc-section"></div>
    `;
    renderSection(document.getElementById('cc-section'), {}, { showClientFilter: true });
  }

  function renderSection(container, scope, opts = {}) {
    const clients = DB.all('clients');
    const team = DB.all('team');
    let cursor = Utils.monthRange().start; // first of current month
    let mode = 'calendar';

    container.innerHTML = `
      <div class="toolbar">
        ${opts.showClientFilter ? `<select id="cc-client-filter" class="input"><option value="">All clients</option>${clients.map((c) => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('')}</select>` : ''}
        <select id="cc-status-filter" class="input"><option value="">All statuses</option>${STATUSES.map((s) => `<option>${s}</option>`).join('')}</select>
        <select id="cc-writer-filter" class="input"><option value="">All writers</option>${team.map((u) => `<option value="${u.id}">${Utils.escapeHtml(u.name)}</option>`).join('')}</select>
        <div class="toolbar-spacer"></div>
        <div class="view-toggle">
          <button class="toggle-btn active" data-mode="calendar">Calendar</button>
          <button class="toggle-btn" data-mode="list">List</button>
        </div>
        <button class="btn btn-primary" id="cc-add-btn">+ New Content</button>
      </div>
      <div class="cal-nav">
        <button class="icon-btn" id="cc-prev" aria-label="Previous month">‹</button>
        <span id="cc-month-label" class="cal-month-label"></span>
        <button class="icon-btn" id="cc-next" aria-label="Next month">›</button>
        <button class="link-btn" id="cc-today">Today</button>
      </div>
      <div id="cc-body"></div>
    `;

    const clientFilter = Utils.qs('#cc-client-filter', container);
    const statusFilter = Utils.qs('#cc-status-filter', container);
    const writerFilter = Utils.qs('#cc-writer-filter', container);

    const getFilter = () => ({
      clientId: scope.clientId || (clientFilter ? clientFilter.value : ''),
      projectId: scope.projectId,
      status: statusFilter.value,
      writerId: writerFilter.value,
    });

    const run = () => {
      if (mode === 'calendar') renderCalendar(container, cursor, getFilter());
      else renderListMode(container, getFilter());
      Utils.qs('#cc-month-label', container).textContent = new Date(cursor + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    clientFilter?.addEventListener('change', run);
    statusFilter.addEventListener('change', run);
    writerFilter.addEventListener('change', run);
    Utils.qs('#cc-prev', container).addEventListener('click', () => { cursor = shiftMonth(cursor, -1); run(); });
    Utils.qs('#cc-next', container).addEventListener('click', () => { cursor = shiftMonth(cursor, 1); run(); });
    Utils.qs('#cc-today', container).addEventListener('click', () => { cursor = Utils.monthRange().start; run(); });
    Utils.qsa('.toggle-btn', container).forEach((b) => b.addEventListener('click', () => {
      mode = b.dataset.mode;
      Utils.qsa('.toggle-btn', container).forEach((x) => x.classList.toggle('active', x === b));
      run();
    }));
    Utils.qs('#cc-add-btn', container).addEventListener('click', () => openContentForm(null, scope, run));

    run();
  }

  function shiftMonth(dateStr, delta) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setMonth(d.getMonth() + delta);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }

  function filterItems(filter) {
    let items = DB.all('contentItems');
    if (filter.projectId) items = items.filter((c) => c.projectId === filter.projectId);
    if (filter.clientId) items = items.filter((c) => c.clientId === filter.clientId);
    if (filter.status) items = items.filter((c) => c.status === filter.status);
    if (filter.writerId) items = items.filter((c) => c.writerId === filter.writerId);
    return items;
  }

  function renderCalendar(container, monthStart, filter) {
    const body = Utils.qs('#cc-body', container);
    const items = filterItems(filter);
    const d = new Date(monthStart + 'T00:00:00');
    const year = d.getFullYear(), month = d.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    while (cells.length % 7 !== 0) cells.push(null);

    body.innerHTML = `
      <div class="cal-grid">
        ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d2) => `<div class="cal-dow">${d2}</div>`).join('')}
        ${cells.map((dateStr) => {
          if (!dateStr) return `<div class="cal-cell cal-cell-empty"></div>`;
          const dayItems = items.filter((c) => c.publishDate === dateStr);
          const isToday = dateStr === Utils.todayISO();
          return `
          <div class="cal-cell ${isToday ? 'cal-cell-today' : ''}">
            <div class="cal-daynum">${Number(dateStr.slice(-2))}</div>
            <div class="cal-items">
              ${dayItems.map((c) => `<div class="cal-item status-${c.status.toLowerCase()}" data-id="${c.id}" title="${Utils.escapeHtml(c.title)}">${Utils.escapeHtml(c.title)}</div>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>`;

    Utils.qsa('.cal-item', body).forEach((el) => {
      el.addEventListener('click', () => {
        const item = DB.get('contentItems', el.dataset.id);
        openContentForm(item, {}, () => renderCalendar(container, monthStart, filter));
      });
    });
  }

  function renderListMode(container, filter) {
    const body = Utils.qs('#cc-body', container);
    const items = filterItems(filter).sort((a, b) => a.publishDate.localeCompare(b.publishDate));
    if (!items.length) { body.innerHTML = `<div class="empty-inline-panel">No content items match these filters.</div>`; return; }
    body.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Title</th><th>Client</th><th>Status</th><th>Writer</th><th>Target keyword</th><th>Publish date</th></tr></thead>
          <tbody>
            ${items.map((c) => {
              const client = DB.get('clients', c.clientId);
              const writer = DB.get('team', c.writerId);
              return `
              <tr class="clickable-row" data-id="${c.id}">
                <td>${Utils.escapeHtml(c.title)}</td>
                <td>${Utils.escapeHtml(client?.name || '—')}</td>
                <td><span class="badge status-${c.status.toLowerCase()}">${c.status}</span></td>
                <td>${writer ? Utils.avatarHtml(writer, 'avatar-sm') + ' ' + Utils.escapeHtml(writer.name) : '—'}</td>
                <td>${Utils.escapeHtml(c.targetKeyword || '—')}</td>
                <td>${Utils.formatDate(c.publishDate)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    Utils.qsa('.clickable-row', body).forEach((row) => {
      row.addEventListener('click', () => {
        const item = DB.get('contentItems', row.dataset.id);
        openContentForm(item, {}, () => renderListMode(container, filter));
      });
    });
  }

  function openContentForm(item, scope, onSaved) {
    const isEdit = !!item;
    const clients = DB.all('clients');
    const projects = DB.all('projects');
    const team = DB.all('team');
    const html = `
      <div class="modal-header"><h3>${isEdit ? 'Edit Content' : 'New Content Item'}</h3><button class="icon-btn" data-act="close" aria-label="Close">&times;</button></div>
      <div class="modal-body">
        <div class="task-field"><label>Title</label><input type="text" id="ctf-title" value="${Utils.escapeHtml(item?.title || '')}" /></div>
        <div class="task-field-grid">
          <div class="task-field">
            <label>Client</label>
            <select id="ctf-client" ${scope.clientId ? 'disabled' : ''}>${clients.map((c) => `<option value="${c.id}" ${(item?.clientId || scope.clientId) === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>`).join('')}</select>
          </div>
          <div class="task-field">
            <label>Project (optional)</label>
            <select id="ctf-project" ${scope.projectId ? 'disabled' : ''}>
              <option value="">—</option>
              ${projects.map((p) => `<option value="${p.id}" ${(item?.projectId || scope.projectId) === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="task-field">
            <label>Status</label>
            <select id="ctf-status">${STATUSES.map((s) => `<option ${item?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
          </div>
          <div class="task-field">
            <label>Writer</label>
            <select id="ctf-writer"><option value="">Unassigned</option>${team.map((u) => `<option value="${u.id}" ${item?.writerId === u.id ? 'selected' : ''}>${Utils.escapeHtml(u.name)}</option>`).join('')}</select>
          </div>
          <div class="task-field"><label>Target keyword</label><input type="text" id="ctf-keyword" value="${Utils.escapeHtml(item?.targetKeyword || '')}" /></div>
          <div class="task-field"><label>Publish date</label><input type="date" id="ctf-date" value="${item?.publishDate || Utils.todayISO()}" /></div>
        </div>
      </div>
      <div class="modal-footer">
        ${isEdit ? '<button class="btn btn-danger" id="ctf-delete">Delete</button>' : '<span></span>'}
        <div>
          <button class="btn btn-ghost" data-act="close">Cancel</button>
          <button class="btn btn-primary" id="ctf-save">${isEdit ? 'Save Changes' : 'Create'}</button>
        </div>
      </div>`;
    const panel = ModalManager.open(html, { size: 'md' });
    Utils.qsa('[data-act="close"]', panel).forEach((b) => b.addEventListener('click', () => ModalManager.close()));
    Utils.qs('#ctf-save', panel).addEventListener('click', () => {
      const title = Utils.qs('#ctf-title', panel).value.trim();
      if (!title) { Toast.error('Title is required'); return; }
      const patch = {
        title,
        clientId: scope.clientId || Utils.qs('#ctf-client', panel).value,
        projectId: scope.projectId || Utils.qs('#ctf-project', panel).value || null,
        status: Utils.qs('#ctf-status', panel).value,
        writerId: Utils.qs('#ctf-writer', panel).value || null,
        targetKeyword: Utils.qs('#ctf-keyword', panel).value.trim(),
        publishDate: Utils.qs('#ctf-date', panel).value,
      };
      if (isEdit) { DB.update('contentItems', item.id, patch); Toast.success('Content updated'); }
      else { DB.insert('contentItems', { id: Utils.uid('ci'), ...patch }); Toast.success('Content item created'); }
      ModalManager.close();
      onSaved();
    });
    if (isEdit) {
      Utils.qs('#ctf-delete', panel).addEventListener('click', async () => {
        const ok = await ModalManager.confirmDialog({ title: 'Delete content item', message: `Delete "${item.title}"?`, confirmLabel: 'Delete', danger: true });
        if (ok) { DB.remove('contentItems', item.id); ModalManager.close(); Toast.success('Deleted'); onSaved(); }
      });
    }
  }

  Router.register('/content-calendar', render);
  window.ContentCalendarView = { renderSection, STATUSES };
})();
