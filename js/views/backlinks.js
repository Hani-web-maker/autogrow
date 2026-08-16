// views/backlinks.js — Backlink Tracker: standalone page + reusable project-scoped section.
(() => {
  const STATUSES = ['Live', 'Pending', 'Lost'];

  function render() {
    const outlet = document.getElementById('view-outlet');
    outlet.innerHTML = `
      <div class="view-header">
        <div><h1>Backlinks</h1><p class="view-subtitle">Acquired &amp; pending backlinks across clients</p></div>
      </div>
      <div id="bl-section"></div>
    `;
    renderSection(document.getElementById('bl-section'), {}, { showClientFilter: true });
  }

  function renderSection(container, scope, opts = {}) {
    const clients = DB.all('clients');
    container.innerHTML = `
      <div class="toolbar">
        <input type="text" id="bl-search" class="input" placeholder="Search source domain or anchor…" />
        ${opts.showClientFilter ? `<select id="bl-client-filter" class="input"><option value="">All clients</option>${clients.map((c) => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('')}</select>` : ''}
        <select id="bl-status-filter" class="input"><option value="">All statuses</option>${STATUSES.map((s) => `<option>${s}</option>`).join('')}</select>
        <div class="toolbar-spacer"></div>
        <button class="btn btn-primary" id="bl-add-btn">+ Add Backlink</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Source Domain</th><th>Client</th><th>DA</th><th>DR</th><th>Anchor Text</th><th>Status</th><th>Date Acquired</th><th></th></tr></thead>
          <tbody id="bl-tbody"></tbody>
        </table>
      </div>
    `;
    const search = Utils.qs('#bl-search', container);
    const clientFilter = Utils.qs('#bl-client-filter', container);
    const statusFilter = Utils.qs('#bl-status-filter', container);
    let currentFilter = {};
    const run = () => {
      currentFilter = {
        clientId: scope.clientId || (clientFilter ? clientFilter.value : ''),
        status: statusFilter.value,
        query: search.value.toLowerCase(),
      };
      renderRows(container, currentFilter);
    };
    search.addEventListener('input', Utils.debounce(run, 150));
    clientFilter?.addEventListener('change', run);
    statusFilter.addEventListener('change', run);
    Utils.qs('#bl-add-btn', container).addEventListener('click', () => openBacklinkForm(null, scope, run));

    Utils.qs('#bl-tbody', container).addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const link = DB.get('backlinks', btn.dataset.id);
      if (btn.dataset.act === 'edit') openBacklinkForm(link, scope, run);
      if (btn.dataset.act === 'delete') {
        const ok = await ModalManager.confirmDialog({ title: 'Delete backlink', message: `Remove backlink from ${link.sourceDomain}?`, confirmLabel: 'Delete', danger: true });
        if (ok) { DB.remove('backlinks', link.id); Toast.success('Backlink removed'); run(); }
      }
    });

    run();
  }

  function renderRows(container, filter) {
    let rows = DB.all('backlinks');
    if (filter.clientId) rows = rows.filter((b) => b.clientId === filter.clientId);
    if (filter.status) rows = rows.filter((b) => b.status === filter.status);
    if (filter.query) rows = rows.filter((b) => b.sourceDomain.toLowerCase().includes(filter.query) || b.anchorText.toLowerCase().includes(filter.query));

    const tbody = Utils.qs('#bl-tbody', container);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-inline-panel">No backlinks logged yet.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map((b) => {
      const client = DB.get('clients', b.clientId);
      return `
      <tr>
        <td><a href="https://${Utils.escapeHtml(b.sourceDomain)}" target="_blank" rel="noopener">${Utils.escapeHtml(b.sourceDomain)}</a></td>
        <td>${Utils.escapeHtml(client?.name || '—')}</td>
        <td>${b.da}</td>
        <td>${b.dr}</td>
        <td>${Utils.escapeHtml(b.anchorText)}</td>
        <td><span class="badge status-${b.status.toLowerCase()}">${b.status}</span></td>
        <td>${Utils.formatDate(b.dateAcquired)}</td>
        <td class="row-actions">
          <button class="icon-btn-sm" data-act="edit" data-id="${b.id}" title="Edit">✎</button>
          <button class="icon-btn-sm" data-act="delete" data-id="${b.id}" title="Delete">🗑</button>
        </td>
      </tr>`;
    }).join('');
  }

  function openBacklinkForm(link, scope, onSaved) {
    const isEdit = !!link;
    const clients = DB.all('clients');
    const html = `
      <div class="modal-header"><h3>${isEdit ? 'Edit Backlink' : 'Add Backlink'}</h3><button class="icon-btn" data-act="close">&times;</button></div>
      <div class="modal-body">
        <div class="task-field"><label>Source domain</label><input type="text" id="blf-domain" placeholder="example.com" value="${Utils.escapeHtml(link?.sourceDomain || '')}" /></div>
        <div class="task-field-grid">
          <div class="task-field">
            <label>Client</label>
            <select id="blf-client" ${scope.clientId ? 'disabled' : ''}>${clients.map((c) => `<option value="${c.id}" ${(link?.clientId || scope.clientId) === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>`).join('')}</select>
          </div>
          <div class="task-field"><label>Target URL</label><input type="text" id="blf-target" value="${Utils.escapeHtml(link?.targetUrl || '')}" /></div>
          <div class="task-field"><label>DA (Domain Authority)</label><input type="number" id="blf-da" min="0" max="100" value="${link?.da ?? ''}" /></div>
          <div class="task-field"><label>DR (Domain Rating)</label><input type="number" id="blf-dr" min="0" max="100" value="${link?.dr ?? ''}" /></div>
          <div class="task-field"><label>Anchor text</label><input type="text" id="blf-anchor" value="${Utils.escapeHtml(link?.anchorText || '')}" /></div>
          <div class="task-field">
            <label>Status</label>
            <select id="blf-status">${STATUSES.map((s) => `<option ${link?.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
          </div>
          <div class="task-field"><label>Date acquired</label><input type="date" id="blf-date" value="${link?.dateAcquired || Utils.todayISO()}" /></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-act="close">Cancel</button>
        <button class="btn btn-primary" id="blf-save">${isEdit ? 'Save Changes' : 'Add Backlink'}</button>
      </div>`;
    const panel = ModalManager.open(html, { size: 'md' });
    Utils.qsa('[data-act="close"]', panel).forEach((b) => b.addEventListener('click', () => ModalManager.close()));
    Utils.qs('#blf-save', panel).addEventListener('click', () => {
      const domain = Utils.qs('#blf-domain', panel).value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (!domain) { Toast.error('Source domain is required'); return; }
      const patch = {
        sourceDomain: domain,
        clientId: scope.clientId || Utils.qs('#blf-client', panel).value,
        targetUrl: Utils.qs('#blf-target', panel).value.trim(),
        da: Number(Utils.qs('#blf-da', panel).value) || 0,
        dr: Number(Utils.qs('#blf-dr', panel).value) || 0,
        anchorText: Utils.qs('#blf-anchor', panel).value.trim(),
        status: Utils.qs('#blf-status', panel).value,
        dateAcquired: Utils.qs('#blf-date', panel).value,
      };
      if (isEdit) { DB.update('backlinks', link.id, patch); Toast.success('Backlink updated'); }
      else { DB.insert('backlinks', { id: Utils.uid('bl'), ...patch }); Toast.success('Backlink added'); }
      ModalManager.close();
      onSaved();
    });
  }

  Router.register('/backlinks', render);
  window.BacklinksView = { renderSection };
})();
