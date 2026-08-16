// views/keywords.js — Keyword Tracker: standalone page + reusable project-scoped section.
(() => {
  function render() {
    const outlet = document.getElementById('view-outlet');
    outlet.innerHTML = `
      <div class="view-header">
        <div><h1>Keyword Tracker</h1><p class="view-subtitle">Rank tracking across all clients</p></div>
      </div>
      <div id="kw-section"></div>
    `;
    renderSection(document.getElementById('kw-section'), {}, { showClientFilter: true, showProjectFilter: true });
  }

  function renderSection(container, scope, opts = {}) {
    const clients = DB.all('clients');
    container.innerHTML = `
      <div class="toolbar">
        <input type="text" id="kw-search" class="input" placeholder="Search keywords…" />
        ${opts.showClientFilter ? `<select id="kw-client-filter" class="input"><option value="">All clients</option>${clients.map((c) => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('')}</select>` : ''}
        <div class="toolbar-spacer"></div>
        <button class="btn btn-primary" id="kw-add-btn">+ Add Keyword</button>
      </div>
      <div class="table-wrap">
        <table class="data-table" id="kw-table">
          <thead><tr>
            <th>Keyword</th><th>Client</th><th>Target URL</th><th>Volume</th><th>Current Rank</th><th>Change</th><th>Trend</th><th></th>
          </tr></thead>
          <tbody id="kw-tbody"></tbody>
        </table>
      </div>
    `;

    const search = Utils.qs('#kw-search', container);
    const clientFilter = Utils.qs('#kw-client-filter', container);
    const run = () => renderRows(container, {
      clientId: scope.clientId || (clientFilter ? clientFilter.value : ''),
      projectId: scope.projectId,
      query: search.value.toLowerCase(),
    });
    search.addEventListener('input', Utils.debounce(run, 150));
    clientFilter?.addEventListener('change', run);
    Utils.qs('#kw-add-btn', container).addEventListener('click', () => openKeywordForm(null, scope, () => run()));
    run();
  }

  function renderRows(container, filter) {
    let rows = DB.all('keywords');
    if (filter.projectId) rows = rows.filter((k) => k.projectId === filter.projectId);
    if (filter.clientId) rows = rows.filter((k) => k.clientId === filter.clientId);
    if (filter.query) rows = rows.filter((k) => k.keyword.toLowerCase().includes(filter.query));

    const tbody = Utils.qs('#kw-tbody', container);
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-inline-panel">No keywords tracked yet. Add one to start tracking rank history.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map((k) => {
      const client = DB.get('clients', k.clientId);
      const hist = k.history;
      const current = hist[hist.length - 1]?.rank ?? '—';
      const prev = hist.length > 1 ? hist[hist.length - 2].rank : null;
      const change = prev !== null ? prev - current : 0;
      const changeHtml = prev === null ? '<span class="rank-flat">–</span>'
        : change > 0 ? `<span class="rank-up">▲ ${change}</span>`
        : change < 0 ? `<span class="rank-down">▼ ${Math.abs(change)}</span>`
        : '<span class="rank-flat">— 0</span>';
      return `
      <tr class="kw-row" data-id="${k.id}">
        <td class="kw-name">${Utils.escapeHtml(k.keyword)}</td>
        <td>${Utils.escapeHtml(client?.name || '—')}</td>
        <td class="truncate-cell" title="${Utils.escapeHtml(k.targetUrl)}">${Utils.escapeHtml(k.targetUrl)}</td>
        <td>${k.searchVolume.toLocaleString()}</td>
        <td><strong>#${current}</strong></td>
        <td>${changeHtml}</td>
        <td><canvas class="sparkline" data-spark="${k.id}" width="90" height="28"></canvas></td>
        <td><button class="link-btn" data-act="view">Details</button></td>
      </tr>`;
    }).join('');

    Utils.qsa('canvas[data-spark]', tbody).forEach((cv) => {
      const k = rows.find((r) => r.id === cv.dataset.spark);
      Charts.rankLineChart(cv, k.history.slice(-8), { color: '#0d9488' });
    });
    Utils.qsa('.kw-row', tbody).forEach((row) => {
      row.addEventListener('click', () => {
        const k = rows.find((r) => r.id === row.dataset.id);
        openKeywordDetail(k, container, filter);
      });
    });
  }

  function openKeywordForm(keyword, scope, onSaved) {
    const isEdit = !!keyword;
    const clients = DB.all('clients');
    const projects = DB.all('projects');
    const html = `
      <div class="modal-header"><h3>${isEdit ? 'Edit Keyword' : 'Add Keyword'}</h3><button class="icon-btn" data-act="close">&times;</button></div>
      <div class="modal-body">
        <div class="task-field"><label>Keyword</label><input type="text" id="kf-keyword" value="${Utils.escapeHtml(keyword?.keyword || '')}" /></div>
        <div class="task-field-grid">
          <div class="task-field">
            <label>Client</label>
            <select id="kf-client" ${scope.clientId ? 'disabled' : ''}>
              ${clients.map((c) => `<option value="${c.id}" ${(keyword?.clientId || scope.clientId) === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="task-field">
            <label>Project (optional)</label>
            <select id="kf-project" ${scope.projectId ? 'disabled' : ''}>
              <option value="">—</option>
              ${projects.map((p) => `<option value="${p.id}" ${(keyword?.projectId || scope.projectId) === p.id ? 'selected' : ''}>${Utils.escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="task-field"><label>Target URL</label><input type="text" id="kf-url" value="${Utils.escapeHtml(keyword?.targetUrl || '')}" placeholder="/page-path" /></div>
          <div class="task-field"><label>Search volume</label><input type="number" id="kf-volume" min="0" value="${keyword?.searchVolume ?? 0}" /></div>
          ${!isEdit ? `<div class="task-field"><label>Current rank</label><input type="number" id="kf-rank" min="1" value="20" /></div>` : ''}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-act="close">Cancel</button>
        <button class="btn btn-primary" id="kf-save">${isEdit ? 'Save Changes' : 'Add Keyword'}</button>
      </div>`;
    const panel = ModalManager.open(html, { size: 'md' });
    Utils.qsa('[data-act="close"]', panel).forEach((b) => b.addEventListener('click', () => ModalManager.close()));
    Utils.qs('#kf-save', panel).addEventListener('click', () => {
      const kw = Utils.qs('#kf-keyword', panel).value.trim();
      if (!kw) { Toast.error('Keyword is required'); return; }
      const patch = {
        keyword: kw,
        clientId: scope.clientId || Utils.qs('#kf-client', panel).value,
        projectId: scope.projectId || Utils.qs('#kf-project', panel).value || null,
        targetUrl: Utils.qs('#kf-url', panel).value.trim(),
        searchVolume: Number(Utils.qs('#kf-volume', panel).value) || 0,
      };
      if (isEdit) {
        DB.update('keywords', keyword.id, patch);
        Toast.success('Keyword updated');
      } else {
        const rank = Number(Utils.qs('#kf-rank', panel).value) || 20;
        DB.insert('keywords', { id: Utils.uid('k'), ...patch, history: [{ date: Utils.todayISO(), rank }] });
        Toast.success('Keyword added');
      }
      ModalManager.close();
      onSaved();
    });
  }

  function openKeywordDetail(keyword, container, filter) {
    const client = DB.get('clients', keyword.clientId);
    const project = keyword.projectId ? DB.get('projects', keyword.projectId) : null;
    const html = `
      <div class="modal-header"><h3>${Utils.escapeHtml(keyword.keyword)}</h3><button class="icon-btn" data-act="close">&times;</button></div>
      <div class="modal-body">
        <div class="kv-row"><span>Client</span><strong>${Utils.escapeHtml(client?.name || '—')}</strong></div>
        <div class="kv-row"><span>Project</span><strong>${Utils.escapeHtml(project?.name || '—')}</strong></div>
        <div class="kv-row"><span>Target URL</span><strong>${Utils.escapeHtml(keyword.targetUrl)}</strong></div>
        <div class="kv-row"><span>Search volume</span><strong>${keyword.searchVolume.toLocaleString()}/mo</strong></div>
        <canvas id="kw-detail-chart" class="chart-canvas" style="height:160px"></canvas>
        <div class="task-field">
          <label>Add rank update</label>
          <div class="inline-form-row">
            <input type="date" id="kw-new-date" value="${Utils.todayISO()}" />
            <input type="number" id="kw-new-rank" min="1" placeholder="Rank" />
            <button class="btn btn-primary btn-sm" id="kw-add-rank">Add</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table data-table-sm">
            <thead><tr><th>Date</th><th>Rank</th></tr></thead>
            <tbody id="kw-history-body">${keyword.history.slice().reverse().map((h) => `<tr><td>${Utils.formatDate(h.date)}</td><td>#${h.rank}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-danger" id="kw-delete">Delete keyword</button>
        <button class="btn btn-ghost" data-act="close">Close</button>
      </div>`;
    const panel = ModalManager.open(html, { size: 'md' });
    Utils.qsa('[data-act="close"]', panel).forEach((b) => b.addEventListener('click', () => ModalManager.close()));
    Charts.rankLineChart(document.getElementById('kw-detail-chart'), keyword.history, { color: '#2563eb' });

    Utils.qs('#kw-add-rank', panel).addEventListener('click', () => {
      const date = Utils.qs('#kw-new-date', panel).value;
      const rank = Number(Utils.qs('#kw-new-rank', panel).value);
      if (!date || !rank) { Toast.error('Enter a date and rank'); return; }
      const fresh = DB.get('keywords', keyword.id);
      const existingIdx = fresh.history.findIndex((h) => h.date === date);
      if (existingIdx >= 0) fresh.history[existingIdx].rank = rank;
      else fresh.history.push({ date, rank });
      fresh.history.sort((a, b) => a.date.localeCompare(b.date));
      DB.update('keywords', keyword.id, { history: fresh.history });
      Toast.success('Rank recorded');
      ModalManager.close();
      renderRows(container, filter);
    });

    Utils.qs('#kw-delete', panel).addEventListener('click', async () => {
      const ok = await ModalManager.confirmDialog({ title: 'Delete keyword', message: `Stop tracking "${keyword.keyword}"?`, confirmLabel: 'Delete', danger: true });
      if (ok) {
        DB.remove('keywords', keyword.id);
        ModalManager.close();
        Toast.success('Keyword removed');
        renderRows(container, filter);
      }
    });
  }

  Router.register('/keywords', render);
  window.KeywordsView = { renderSection };
})();
